/* Accounts and per-player storage. Loaded first, before every other script.
 *
 *   - Accounts live in this browser (no server yet): email, role (player / doctor), and a salted
 *     SHA-256 hash of the password (the password itself is never stored).
 *   - Every "memoir.*" localStorage key the game uses is kept separately for each signed-in account:
 *     stars, history, hearts, coins, quests, chat, calendar… The other scripts keep using their usual
 *     keys; this file redirects them to the signed-in player's own space.
 *   - Signing in or out reloads the page so every script reads that player's data.
 *
 * Exposes window.MemoirAccount (main.js copies it to Memoir.account).
 */
(() => {
  "use strict";

  const ACCOUNTS_KEY = "memoir.accounts.v1";   // shared: all accounts on this device
  const SESSION_KEY = "memoir.session.v1";     // shared: who is signed in
  const MESSAGES_KEY = "memoir.messages.v1";   // shared: chat between player and doctor accounts
  const SUPPORT_KEY = "memoir.support.v1";     // shared: "ติดต่อทีมงาน" threads, player ⇄ staff
  const AUDIT_KEY = "memoir.audit.v1";         // shared: every action staff took (who, what, to whom, when)
  const SHARED = new Set([ACCOUNTS_KEY, SESSION_KEY, MESSAGES_KEY, SUPPORT_KEY, AUDIT_KEY]);
  const LS = window.localStorage;
  const raw = {
    get: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem,
  };
  const rget = (k) => { try { return raw.get.call(LS, k); } catch (e) { return null; } };
  const rset = (k, v) => { try { raw.set.call(LS, k, v); } catch (e) { /* storage off */ } };
  const rdel = (k) => { try { raw.remove.call(LS, k); } catch (e) { /* storage off */ } };

  function accounts() { try { return JSON.parse(rget(ACCOUNTS_KEY)) || {}; } catch (e) { return {}; } }
  const saveAccounts = (all) => rset(ACCOUNTS_KEY, JSON.stringify(all));
  const session = rget(SESSION_KEY);
  let user = session && accounts()[session] ? accounts()[session] : null;

  // banned: { until: time or 0 = for good, reason }; returns the ban if it is still running
  const activeBan = (a) => (a && a.ban && (a.ban.until === 0 || a.ban.until > Date.now()) ? a.ban : null);
  function banText(ban) {
    const when = ban.until === 0 ? "ถาวร" : `ถึง ${new Date(ban.until).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`;
    return `บัญชีนี้ถูกระงับการใช้งาน (${when})${ban.reason ? `\nเหตุผล: ${ban.reason}` : ""}`;
  }
  const BAN_NOTE = "memoir-ban-note";   // sessionStorage: why the player was signed out, shown on the login screen
  if (user && activeBan(user)) {
    try { sessionStorage.setItem(BAN_NOTE, banText(user.ban)); } catch (e) { /* ok */ }
    rdel(SESSION_KEY);
    user = null;
  }

  // ---------- per-player keys ----------
  const space = (id) => `memoir@${id}:`;
  function mapKey(k) {
    if (typeof k !== "string" || !k.startsWith("memoir.") || SHARED.has(k)) return k;
    return space(user ? user.email : "guest") + k.slice("memoir.".length);
  }
  Storage.prototype.getItem = function (k) { return raw.get.call(this, this === LS ? mapKey(k) : k); };
  Storage.prototype.setItem = function (k, v) { return raw.set.call(this, this === LS ? mapKey(k) : k, v); };
  Storage.prototype.removeItem = function (k) { return raw.remove.call(this, this === LS ? mapKey(k) : k); };

  // The very first account takes over what was played on this device before accounts existed
  function adoptOldData(email) {
    const keys = [];
    for (let i = 0; i < LS.length; i++) {
      const k = LS.key(i);
      if (k && k.startsWith("memoir.") && !SHARED.has(k)) keys.push(k);
    }
    keys.forEach((k) => { rset(space(email) + k.slice("memoir.".length), rget(k)); rdel(k); });
  }

  // ---------- password hash (SHA-256, works on http:// too) ----------
  function sha256(str) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(str);
    const len = bytes.length, bitLen = len * 8;
    const total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(bytes); m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, bitLen >>> 0); dv.setUint32(total - 8, Math.floor(bitLen / 2 ** 32));
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = h.map((v, i) => (v + [a, b, c, d, e, f, g, hh][i]) >>> 0);
    }
    return h.map((v) => v.toString(16).padStart(8, "0")).join("");
  }
  function salt() {
    const a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const normEmail = (e) => String(e || "").trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_PASS = 6;

  // ---------- staff (แอดมิน / GM) ----------
  // The owner's email is kept only as a hash so the address is not readable in the public code.
  // That account becomes "admin" as soon as it signs up (or signs in). Other staff are made in the back office.
  const OWNER_HASH = "388fbd0ab4f3da7a205c3a962bebce83673282425fe49dca60b57f6c8a35695c";
  const isOwner = (email) => sha256("memoir-staff:" + normEmail(email)) === OWNER_HASH;
  const STAFF_TXT = { admin: "แอดมิน", gm: "GM" };

  // returns { ok } or { ok: false, field, msg }
  function signUp(emailIn, password, role) {
    const email = normEmail(emailIn);
    if (!EMAIL_RE.test(email)) return { ok: false, field: "email", msg: "กรุณาใส่อีเมลให้ถูกต้อง" };
    const all = accounts();
    if (all[email]) return { ok: false, field: "email", msg: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น หรือกดเข้าสู่ระบบ" };
    if (String(password).length < MIN_PASS) return { ok: false, field: "pass", msg: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASS} ตัว` };
    if (role !== "player" && role !== "doctor") return { ok: false, field: "role", msg: "กรุณาเลือกว่าสมัครเป็นผู้เล่นหรือแพทย์" };
    const first = Object.keys(all).length === 0;
    const s = salt();
    all[email] = { email, role, salt: s, hash: sha256(s + password), created: Date.now() };
    if (isOwner(email)) all[email].staff = "admin";
    saveAccounts(all);
    if (first) adoptOldData(email);
    rset(SESSION_KEY, email);
    return { ok: true };
  }
  function signIn(emailIn, password) {
    const email = normEmail(emailIn);
    const all = accounts(), a = all[email];
    if (!EMAIL_RE.test(email)) return { ok: false, field: "email", msg: "กรุณาใส่อีเมลให้ถูกต้อง" };
    if (!a || a.hash !== sha256(a.salt + password)) return { ok: false, field: "pass", msg: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    const ban = activeBan(a);
    if (ban) return { ok: false, field: "email", msg: banText(ban) };
    if (isOwner(email) && a.staff !== "admin") { a.staff = "admin"; saveAccounts(all); }
    rset(SESSION_KEY, email);
    return { ok: true };
  }
  function signOut() { rdel(SESSION_KEY); }

  // Quick play (for presentations): a ready-made player account on this device, no password typing
  const DEMO_EMAIL = "demo@memoir.app";
  function enterDemo() {
    const all = accounts();
    if (!all[DEMO_EMAIL]) {
      const s = salt();
      all[DEMO_EMAIL] = { email: DEMO_EMAIL, role: "player", salt: s, hash: sha256(s + salt()), created: Date.now(), demo: true };
      rset(ACCOUNTS_KEY, JSON.stringify(all));
    }
    rset(SESSION_KEY, DEMO_EMAIL);
    return { ok: true };
  }

  // For the doctor's page: player accounts on this device and their play history (read only)
  function players() {
    return Object.values(accounts()).filter((a) => a.role === "player")
      .map((a) => ({ email: a.email, name: a.email.split("@")[0] }));
  }
  function historyOf(email) {
    try { return JSON.parse(rget(space(normEmail(email)) + "history.v1")) || []; } catch (e) { return []; }
  }
  // For the player's page: doctor accounts on this device (their chat contacts)
  function doctors() {
    return Object.values(accounts()).filter((a) => a.role === "doctor")
      .map((a) => ({ email: a.email, name: a.email.split("@")[0] }));
  }

  // Messages between a doctor and a player account (both can read them):
  //   { "doctor@x|player@y": [{ by: email, text, t }] }
  const pairKey = (doctorEmail, playerEmail) => `${normEmail(doctorEmail)}|${normEmail(playerEmail)}`;
  function readMessages() { try { return JSON.parse(rget(MESSAGES_KEY)) || {}; } catch (e) { return {}; } }
  function messages(doctorEmail, playerEmail) { return readMessages()[pairKey(doctorEmail, playerEmail)] || []; }
  function postMessage(doctorEmail, playerEmail, text) {
    const all = readMessages(), k = pairKey(doctorEmail, playerEmail);
    const m = { by: user ? user.email : "", text: String(text).slice(0, 300), t: Date.now() };
    (all[k] = all[k] || []).push(m);
    rset(MESSAGES_KEY, JSON.stringify(all));
    return m;
  }

  // ---------- warnings for the signed-in player ----------
  function myWarnings() { return user ? (user.warnings || []).filter((w) => !w.seen) : []; }
  function ackWarnings() {
    if (!user) return;
    const all = accounts(), a = all[user.email];
    if (!a) return;
    (a.warnings || []).forEach((w) => { w.seen = true; });
    saveAccounts(all);
    user.warnings = a.warnings;
  }
  function takeBanNote() {
    try { const n = sessionStorage.getItem(BAN_NOTE); sessionStorage.removeItem(BAN_NOTE); return n; } catch (e) { return null; }
  }

  // ---------- "ติดต่อทีมงาน": one thread per player { email: [{ by, staff, text, t }] } ----------
  function readSupport() { try { return JSON.parse(rget(SUPPORT_KEY)) || {}; } catch (e) { return {}; } }
  function supportThread(email) { return readSupport()[normEmail(email || (user && user.email))] || []; }
  function postSupport(text, toEmail) {
    if (!user) return null;
    const t = String(text || "").trim().slice(0, 500);
    if (!t) return null;
    const all = readSupport(), k = normEmail(toEmail || user.email);
    const m = { by: user.email, staff: !!toEmail, text: t, t: Date.now() };
    (all[k] = all[k] || []).push(m);
    rset(SUPPORT_KEY, JSON.stringify(all));
    return m;
  }
  // replies from staff the player has not opened yet
  const SEEN_KEY = () => space(user.email) + "support.seen";
  function supportUnread() {
    if (!user) return 0;
    const seen = Number(rget(SEEN_KEY())) || 0;
    return supportThread(user.email).filter((m) => m.staff && m.t > seen).length;
  }
  function supportSeen() { if (user) rset(SEEN_KEY(), String(Date.now())); }

  // =====================================================================
  // Back office (ระบบหลังบ้าน): only for staff accounts.
  // Staff can reach ONLY these: account info, items (hearts) and coins, play history, support
  // messages, warn / ban, account edits, and (admin only) other staff. Not exposed: passwords,
  // the doctor–patient chat, evaluation charts, calendars, settings.
  // NOTE: until the Cloudflare server exists, this runs in the browser on this device's data,
  // so these checks keep honest staff in their lane but are not a security boundary yet.
  // =====================================================================
  const PERMS = {
    gm: ["players", "items", "history", "support", "warn", "ban", "coins", "account"],
    admin: ["players", "items", "history", "support", "warn", "ban", "coins", "account", "staff"],
  };
  const myStaff = () => (user && accounts()[user.email] ? accounts()[user.email].staff || null : null);
  const can = (perm) => { const s = myStaff(); return !!s && PERMS[s].includes(perm); };
  function need(perm) { if (!can(perm)) throw new Error("ไม่มีสิทธิ์ทำรายการนี้"); }
  function audit(action, target, detail) {
    let log = [];
    try { log = JSON.parse(rget(AUDIT_KEY)) || []; } catch (e) { /* new */ }
    log.push({ t: Date.now(), by: user.email, action, target: target || "", detail: detail || "" });
    rset(AUDIT_KEY, JSON.stringify(log.slice(-2000)));
  }
  // GMs cannot touch staff accounts; nobody can change the owner's staff role or ban the owner
  function guardTarget(email, a) {
    if (!a) throw new Error("ไม่พบบัญชีนี้");
    if (myStaff() !== "admin" && a.staff) throw new Error("GM จัดการบัญชีทีมงานด้วยกันไม่ได้");
  }
  const walletKey = (email) => space(normEmail(email)) + "wallet.v1";
  function readWallet(email) {
    try { return JSON.parse(rget(walletKey(email))) || null; } catch (e) { return null; }
  }
  function publicAccount(a) {
    const w = readWallet(a.email) || { hearts: 7, coins: 0 };
    const h = historyOf(a.email);
    return {
      email: a.email, name: a.name || a.email.split("@")[0], role: a.role, staff: a.staff || null,
      created: a.created, demo: !!a.demo, owner: isOwner(a.email),
      ban: activeBan(a), warnings: (a.warnings || []).slice(),
      hearts: w.hearts, coins: w.coins,
      plays: h.length, lastPlay: h.length ? Math.max(...h.map((r) => r.t || 0)) : 0,
    };
  }
  const admin = {
    can, STAFF_TXT,
    me: () => (user ? { email: user.email, staff: myStaff() } : null),
    // ข้อมูลผู้เล่น + ฐานข้อมูลผู้เล่นทั้งหมด
    list() { need("players"); return Object.values(accounts()).map(publicAccount); },
    get(email) { need("players"); const a = accounts()[normEmail(email)]; return a ? publicAccount(a) : null; },
    // ประวัติการเล่น
    history(email) { need("history"); return historyOf(email).slice().sort((x, y) => (y.t || 0) - (x.t || 0)); },
    // ไอเทม (หัวใจ) และเงิน (เหรียญ): set to an exact amount
    setWallet(email, { hearts, coins }) {
      email = normEmail(email);
      const a = accounts()[email];
      guardTarget(email, a);
      const w = readWallet(email) || { hearts: 7, coins: 0, regenFrom: Date.now() };
      const parts = [];
      if (hearts != null && hearts !== w.hearts) {
        need("items");
        const v = Math.max(0, Math.min(99, Math.round(hearts)));
        parts.push(`หัวใจ ${w.hearts} → ${v}`); w.hearts = v;
      }
      if (coins != null && coins !== w.coins) {
        need("coins");
        const v = Math.max(0, Math.min(999999, Math.round(coins)));
        parts.push(`เหรียญ ${w.coins} → ${v}`); w.coins = v;
      }
      if (!parts.length) return;
      rset(walletKey(email), JSON.stringify(w));
      audit("แก้ไอเทม/เงิน", email, parts.join(", "));
    },
    // เตือน
    warn(email, text) {
      need("warn");
      email = normEmail(email);
      const all = accounts(), a = all[email];
      guardTarget(email, a);
      const t = String(text || "").trim().slice(0, 300);
      if (!t) throw new Error("กรุณาพิมพ์ข้อความเตือน");
      (a.warnings = a.warnings || []).push({ text: t, by: user.email, t: Date.now(), seen: false });
      saveAccounts(all);
      audit("เตือน", email, t);
    },
    // แบน: days = 0 → ถาวร
    ban(email, days, reason) {
      need("ban");
      email = normEmail(email);
      const all = accounts(), a = all[email];
      guardTarget(email, a);
      if (isOwner(email) || email === user.email) throw new Error("แบนบัญชีนี้ไม่ได้");
      const d = Math.max(0, Math.round(Number(days) || 0));
      a.ban = { until: d === 0 ? 0 : Date.now() + d * 86400000, reason: String(reason || "").trim().slice(0, 200), by: user.email, t: Date.now() };
      saveAccounts(all);
      audit("แบน", email, `${d === 0 ? "ถาวร" : d + " วัน"}${a.ban.reason ? " · " + a.ban.reason : ""}`);
    },
    unban(email) {
      need("ban");
      email = normEmail(email);
      const all = accounts(), a = all[email];
      guardTarget(email, a);
      delete a.ban;
      saveAccounts(all);
      audit("ยกเลิกแบน", email);
    },
    // แก้ไขข้อมูลบัญชี: display name, player / doctor, new password
    editAccount(email, { name, role, password } = {}) {
      need("account");
      email = normEmail(email);
      const all = accounts(), a = all[email];
      guardTarget(email, a);
      const parts = [];
      if (name != null) {
        const n = String(name).trim().slice(0, 40);
        if (n && n !== (a.name || "")) { parts.push(`ชื่อ → ${n}`); a.name = n; }
      }
      if (role && role !== a.role) {
        if (role !== "player" && role !== "doctor") throw new Error("บทบาทไม่ถูกต้อง");
        parts.push(`บทบาท ${a.role} → ${role}`); a.role = role;
      }
      if (password) {
        if (String(password).length < MIN_PASS) throw new Error(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASS} ตัว`);
        a.salt = salt(); a.hash = sha256(a.salt + password);
        parts.push("ตั้งรหัสผ่านใหม่");
      }
      if (!parts.length) return;
      saveAccounts(all);
      audit("แก้ไขบัญชี", email, parts.join(", "));
    },
    // จัดการ GM (admin only): "gm" or null
    setStaff(email, staff) {
      need("staff");
      email = normEmail(email);
      const all = accounts(), a = all[email];
      if (!a) throw new Error("ไม่พบบัญชีนี้");
      if (isOwner(email)) throw new Error("เปลี่ยนสิทธิ์ของแอดมินหลักไม่ได้");
      if (staff !== "gm" && staff !== null) throw new Error("สิทธิ์ไม่ถูกต้อง");
      if (staff && activeBan(a)) throw new Error("บัญชีนี้ถูกแบนอยู่");
      if ((a.staff || null) === staff) return;
      if (staff) a.staff = staff; else delete a.staff;
      saveAccounts(all);
      audit(staff ? "แต่งตั้ง GM" : "ถอด GM", email);
    },
    // ตอบคำถามผู้เล่น
    threads() {
      need("support");
      const all = readSupport();
      return Object.entries(all).map(([email, msgs]) => {
        const last = msgs[msgs.length - 1];
        return { email, count: msgs.length, last, waiting: !!last && !last.staff };
      }).sort((x, y) => (y.last ? y.last.t : 0) - (x.last ? x.last.t : 0));
    },
    thread(email) { need("support"); return supportThread(email); },
    reply(email, text) {
      need("support");
      const m = postSupport(text, email);
      if (m) audit("ตอบคำถาม", normEmail(email), m.text.slice(0, 60));
      return m;
    },
    auditLog() { need("players"); try { return (JSON.parse(rget(AUDIT_KEY)) || []).slice().reverse(); } catch (e) { return []; } },
  };

  const curStaff = user ? user.staff || null : null;
  window.MemoirAccount = {
    current: user ? { email: user.email, role: user.role, name: user.name || user.email.split("@")[0], staff: curStaff } : null,
    signUp, signIn, signOut, enterDemo, players, doctors, historyOf, messages, postMessage, MIN_PASS,
    myWarnings, ackWarnings, takeBanNote, supportThread, postSupport, supportUnread, supportSeen,
    admin: curStaff ? admin : null,
  };
})();

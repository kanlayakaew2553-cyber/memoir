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
  const SHARED = new Set([ACCOUNTS_KEY, SESSION_KEY, MESSAGES_KEY]);
  const LS = window.localStorage;
  const raw = {
    get: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem,
  };
  const rget = (k) => { try { return raw.get.call(LS, k); } catch (e) { return null; } };
  const rset = (k, v) => { try { raw.set.call(LS, k, v); } catch (e) { /* storage off */ } };
  const rdel = (k) => { try { raw.remove.call(LS, k); } catch (e) { /* storage off */ } };

  function accounts() { try { return JSON.parse(rget(ACCOUNTS_KEY)) || {}; } catch (e) { return {}; } }
  const session = rget(SESSION_KEY);
  const user = session && accounts()[session] ? accounts()[session] : null;

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
    rset(ACCOUNTS_KEY, JSON.stringify(all));
    if (first) adoptOldData(email);
    rset(SESSION_KEY, email);
    return { ok: true };
  }
  function signIn(emailIn, password) {
    const email = normEmail(emailIn);
    const a = accounts()[email];
    if (!EMAIL_RE.test(email)) return { ok: false, field: "email", msg: "กรุณาใส่อีเมลให้ถูกต้อง" };
    if (!a || a.hash !== sha256(a.salt + password)) return { ok: false, field: "pass", msg: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
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

  window.MemoirAccount = {
    current: user ? { email: user.email, role: user.role, name: user.email.split("@")[0] } : null,
    signUp, signIn, signOut, enterDemo, players, doctors, historyOf, messages, postMessage, MIN_PASS,
  };
})();

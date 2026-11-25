/* MEMOIR back office (ระบบหลังบ้าน) — admin.html
 *
 * Staff only. What staff can reach (nothing else is shown or exposed by js/userstore.js):
 *   ผู้เล่น: account info, items (hearts) and coins, play history, warn, ban, edit account
 *   ข้อความ: answer "ติดต่อทีมงาน" questions
 *   ทีมงาน:  make / remove GMs (แอดมิน only)
 *   บันทึก:  every staff action (who, what, to whom, when)
 *
 * Data: this device's storage for now (see the note in js/userstore.js); the same calls will go to
 * the Cloudflare server later.
 */
(() => {
  "use strict";

  const ACC = window.MemoirAccount;
  const app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (t, withTime = true) => (t ? new Date(t).toLocaleString("th-TH", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "—");
  const GAME = { melody: "สร้างดนตรี", decor: "หาสิ่งผิดปกติ", market: "ตลาดผลไม้" };
  const ROLE = { player: "ผู้เล่น", doctor: "แพทย์" };
  const HOME_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3.2 2.6 11a1 1 0 0 0 1.3 1.5l.9-.8V20a1 1 0 0 0 1 1h4.4v-5.6h3.6V21h4.4a1 1 0 0 0 1-1v-8.3l.9.8A1 1 0 0 0 21.4 11Z"/></svg>';

  // ---------------------------------------------------------------------
  // Gate: signed in + staff
  // ---------------------------------------------------------------------
  const me = ACC.current;
  if (!me || !ACC.admin) { renderGate(); return; }
  const A = ACC.admin;

  function renderGate() {
    const notStaff = !!me;
    app.innerHTML = `
      <main class="gate">
        <div class="gate-card">
          <p class="brand">MEMOIR</p>
          <h1>ระบบหลังบ้าน</h1>
          ${notStaff ? `
            <p class="gate-msg">บัญชี <b>${esc(me.email)}</b> ไม่มีสิทธิ์เข้าระบบหลังบ้าน</p>
            <button class="btn" data-act="out">ออกจากระบบ แล้วเข้าด้วยบัญชีทีมงาน</button>
          ` : `
            <p class="gate-msg">สำหรับแอดมินและ GM เท่านั้น</p>
            <form class="gate-form">
              <label>อีเมล<input name="email" type="email" autocomplete="username" required></label>
              <label>รหัสผ่าน<input name="pass" type="password" autocomplete="current-password" required></label>
              <p class="gate-err" role="alert"></p>
              <button class="btn is-primary" type="submit">เข้าสู่ระบบ</button>
            </form>`}
          <a class="btn home-btn gate-home" href="index.html">${HOME_ICON}<span>กลับเข้าเกม</span></a>
        </div>
      </main>`;
    const out = app.querySelector('[data-act="out"]');
    if (out) out.addEventListener("click", () => { ACC.signOut(); location.reload(); });
    const form = app.querySelector(".gate-form");
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = ACC.signIn(form.email.value, form.pass.value);
      if (!r.ok) { form.querySelector(".gate-err").textContent = r.msg; return; }
      location.reload();
    });
  }

  // ---------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------
  const isAdmin = A.can("staff");
  const TABS = [
    ["players", "ผู้เล่น"],
    ["support", "ข้อความ"],
    ...(isAdmin ? [["staff", "ทีมงาน GM"]] : []),
    ["audit", "บันทึกการทำงาน"],
  ];
  let tab = "players", selected = null, filter = "all", query = "", openThread = null;

  app.innerHTML = `
    <header class="top">
      <div class="top-brand">
        <a class="btn home-btn" href="index.html">${HOME_ICON}<span>กลับเข้าเกม</span></a>
        <span class="brand">MEMOIR</span><span class="top-title">ระบบหลังบ้าน</span>
      </div>
      <div class="top-me">
        <span class="me-mail">${esc(me.email)}</span>
        <span class="tag tag-staff">${esc(A.STAFF_TXT[me.staff])}</span>
        <button class="btn small" data-act="out">ออกจากระบบ</button>
      </div>
    </header>
    <nav class="tabs" role="tablist">
      ${TABS.map(([k, label]) => `<button role="tab" data-tab="${k}">${label}<span class="tab-badge" data-badge="${k}" hidden></span></button>`).join("")}
    </nav>
    <main class="body"></main>
    <div class="toast" role="status" hidden></div>`;
  const body = app.querySelector(".body");
  app.querySelector('[data-act="out"]').addEventListener("click", () => { ACC.signOut(); location.href = "index.html"; });
  app.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) { tab = b.dataset.tab; selected = null; render(); }
  });

  let toastT = 0;
  function toast(msg, bad) {
    const t = app.querySelector(".toast");
    t.textContent = msg; t.classList.toggle("is-bad", !!bad); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  // runs a staff action, shows the result
  function act(fn, okMsg) {
    try { fn(); toast(okMsg); render(); } catch (err) { toast(err.message, true); }
  }

  function render() {
    app.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"));
    const waiting = A.threads().filter((t) => t.waiting).length;
    const sb = app.querySelector('[data-badge="support"]');
    sb.hidden = !waiting; sb.textContent = waiting;
    if (tab === "players") (selected ? renderPlayer : renderPlayers)();
    else if (tab === "support") renderSupport();
    else if (tab === "staff") renderStaff();
    else renderAudit();
  }

  // ---------------------------------------------------------------------
  // ผู้เล่น: list
  // ---------------------------------------------------------------------
  const tags = (p) => [
    p.staff ? `<span class="tag tag-staff">${esc(A.STAFF_TXT[p.staff])}</span>` : "",
    `<span class="tag">${ROLE[p.role] || p.role}</span>`,
    p.demo ? '<span class="tag tag-soft">บัญชีทดลอง</span>' : "",
    p.ban ? '<span class="tag tag-bad">ถูกแบน</span>' : "",
    p.warnings.some((w) => !w.seen) ? '<span class="tag tag-warn">มีคำเตือนค้าง</span>' : "",
  ].join("");

  function renderPlayers() {
    const all = A.list();
    const FILTERS = [["all", "ทั้งหมด"], ["player", "ผู้เล่น"], ["doctor", "แพทย์"], ["staff", "ทีมงาน"], ["banned", "ถูกแบน"]];
    const q = query.trim().toLowerCase();
    const rows = all.filter((p) =>
      (filter === "all" || (filter === "staff" ? p.staff : filter === "banned" ? p.ban : p.role === filter)) &&
      (!q || p.email.includes(q) || p.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.lastPlay || b.created) - (a.lastPlay || a.created));
    body.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>ฐานข้อมูลผู้เล่น <small>${all.length} บัญชี</small></h2>
          <input class="search" type="search" placeholder="ค้นหาอีเมลหรือชื่อ…" value="${esc(query)}" aria-label="ค้นหา">
        </div>
        <div class="chips">${FILTERS.map(([k, l]) => `<button class="chip ${filter === k ? "is-on" : ""}" data-filter="${k}">${l}</button>`).join("")}</div>
        ${rows.length ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>บัญชี</th><th>สถานะ</th><th class="num">หัวใจ</th><th class="num">เหรียญ</th><th class="num">เล่น</th><th>เล่นล่าสุด</th></tr></thead>
          <tbody>${rows.map((p) => `
            <tr data-email="${esc(p.email)}" tabindex="0">
              <td><b>${esc(p.name)}</b><br><small>${esc(p.email)}</small></td>
              <td>${tags(p)}</td>
              <td class="num">${p.hearts}</td><td class="num">${p.coins}</td><td class="num">${p.plays}</td>
              <td><small>${fmt(p.lastPlay)}</small></td>
            </tr>`).join("")}
          </tbody></table></div>` : '<p class="empty">ไม่พบบัญชี</p>'}
        <p class="note">ตอนนี้ข้อมูลมาจากเครื่องนี้เท่านั้น เมื่อเชื่อมฐานข้อมูล Cloudflare จะเห็นผู้เล่นจากทุกเครื่อง</p>
      </section>`;
    const s = body.querySelector(".search");
    s.addEventListener("input", () => { query = s.value; renderPlayers(); const n = body.querySelector(".search"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    body.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.filter; renderPlayers(); }));
    body.querySelectorAll("tr[data-email]").forEach((tr) => {
      const go = () => { selected = tr.dataset.email; render(); window.scrollTo(0, 0); };
      tr.addEventListener("click", go);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
  }

  // ---------------------------------------------------------------------
  // ผู้เล่น: one account
  // ---------------------------------------------------------------------
  function renderPlayer() {
    const p = A.get(selected);
    if (!p) { selected = null; renderPlayers(); return; }
    const locked = !isAdmin && !!p.staff;          // GMs cannot act on staff accounts
    const self = p.email === me.email;
    const hist = A.history(p.email);
    const wins = hist.filter((h) => h.win).length;
    body.innerHTML = `
      <button class="btn small back" data-act="back">‹ กลับไปรายชื่อ</button>
      <section class="panel">
        <div class="who">
          <div><h2>${esc(p.name)}</h2><p class="mail">${esc(p.email)}</p><div>${tags(p)}</div></div>
          <dl class="facts">
            <div><dt>สมัครเมื่อ</dt><dd>${fmt(p.created, false)}</dd></div>
            <div><dt>เล่นทั้งหมด</dt><dd>${hist.length} ครั้ง (ชนะ ${wins})</dd></div>
            <div><dt>เล่นล่าสุด</dt><dd>${fmt(p.lastPlay)}</dd></div>
          </dl>
        </div>
        ${p.ban ? `<p class="banner bad">ถูกแบน ${p.ban.until === 0 ? "ถาวร" : "ถึง " + fmt(p.ban.until)}${p.ban.reason ? " · เหตุผล: " + esc(p.ban.reason) : ""}</p>` : ""}
        ${locked ? '<p class="banner">บัญชีนี้เป็นทีมงาน GM ดูได้อย่างเดียว แก้ไขไม่ได้</p>' : ""}
      </section>

      <div class="grid">
        <section class="panel">
          <h3>ไอเทมและเงินในเกม</h3>
          <form class="form" data-form="wallet">
            ${stepper("hearts", "หัวใจ (ไอเทม)", p.hearts, [1, 5], locked || !A.can("items"))}
            ${stepper("coins", "เหรียญ (เงินในเกม)", p.coins, [10, 100], locked || !A.can("coins"))}
            <button class="btn is-primary" type="submit" ${locked ? "disabled" : ""}>บันทึก</button>
          </form>
        </section>

        <section class="panel">
          <h3>แก้ไขข้อมูลบัญชี</h3>
          <form class="form" data-form="account">
            <label>ชื่อที่แสดง<input name="name" value="${esc(p.name)}" maxlength="40" ${locked ? "disabled" : ""}></label>
            <label>บทบาท<select name="role" ${locked ? "disabled" : ""}>
              ${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${p.role === k ? "selected" : ""}>${l}</option>`).join("")}
            </select></label>
            <label>ตั้งรหัสผ่านใหม่ <small>(เว้นว่างถ้าไม่เปลี่ยน)</small><input name="password" type="text" autocomplete="off" minlength="${ACC.MIN_PASS}" ${locked ? "disabled" : ""}></label>
            <button class="btn is-primary" type="submit" ${locked ? "disabled" : ""}>บันทึก</button>
          </form>
        </section>

        <section class="panel">
          <h3>เตือนผู้เล่น</h3>
          <form class="form" data-form="warn">
            <label>ข้อความเตือน <small>(ผู้เล่นจะเห็นตอนเข้าเกมครั้งถัดไป)</small><textarea name="text" rows="3" maxlength="300" ${locked || self ? "disabled" : ""}></textarea></label>
            <button class="btn warn" type="submit" ${locked || self ? "disabled" : ""}>ส่งคำเตือน</button>
          </form>
          ${p.warnings.length ? `<ul class="mini-list">${p.warnings.slice().reverse().map((w) => `
            <li><p>${esc(w.text)}</p><small>${fmt(w.t)} · ${w.seen ? "ผู้เล่นรับทราบแล้ว" : "ยังไม่ได้อ่าน"}</small></li>`).join("")}</ul>` : ""}
        </section>

        <section class="panel">
          <h3>แบนผู้เล่น</h3>
          ${p.ban ? `
            <p>บัญชีนี้ถูกแบนอยู่ ${p.ban.until === 0 ? "แบบถาวร" : "ถึง " + fmt(p.ban.until)}</p>
            <button class="btn" data-act="unban" ${locked ? "disabled" : ""}>ยกเลิกแบน</button>
          ` : `
            <form class="form" data-form="ban">
              <label>ระยะเวลา<select name="days" ${locked || self || p.owner ? "disabled" : ""}>
                <option value="1">1 วัน</option><option value="3">3 วัน</option><option value="7" selected>7 วัน</option>
                <option value="30">30 วัน</option><option value="0">ถาวร</option>
              </select></label>
              <label>เหตุผล <small>(ผู้เล่นจะเห็น)</small><input name="reason" maxlength="200" ${locked || self || p.owner ? "disabled" : ""}></label>
              <button class="btn bad" type="submit" ${locked || self || p.owner ? "disabled" : ""}>แบน</button>
            </form>`}
        </section>
      </div>

      <section class="panel">
        <h3>ประวัติการเล่น <small>${hist.length} ครั้ง</small></h3>
        ${hist.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>วันเวลา</th><th>เกม</th><th class="num">ด่าน</th><th>ผล</th><th class="num">ดาว</th><th class="num">เวลา (วิ)</th><th class="num">ผิดพลาด</th></tr></thead>
          <tbody>${hist.map((h) => `<tr>
            <td><small>${fmt(h.t)}</small></td><td>${GAME[h.g] || esc(h.g)}</td><td class="num">${h.lv ?? "—"}</td>
            <td>${h.win ? '<span class="tag tag-good">ผ่าน</span>' : '<span class="tag tag-bad">ไม่ผ่าน</span>'}</td>
            <td class="num">${h.stars ?? 0}</td><td class="num">${h.sec ?? "—"}</td><td class="num">${h.miss ?? 0}</td>
          </tr>`).join("")}</tbody></table></div>` : '<p class="empty">ยังไม่มีประวัติการเล่น</p>'}
      </section>`;

    body.querySelector('[data-act="back"]').addEventListener("click", () => { selected = null; render(); });
    const fWallet = body.querySelector('[data-form="wallet"]');
    fWallet.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (!b) return;
      const input = fWallet.elements[b.dataset.field];
      input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.step));
    });
    fWallet.addEventListener("submit", (e) => {
      e.preventDefault();
      act(() => A.setWallet(p.email, { hearts: Number(fWallet.elements.hearts.value), coins: Number(fWallet.elements.coins.value) }), "บันทึกไอเทมและเงินแล้ว");
    });
    const fAcc = body.querySelector('[data-form="account"]');
    fAcc.addEventListener("submit", (e) => {
      e.preventDefault();
      act(() => A.editAccount(p.email, { name: fAcc.elements.name.value, role: fAcc.elements.role.value, password: fAcc.elements.password.value }), "บันทึกข้อมูลบัญชีแล้ว");
    });
    const fWarn = body.querySelector('[data-form="warn"]');
    fWarn.addEventListener("submit", (e) => { e.preventDefault(); act(() => A.warn(p.email, fWarn.elements.text.value), "ส่งคำเตือนแล้ว"); });
    const fBan = body.querySelector('[data-form="ban"]');
    if (fBan) fBan.addEventListener("submit", (e) => {
      e.preventDefault();
      const days = Number(fBan.elements.days.value);
      if (!confirmInline(fBan, `ยืนยันแบน ${p.email} ${days === 0 ? "ถาวร" : days + " วัน"}?`)) return;
      act(() => A.ban(p.email, days, fBan.elements.reason.value), "แบนแล้ว");
    });
    const unban = body.querySelector('[data-act="unban"]');
    if (unban) unban.addEventListener("click", () => act(() => A.unban(p.email), "ยกเลิกแบนแล้ว"));
  }

  function stepper(field, label, value, steps, disabled) {
    const d = disabled ? "disabled" : "";
    return `<div class="stepper"><span class="stepper-label">${label}</span>
      <div class="stepper-row">
        ${steps.slice().reverse().map((s) => `<button type="button" class="btn small" data-field="${field}" data-step="-${s}" ${d}>−${s}</button>`).join("")}
        <input name="${field}" type="number" min="0" value="${value}" inputmode="numeric" ${d} aria-label="${label}">
        ${steps.map((s) => `<button type="button" class="btn small" data-field="${field}" data-step="${s}" ${d}>+${s}</button>`).join("")}
      </div></div>`;
  }
  // two-step confirm without a browser dialog: the first press arms the button
  function confirmInline(form, text) {
    const btn = form.querySelector('[type="submit"]');
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1";
    btn.textContent = "กดอีกครั้งเพื่อยืนยัน";
    toast(text);
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = "แบน"; } }, 4000);
    return false;
  }

  // ---------------------------------------------------------------------
  // ข้อความ (ติดต่อทีมงาน)
  // ---------------------------------------------------------------------
  function renderSupport() {
    const threads = A.threads();
    if (!openThread && threads.length) openThread = threads[0].email;
    const msgs = openThread ? A.thread(openThread) : [];
    body.innerHTML = `
      <section class="panel support">
        <aside class="threads">
          <h2>คำถามจากผู้เล่น</h2>
          ${threads.length ? threads.map((t) => `
            <button class="thread ${t.email === openThread ? "is-on" : ""}" data-thread="${esc(t.email)}">
              <b>${esc(t.email)}</b>
              <small>${t.last ? esc(t.last.text.slice(0, 40)) : ""}</small>
              ${t.waiting ? '<span class="tag tag-warn">รอตอบ</span>' : '<span class="tag tag-soft">ตอบแล้ว</span>'}
            </button>`).join("") : '<p class="empty">ยังไม่มีคำถาม</p>'}
        </aside>
        <div class="convo">
          ${openThread ? `
            <h3>${esc(openThread)}</h3>
            <div class="msgs">${msgs.map((m) => `
              <div class="msg ${m.staff ? "is-staff" : ""}"><p>${esc(m.text)}</p><small>${m.staff ? "ทีมงาน · " + esc(m.by) + " · " : ""}${fmt(m.t)}</small></div>`).join("")}</div>
            <form class="reply"><input name="text" maxlength="500" placeholder="พิมพ์คำตอบ…" aria-label="คำตอบ" autocomplete="off"><button class="btn is-primary" type="submit">ตอบ</button></form>
          ` : '<p class="empty">เลือกข้อความทางซ้าย</p>'}
        </div>
      </section>`;
    body.querySelectorAll("[data-thread]").forEach((b) => b.addEventListener("click", () => { openThread = b.dataset.thread; renderSupport(); }));
    const m = body.querySelector(".msgs");
    if (m) m.scrollTop = m.scrollHeight;
    const f = body.querySelector(".reply");
    if (f) f.addEventListener("submit", (e) => {
      e.preventDefault();
      try { if (A.reply(openThread, f.elements.text.value)) { render(); body.querySelector(".reply input").focus(); } } catch (err) { toast(err.message, true); }
    });
  }

  // ---------------------------------------------------------------------
  // ทีมงาน GM (แอดมิน only)
  // ---------------------------------------------------------------------
  function renderStaff() {
    const all = A.list();
    const staff = all.filter((p) => p.staff);
    const others = all.filter((p) => !p.staff && !p.ban && !p.demo);
    body.innerHTML = `
      <section class="panel">
        <h2>ทีมงาน</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>บัญชี</th><th>สิทธิ์</th><th></th></tr></thead>
          <tbody>${staff.map((p) => `<tr>
            <td><b>${esc(p.name)}</b><br><small>${esc(p.email)}</small></td>
            <td><span class="tag tag-staff">${esc(A.STAFF_TXT[p.staff])}</span>${p.owner ? ' <span class="tag tag-soft">แอดมินหลัก</span>' : ""}</td>
            <td class="num">${p.owner ? "" : `<button class="btn small bad" data-demote="${esc(p.email)}">ถอด GM</button>`}</td>
          </tr>`).join("")}</tbody></table></div>
      </section>
      <section class="panel">
        <h3>แต่งตั้งผู้เล่นเป็น GM</h3>
        <p class="note">GM ทำได้ทุกอย่างในระบบหลังบ้าน ยกเว้นจัดการ GM คนอื่น และแก้ไขบัญชีทีมงาน</p>
        ${others.length ? `<form class="form row" data-form="promote">
          <select name="email" aria-label="เลือกบัญชี">${others.map((p) => `<option value="${esc(p.email)}">${esc(p.name)} · ${esc(p.email)}</option>`).join("")}</select>
          <button class="btn is-primary" type="submit">แต่งตั้งเป็น GM</button>
        </form>` : '<p class="empty">ไม่มีบัญชีที่แต่งตั้งได้</p>'}
      </section>`;
    body.querySelectorAll("[data-demote]").forEach((b) => b.addEventListener("click", () => act(() => A.setStaff(b.dataset.demote, null), "ถอด GM แล้ว")));
    const f = body.querySelector('[data-form="promote"]');
    if (f) f.addEventListener("submit", (e) => { e.preventDefault(); act(() => A.setStaff(f.elements.email.value, "gm"), "แต่งตั้ง GM แล้ว"); });
  }

  // ---------------------------------------------------------------------
  // บันทึกการทำงาน
  // ---------------------------------------------------------------------
  function renderAudit() {
    const log = A.auditLog();
    body.innerHTML = `
      <section class="panel">
        <h2>บันทึกการทำงานของทีมงาน <small>${log.length} รายการ</small></h2>
        ${log.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>เวลา</th><th>ทีมงาน</th><th>การกระทำ</th><th>บัญชีเป้าหมาย</th><th>รายละเอียด</th></tr></thead>
          <tbody>${log.map((r) => `<tr><td><small>${fmt(r.t)}</small></td><td>${esc(r.by)}</td><td><b>${esc(r.action)}</b></td><td>${esc(r.target)}</td><td><small>${esc(r.detail)}</small></td></tr>`).join("")}</tbody>
        </table></div>` : '<p class="empty">ยังไม่มีรายการ</p>'}
      </section>`;
  }

  // a question sent from the game in another tab: refresh what is on screen (not while typing)
  window.addEventListener("storage", () => {
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing) render();
  });

  render();
})();

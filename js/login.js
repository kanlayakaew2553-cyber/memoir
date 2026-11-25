/* Sign up / Sign in screen (art: assets/login/web, Drive "Login") and the profile chip on home.
 *
 *   - Start on the cover → this screen when nobody is signed in.
 *   - First choose: ผู้เล่น (player) or แพทย์ (doctor) — used when signing up; the rank page
 *     then shows the doctor dashboard or the player page.
 *   - Sign up: email + new password (an email that already has an account is refused).
 *   - Sign in: email + password.
 *   - Home: name + profile picture at the top left; tap for the account menu (sign out).
 */
(() => {
  "use strict";

  const M = window.Memoir;
  const ACC = window.MemoirAccount;
  M.account = ACC;
  const DIR = "assets/login/web/";
  const ROLE_TXT = { player: "ผู้เล่น", doctor: "แพทย์" };

  // =====================================================================
  // Login screen
  // =====================================================================
  const screen = document.createElement("section");
  screen.id = "screen-login";
  screen.className = "screen login-screen";
  screen.setAttribute("aria-label", "เข้าสู่ระบบ");
  screen.innerHTML = `
    <img class="layer" src="assets/cover/web/cover_bg.jpg" alt="" draggable="false">
    <div class="layer login-dim"></div>
    <img class="login-logo" src="assets/cover/web/logo.png" alt="MEMOIR" draggable="false">
    <form class="login-form" novalidate>
      <p class="login-ask">สมัครบัญชีเป็น</p>
      <div class="login-roles" role="radiogroup" aria-label="สมัครเป็น">
        <button type="button" class="login-role" data-role="player" role="radio" aria-checked="false"><img src="assets/icons/web/player.png" alt="" draggable="false">ผู้เล่น</button>
        <button type="button" class="login-role" data-role="doctor" role="radio" aria-checked="false"><img src="assets/icons/web/doctor.png" alt="" draggable="false">แพทย์</button>
      </div>
      <img class="login-art" src="${DIR}frame.png" alt="" style="left:20.09%; top:47.32%; width:59.68%; height:14.82%">
      <img class="login-art login-ph" data-for="email" src="${DIR}username.png" alt="" style="left:24.68%; top:50.16%; width:14.49%; height:1.22%">
      <img class="login-art login-ph" data-for="pass" src="${DIR}pass.png" alt="" style="left:24.68%; top:58.02%; width:11.85%; height:1.41%">
      <input class="login-input" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false"
             aria-label="อีเมล" style="left:22.4%; top:48.5%; width:55%; height:4.9%">
      <input class="login-input" name="pass" type="password" autocomplete="current-password"
             aria-label="รหัสผ่าน" style="left:22.4%; top:56.3%; width:46%; height:4.9%">
      <button type="button" class="login-eye" aria-label="แสดงรหัสผ่าน" style="left:68.6%; top:56.6%; width:9%; height:4.3%"><img src="assets/icons/web/eye_closed.png" alt="" draggable="false"></button>
      <p class="login-hint">Username = อีเมลของคุณ · รหัสผ่านอย่างน้อย ${ACC.MIN_PASS} ตัว</p>
      <button type="button" class="login-btn" data-act="signup" aria-label="สมัครบัญชี (Sign up)" style="left:20.09%; top:64.71%; width:26.39%; height:6.88%">
        <img src="${DIR}btn_signup.png" alt="" draggable="false"></button>
      <button type="submit" class="login-btn" data-act="signin" aria-label="เข้าสู่ระบบ (Sign in)" style="left:53.24%; top:64.56%; width:26.94%; height:7.19%">
        <img src="${DIR}btn_signin.png" alt="" draggable="false"></button>
      <p class="login-sub"><span>สมัครใหม่</span><span>มีบัญชีแล้ว</span></p>
      <p class="login-msg" role="alert"></p>
      <button type="button" class="login-quick" data-act="quick">เข้าเล่นเลย (ไม่ต้องสมัคร) ›</button>
    </form>`;
  document.getElementById("screen-placeholder").before(screen);
  if (M.settings && M.settings.textPicker) M.settings.textPicker(screen);   // ขนาดตัวอักษร at the top

  const form = screen.querySelector(".login-form");
  const email = form.querySelector('[name="email"]');
  const pass = form.querySelector('[name="pass"]');
  const msg = form.querySelector(".login-msg");
  let role = null;

  form.querySelectorAll(".login-role").forEach((b) => b.addEventListener("click", () => {
    role = b.dataset.role;
    form.querySelectorAll(".login-role").forEach((x) => {
      x.classList.toggle("is-on", x === b);
      x.setAttribute("aria-checked", x === b ? "true" : "false");
    });
    say("");
  }));
  // art labels ("Username" / "Password") act as placeholders
  const syncPh = () => form.querySelectorAll(".login-ph").forEach((p) => { p.hidden = !!form.querySelector(`[name="${p.dataset.for}"]`).value; });
  [email, pass].forEach((i) => i.addEventListener("input", () => { syncPh(); i.classList.remove("is-bad"); }));
  form.querySelector(".login-eye").addEventListener("click", (e) => {
    const show = pass.type === "password";
    pass.type = show ? "text" : "password";
    e.currentTarget.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
    e.currentTarget.classList.toggle("is-on", show);
    e.currentTarget.querySelector("img").src = `assets/icons/web/${show ? "eye_open" : "eye_closed"}.png`;
  });

  function say(text, field) {
    msg.textContent = text;
    msg.classList.toggle("is-shown", !!text);
    [email, pass].forEach((i) => i.classList.remove("is-bad"));
    const bad = field === "email" ? email : field === "pass" ? pass : null;
    if (bad) { bad.classList.add("is-bad"); bad.focus(); }
    if (field === "role") form.querySelector(".login-roles").classList.add("is-bad");
    else form.querySelector(".login-roles").classList.remove("is-bad");
  }
  function done(res, welcome) {
    if (!res.ok) { say(res.msg, res.field); return; }
    say("");
    M.toast(welcome);
    try { sessionStorage.setItem("memoir.goHome", "1"); } catch (e) { /* ok */ }
    setTimeout(() => location.reload(), 500);   // load this player's own data
  }
  form.querySelector('[data-act="signup"]').addEventListener("click", () => done(ACC.signUp(email.value, pass.value, role), "สมัครสำเร็จ ยินดีต้อนรับ!"));
  form.addEventListener("submit", (e) => { e.preventDefault(); done(ACC.signIn(email.value, pass.value), "เข้าสู่ระบบแล้ว"); });
  // quick play for presentations: straight in with the demo player account
  form.querySelector('[data-act="quick"]').addEventListener("click", () => done(ACC.enterDemo(), "เข้าเล่นแบบทดลอง"));

  // =====================================================================
  // Profile chip on home (top left, next to hearts and coins) + account menu
  // =====================================================================
  const me = ACC.current;
  if (me) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "profile-chip";
    chip.setAttribute("aria-label", `บัญชี ${me.name}`);
    // profile picture: the player / doctor art (Drive "ผู้เล่น" / "หมอ")
    const pic = `<img src="assets/icons/web/${me.role === "doctor" ? "doctor" : "player"}.png" alt="" draggable="false">`;
    chip.innerHTML = `<span class="profile-pic is-${me.role}">${pic}</span>
      <span class="profile-txt"><b>${esc(me.name)}</b><small>${ROLE_TXT[me.role]}</small></span>`;
    document.getElementById("screen-home").append(chip);

    const menu = document.createElement("div");
    menu.className = "modal profile-modal";
    menu.hidden = true;
    menu.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="บัญชีของฉัน">
      <span class="profile-pic big is-${me.role}">${pic}</span>
      <h2>${esc(me.name)}</h2>
      <p class="profile-mail">${esc(me.email)}</p>
      <p class="profile-role">สมัครเป็น <b>${ROLE_TXT[me.role]}</b>${me.staff ? ` · <b class="profile-staff">${ACC.admin.STAFF_TXT[me.staff]}</b>` : ""}</p>
      <div class="profile-links">
        ${me.staff ? '<button type="button" class="modal-btn profile-office" data-act="office">ระบบหลังบ้าน</button>' : ""}
        <button type="button" class="modal-btn" data-act="support">ติดต่อทีมงาน <span class="support-badge" hidden></span></button>
      </div>
      <div class="modal-buttons">
        <button type="button" class="modal-btn" data-act="out">ออกจากระบบ</button>
        <button type="button" class="modal-btn is-primary" data-act="close">ปิด</button>
      </div></div>`;
    document.getElementById("stage").append(menu);
    const badge = menu.querySelector(".support-badge");
    const chipBadge = document.createElement("span");
    chipBadge.className = "support-badge on-chip";
    chip.append(chipBadge);
    function syncBadge() {
      const n = ACC.supportUnread();
      [badge, chipBadge].forEach((b) => { b.hidden = !n; b.textContent = n; });
    }
    syncBadge();
    chip.addEventListener("click", () => { syncBadge(); menu.hidden = false; });
    menu.addEventListener("click", (e) => { if (e.target === menu) menu.hidden = true; });
    menu.querySelector('[data-act="close"]').addEventListener("click", () => { menu.hidden = true; });
    menu.querySelector('[data-act="out"]').addEventListener("click", () => {
      ACC.signOut();
      location.reload();
    });
    const office = menu.querySelector('[data-act="office"]');
    if (office) office.addEventListener("click", () => { location.href = "admin.html"; });
    menu.querySelector('[data-act="support"]').addEventListener("click", () => { menu.hidden = true; openSupport(); });

    // ---------- ติดต่อทีมงาน: questions to the game team, answered from the back office ----------
    const sup = document.createElement("div");
    sup.className = "modal support-modal";
    sup.hidden = true;
    sup.innerHTML = `<div class="modal-card support-card" role="dialog" aria-modal="true" aria-label="ติดต่อทีมงาน">
      <button type="button" class="shop-x" data-act="close" aria-label="ปิด">✕</button>
      <h2>ติดต่อทีมงาน</h2>
      <p class="support-sub">มีคำถามหรือปัญหาการเล่น พิมพ์ถามได้เลย ทีมงานจะตอบกลับที่นี่</p>
      <div class="support-list" aria-live="polite"></div>
      <form class="support-form"><input type="text" maxlength="500" placeholder="พิมพ์ข้อความ…" aria-label="ข้อความถึงทีมงาน"><button type="submit" class="modal-btn is-primary">ส่ง</button></form>
    </div>`;
    document.getElementById("stage").append(sup);
    const supList = sup.querySelector(".support-list"), supInput = sup.querySelector("input");
    const hhmm = (t) => new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    function renderSupport() {
      const msgs = ACC.supportThread();
      supList.innerHTML = msgs.length
        ? msgs.map((m) => `<div class="support-msg ${m.staff ? "is-staff" : "is-me"}">${m.staff ? "<b>ทีมงาน</b>" : ""}<p>${esc(m.text)}</p><small>${hhmm(m.t)}</small></div>`).join("")
        : '<p class="support-empty">ยังไม่มีข้อความ</p>';
      supList.scrollTop = supList.scrollHeight;
    }
    function openSupport() { renderSupport(); ACC.supportSeen(); syncBadge(); sup.hidden = false; }
    sup.querySelector('[data-act="close"]').addEventListener("click", () => { sup.hidden = true; });
    sup.addEventListener("click", (e) => { if (e.target === sup) sup.hidden = true; });
    sup.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (ACC.postSupport(supInput.value)) { supInput.value = ""; renderSupport(); }
    });
    // replies written in the back office (another tab) show up straight away
    window.addEventListener("storage", () => { syncBadge(); if (!sup.hidden) { renderSupport(); ACC.supportSeen(); } });

    // ---------- คำเตือนจากทีมงาน: shown once, until the player presses "รับทราบ" ----------
    const warns = ACC.myWarnings();
    if (warns.length) {
      const wm = document.createElement("div");
      wm.className = "modal warn-modal";
      wm.innerHTML = `<div class="modal-card warn-card" role="alertdialog" aria-modal="true" aria-label="คำเตือนจากทีมงาน">
        <h2>คำเตือนจากทีมงาน</h2>
        ${warns.map((w) => `<p class="warn-text">${esc(w.text)}</p><small class="warn-when">${hhmm(w.t)}</small>`).join("")}
        <div class="modal-buttons"><button type="button" class="modal-btn is-primary">รับทราบ</button></div>
      </div>`;
      document.getElementById("stage").append(wm);
      wm.querySelector("button").addEventListener("click", () => { ACC.ackWarnings(); wm.remove(); });
    }
  }

  // Signed out because of a ban: say why
  const banNote = ACC.takeBanNote();
  if (banNote) {
    const bm = document.createElement("div");
    bm.className = "modal warn-modal";
    bm.innerHTML = `<div class="modal-card warn-card" role="alertdialog" aria-modal="true" aria-label="บัญชีถูกระงับ">
      <h2>บัญชีถูกระงับ</h2><p class="warn-text"></p>
      <div class="modal-buttons"><button type="button" class="modal-btn is-primary">ตกลง</button></div></div>`;
    bm.querySelector(".warn-text").textContent = banNote;
    document.getElementById("stage").append(bm);
    bm.querySelector("button").addEventListener("click", () => bm.remove());
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // Just signed in / up: go straight to home
  try {
    if (sessionStorage.getItem("memoir.goHome") && me) { sessionStorage.removeItem("memoir.goHome"); M.showScreen("screen-home"); }
  } catch (e) { /* ok */ }
})();

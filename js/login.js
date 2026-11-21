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
        <button type="button" class="login-role" data-role="player" role="radio" aria-checked="false"><span>🙂</span>ผู้เล่น</button>
        <button type="button" class="login-role" data-role="doctor" role="radio" aria-checked="false"><span>🩺</span>แพทย์</button>
      </div>
      <img class="login-art" src="${DIR}frame.png" alt="" style="left:20.09%; top:47.32%; width:59.68%; height:14.82%">
      <img class="login-art login-ph" data-for="email" src="${DIR}username.png" alt="" style="left:24.68%; top:50.16%; width:14.49%; height:1.22%">
      <img class="login-art login-ph" data-for="pass" src="${DIR}pass.png" alt="" style="left:24.68%; top:58.02%; width:11.85%; height:1.41%">
      <input class="login-input" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false"
             aria-label="อีเมล" style="left:22.4%; top:48.5%; width:55%; height:4.9%">
      <input class="login-input" name="pass" type="password" autocomplete="current-password"
             aria-label="รหัสผ่าน" style="left:22.4%; top:56.3%; width:46%; height:4.9%">
      <button type="button" class="login-eye" aria-label="แสดงรหัสผ่าน" style="left:68.6%; top:56.6%; width:9%; height:4.3%">👁</button>
      <p class="login-hint">Username = อีเมลของคุณ · รหัสผ่านอย่างน้อย ${ACC.MIN_PASS} ตัว</p>
      <button type="button" class="login-btn" data-act="signup" aria-label="สมัครบัญชี (Sign up)" style="left:20.09%; top:64.71%; width:26.39%; height:6.88%">
        <img src="${DIR}btn_signup.png" alt="" draggable="false"></button>
      <button type="submit" class="login-btn" data-act="signin" aria-label="เข้าสู่ระบบ (Sign in)" style="left:53.24%; top:64.56%; width:26.94%; height:7.19%">
        <img src="${DIR}btn_signin.png" alt="" draggable="false"></button>
      <p class="login-sub"><span>สมัครใหม่</span><span>มีบัญชีแล้ว</span></p>
      <p class="login-msg" role="alert"></p>
    </form>`;
  document.getElementById("screen-placeholder").before(screen);

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

  // =====================================================================
  // Profile chip on home (top left, next to hearts and coins) + account menu
  // =====================================================================
  const me = ACC.current;
  if (me) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "profile-chip";
    chip.setAttribute("aria-label", `บัญชี ${me.name}`);
    chip.innerHTML = `<span class="profile-pic is-${me.role}">${me.role === "doctor" ? "🩺" : esc(me.name.charAt(0).toUpperCase())}</span>
      <span class="profile-txt"><b>${esc(me.name)}</b><small>${ROLE_TXT[me.role]}</small></span>`;
    document.getElementById("screen-home").append(chip);

    const menu = document.createElement("div");
    menu.className = "modal profile-modal";
    menu.hidden = true;
    menu.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="บัญชีของฉัน">
      <span class="profile-pic big is-${me.role}">${me.role === "doctor" ? "🩺" : esc(me.name.charAt(0).toUpperCase())}</span>
      <h2>${esc(me.name)}</h2>
      <p class="profile-mail">${esc(me.email)}</p>
      <p class="profile-role">สมัครเป็น <b>${ROLE_TXT[me.role]}</b></p>
      <div class="modal-buttons">
        <button type="button" class="modal-btn" data-act="out">ออกจากระบบ</button>
        <button type="button" class="modal-btn is-primary" data-act="close">ปิด</button>
      </div></div>`;
    document.getElementById("stage").append(menu);
    chip.addEventListener("click", () => { menu.hidden = false; });
    menu.addEventListener("click", (e) => { if (e.target === menu) menu.hidden = true; });
    menu.querySelector('[data-act="close"]').addEventListener("click", () => { menu.hidden = true; });
    menu.querySelector('[data-act="out"]').addEventListener("click", () => {
      ACC.signOut();
      location.reload();
    });
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // Just signed in / up: go straight to home
  try {
    if (sessionStorage.getItem("memoir.goHome") && me) { sessionStorage.removeItem("memoir.goHome"); M.showScreen("screen-home"); }
  } catch (e) { /* ok */ }
})();

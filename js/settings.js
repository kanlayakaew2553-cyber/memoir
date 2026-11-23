/* Settings (ตั้งค่า): the gear at the top right of the home screen (art: Drive "หน้าปก_ฟันเฟือง").
 *   - กราฟิก: 2D / 3D                       (js/theme.js)
 *   - ระดับเสียง: − / + in 5 steps, 0 = mute  (Memoir.sound.setVolume)
 *   - ขนาดตัวอักษร: slider 18–80              (→ --ts 1–1.6 on <html>, used by css/style.css)
 * Volume and text size are saved per account (localStorage, redirected by js/userstore.js).
 */
(() => {
  "use strict";

  const M = window.Memoir;
  const KEY = "memoir.settings.v1";
  const VOL_STEPS = [0, 0.25, 0.5, 0.75, 1];
  // Text size slider 18–80. 18 = the original size, 80 = the biggest every screen is laid out for.
  const SIZE_MIN = 18, SIZE_MAX = 80, SIZE_DEFAULT = 34, TS_MAX = 1.6;
  const tsOf = (n) => 1 + (n - SIZE_MIN) / (SIZE_MAX - SIZE_MIN) * (TS_MAX - 1);
  const clampSize = (n) => Math.round(Math.max(SIZE_MIN, Math.min(SIZE_MAX, Number(n) || SIZE_DEFAULT)));
  const OLD = { m: 18, l: 34, xl: 51 };   // the earlier กลาง / ใหญ่ / ใหญ่มาก buttons
  const root = document.documentElement;

  const sliders = new Set();
  let st = { vol: 1, size: SIZE_DEFAULT };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) || {};
    if (saved.size == null && OLD[saved.text]) saved.size = OLD[saved.text];
    delete saved.text;
    st = Object.assign(st, saved);
  } catch (e) { /* storage off */ }
  st.size = clampSize(st.size);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage off */ } }

  // A size picked on the login screen (before any account) carries into the account entered next.
  const PICK = "memoir-text-pick";   // sessionStorage: not redirected per account
  try {
    const pick = sessionStorage.getItem(PICK);
    if (pick && window.MemoirAccount && window.MemoirAccount.current) {
      st.size = clampSize(pick); save(); sessionStorage.removeItem(PICK);
    }
  } catch (e) { /* storage off */ }

  function applyAll() {
    if (M.sound) M.sound.setVolume(st.vol);
    root.style.setProperty("--ts", tsOf(st.size).toFixed(3));
  }
  applyAll();

  // ---------- gear button on home ----------
  const gear = document.createElement("button");
  gear.type = "button";
  gear.className = "settings-btn";
  gear.setAttribute("aria-label", "ตั้งค่า");
  gear.innerHTML = '<img src="assets/hud/web/gear.png" alt="" draggable="false">';
  gear.addEventListener("click", () => open());
  document.getElementById("screen-home").append(gear);

  // ---------- popup ----------
  const modal = document.createElement("div");
  modal.className = "modal settings-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" class="shop-x settings-x" aria-label="ปิด">✕</button>
      <div class="settings-head"><span class="settings-gear"><img src="assets/hud/web/gear.png" alt=""></span><h2 id="settings-title">ตั้งค่า</h2></div>

      <section class="settings-row is-inline">
        <h3>กราฟิก</h3>
        <div class="settings-seg" data-k="look" role="group" aria-label="กราฟิก">
          <button type="button" data-v="2d">2D</button><button type="button" data-v="3d">3D</button>
        </div>
      </section>

      <section class="settings-row">
        <h3>ระดับเสียง</h3>
        <div class="settings-vol">
          <button type="button" class="settings-step" data-d="-1" aria-label="ลดเสียง">−</button>
          <div class="settings-bars" aria-hidden="true">${VOL_STEPS.slice(1).map(() => "<i></i>").join("")}</div>
          <button type="button" class="settings-step" data-d="1" aria-label="เพิ่มเสียง">+</button>
        </div>
        <p class="settings-note" data-v="vol"></p>
      </section>

      <section class="settings-row">
        <h3>ขนาดตัวอักษร</h3>
        ${sliderHTML()}
        <p class="settings-note">ตัวอย่าง: <span class="settings-sample">ยินดีต้อนรับสู่ MEMOIR</span></p>
      </section>

      <button type="button" class="modal-btn is-primary settings-done">เสร็จแล้ว</button>
    </div>`;
  document.getElementById("stage").append(modal);
  const $ = (s) => modal.querySelector(s);

  function render() {
    const look = M.look ? M.look.get() : "2d";
    $('[data-k="look"]').querySelectorAll("button").forEach((b) => mark(b, b.dataset.v === look));
    syncSliders();
    const idx = VOL_STEPS.indexOf(st.vol);
    modal.querySelectorAll(".settings-bars i").forEach((bar, i) => bar.classList.toggle("is-on", i < idx));
    $('[data-v="vol"]').textContent = st.vol === 0 ? "ปิดเสียง" : `${Math.round(st.vol * 100)}%`;
    $('[data-d="-1"]').disabled = idx <= 0;
    $('[data-d="1"]').disabled = idx >= VOL_STEPS.length - 1;
  }
  function mark(b, on) { b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }

  $('[data-k="look"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !M.look) return;
    M.look.set(b.dataset.v);
    render();
  });
  wireSlider(modal.querySelector(".ts-slider"), false);
  modal.querySelectorAll(".settings-step").forEach((b) => b.addEventListener("click", () => {
    const i = Math.max(0, Math.min(VOL_STEPS.length - 1, VOL_STEPS.indexOf(st.vol) + Number(b.dataset.d)));
    st.vol = VOL_STEPS[i]; save(); applyAll(); render();
    if (M.sound && st.vol > 0) setTimeout(() => M.sound.play("click"), 30);   // hear the new level
  }));

  function open() { render(); modal.hidden = false; }
  function close() { modal.hidden = true; }
  $(".settings-x").addEventListener("click", close);
  $(".settings-done").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  // ---------- the text-size slider (Settings popup + login screen) ----------
  function sliderHTML() {
    return `<div class="ts-slider">
      <span class="ts-a ts-small" aria-hidden="true">ก</span>
      <input type="range" min="${SIZE_MIN}" max="${SIZE_MAX}" step="1" aria-label="ขนาดตัวอักษร">
      <span class="ts-a ts-big" aria-hidden="true">ก</span>
      <output class="ts-num"></output>
    </div>`;
  }
  function syncSliders() {
    sliders.forEach((s) => {
      const input = s.querySelector("input");
      if (Number(input.value) !== st.size) input.value = st.size;
      s.querySelector(".ts-num").textContent = st.size;
      s.style.setProperty("--fill", ((st.size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN) * 100) + "%");
      input.setAttribute("aria-valuetext", `ขนาด ${st.size}`);
    });
  }
  function wireSlider(s, fromLogin) {
    sliders.add(s);
    const input = s.querySelector("input");
    input.value = st.size;
    // the text grows while the finger slides; saved when let go
    input.addEventListener("input", () => { st.size = clampSize(input.value); applyAll(); syncSliders(); });
    input.addEventListener("change", () => {
      st.size = clampSize(input.value); save(); applyAll(); syncSliders();
      if (fromLogin) { try { sessionStorage.setItem(PICK, String(st.size)); } catch (err) { /* storage off */ } }
    });
    syncSliders();
  }

  // login screen: same slider at the top (called by js/login.js once it has built the screen)
  function textPicker(login) {
    const bar = document.createElement("div");
    bar.className = "login-textsize";
    bar.innerHTML = `<span class="login-textsize-label">ขนาดตัวอักษร</span>${sliderHTML()}`;
    login.append(bar);
    wireSlider(bar.querySelector(".ts-slider"), true);
    return bar;
  }

  M.settings = { open, textPicker };
})();

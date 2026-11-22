/* Settings (ตั้งค่า): the gear at the top right of the home screen (art: Drive "หน้าปก_ฟันเฟือง").
 *   - กราฟิก: 2D / 3D                       (js/theme.js)
 *   - ระดับเสียง: − / + in 5 steps, 0 = mute  (Memoir.sound.setVolume)
 *   - ขนาดตัวอักษร: กลาง / ใหญ่ / ใหญ่มาก     (html[data-text] → --ts in css/style.css)
 * Volume and text size are saved per account (localStorage, redirected by js/userstore.js).
 */
(() => {
  "use strict";

  const M = window.Memoir;
  const KEY = "memoir.settings.v1";
  const VOL_STEPS = [0, 0.25, 0.5, 0.75, 1];
  const TEXT = [["m", "กลาง"], ["l", "ใหญ่"], ["xl", "ใหญ่มาก"]];
  const root = document.documentElement;

  let st = { vol: 1, text: "l" };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage off */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage off */ } }

  function applyAll() {
    if (M.sound) M.sound.setVolume(st.vol);
    root.dataset.text = TEXT.some(([k]) => k === st.text) ? st.text : "l";
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

      <section class="settings-row">
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
        <div class="settings-seg settings-text" data-k="text" role="group" aria-label="ขนาดตัวอักษร">
          ${TEXT.map(([k, label]) => `<button type="button" data-v="${k}"><b class="ts-${k}">ก</b><span>${label}</span></button>`).join("")}
        </div>
        <p class="settings-note">ตัวอย่าง: <span class="settings-sample">ยินดีต้อนรับสู่ MEMOIR</span></p>
      </section>

      <button type="button" class="modal-btn is-primary settings-done">เสร็จแล้ว</button>
    </div>`;
  document.getElementById("stage").append(modal);
  const $ = (s) => modal.querySelector(s);

  function render() {
    const look = M.look ? M.look.get() : "2d";
    $('[data-k="look"]').querySelectorAll("button").forEach((b) => mark(b, b.dataset.v === look));
    $('[data-k="text"]').querySelectorAll("button").forEach((b) => mark(b, b.dataset.v === st.text));
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
  $('[data-k="text"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    st.text = b.dataset.v; save(); applyAll(); render();
  });
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

  M.settings = { open };
})();

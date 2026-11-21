/* Graphics style: 2D (the drawn art as it is) or 3D (the same art given depth in code:
 * thickness under every drawn piece, soft lifted shadows, light from above, buttons that press
 * down, popups that tilt in). The look lives in css/style.css under "html.is-3d".
 *
 * Switch: the "2D | 3D" pill on the home screen. Saved per account.
 */
(() => {
  "use strict";

  const KEY = "memoir.look.v1";
  const root = document.documentElement;
  let look = "2d";
  try { look = localStorage.getItem(KEY) === "3d" ? "3d" : "2d"; } catch (e) { /* storage off */ }

  function apply(v) {
    look = v;
    root.classList.toggle("is-3d", v === "3d");
    try { localStorage.setItem(KEY, v); } catch (e) { /* storage off */ }
    sw.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.look === v;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  const sw = document.createElement("div");
  sw.className = "look-switch";
  sw.setAttribute("role", "group");
  sw.setAttribute("aria-label", "รูปแบบกราฟิก");
  sw.innerHTML = '<span class="look-cap">กราฟิก</span><button type="button" data-look="2d">2D</button><button type="button" data-look="3d">3D</button>';
  sw.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.dataset.look === look) return;
    apply(b.dataset.look);
    if (window.Memoir && window.Memoir.toast) window.Memoir.toast(look === "3d" ? "เปลี่ยนเป็นกราฟิก 3 มิติแล้ว" : "เปลี่ยนเป็นกราฟิก 2 มิติแล้ว");
  });
  document.getElementById("screen-home").append(sw);

  apply(look);
  if (window.Memoir) window.Memoir.look = { get: () => look, set: apply };
})();

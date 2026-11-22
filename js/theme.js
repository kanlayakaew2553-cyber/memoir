/* Graphics style: 2D (the drawn art as it is) or 3D (the same art given depth in code:
 * thickness under every drawn piece, soft lifted shadows, light from above, buttons that press
 * down, popups that tilt in). The look lives in css/style.css under "html.is-3d".
 *
 * Changed from the Settings popup (js/settings.js). Saved per account.
 */
(() => {
  "use strict";

  const KEY = "memoir.look.v1";
  const root = document.documentElement;
  let look = "2d";
  try { look = localStorage.getItem(KEY) === "3d" ? "3d" : "2d"; } catch (e) { /* storage off */ }

  function apply(v) {
    look = v === "3d" ? "3d" : "2d";
    root.classList.toggle("is-3d", look === "3d");
    try { localStorage.setItem(KEY, look); } catch (e) { /* storage off */ }
  }

  apply(look);
  if (window.Memoir) window.Memoir.look = { get: () => look, set: apply };
})();

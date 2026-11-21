/* Game sounds (Drive "Sound"): assets/sound/
 *   click.mp3 – every button press (not the game pieces themselves: records play notes)
 *   win.mp3   – level won; its 3 chimes are when the stars pop in (STAR_TIMES)
 *   lose.mp3  – level lost, in every game
 * Uses Web Audio for instant, overlapping playback; falls back to <audio> if needed.
 * Exposes window.Memoir.sound = { play(name), STAR_TIMES }.
 */
(() => {
  "use strict";

  const FILES = { click: "assets/sound/click.mp3", win: "assets/sound/win.mp3", lose: "assets/sound/lose.mp3" };
  const VOLUME = { click: 1, win: 0.9, lose: 0.85 };
  // seconds into win.mp3 where its three star chimes ring (measured from the file)
  const STAR_TIMES = [0.41, 0.90, 1.41];

  let ac = null;
  const buffers = {};
  const fallback = {};
  function ctx() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      Object.entries(FILES).forEach(([k, url]) => {
        fetch(url).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((buf) => { buffers[k] = buf; }).catch(() => {});
      });
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  function play(name) {
    const a = ctx();
    if (a && buffers[name]) {
      const src = a.createBufferSource(), g = a.createGain();
      src.buffer = buffers[name];
      g.gain.value = VOLUME[name] ?? 1;
      src.connect(g); g.connect(a.destination);
      src.start();
      return;
    }
    // not decoded yet (first moments) or no Web Audio: plain audio element
    try {
      const el = (fallback[name] = fallback[name] || new Audio(FILES[name]));
      const node = el.paused ? el : el.cloneNode();
      node.volume = VOLUME[name] ?? 1;
      node.currentTime = 0;
      node.play().catch(() => {});
    } catch (e) { /* no sound */ }
  }

  // Click on every button in the game (finger, pen, mouse or keyboard).
  // Phones / tablets only allow sound to start when the finger is lifted (not when it touches
  // down), so touch plays on pointerup; a mouse plays on press for a snappier feel.
  const CLICKABLE = "button, .hit-area, [role='button']";
  function clickable(e) {
    const b = e.target && e.target.closest && e.target.closest(CLICKABLE);
    return b && !b.disabled && !b.classList.contains("rec") ? b : null;   // records play their own notes
  }
  document.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && clickable(e)) play("click"); }, true);
  document.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse" && clickable(e)) play("click"); }, true);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat && clickable(e)) play("click");
  }, true);
  // Unlock sound on every finished tap / click / key press (some phones need it more than once)
  ["pointerup", "touchend", "click", "keydown"].forEach((t) => document.addEventListener(t, () => ctx(), { capture: true, passive: true }));

  window.Memoir.sound = { play, STAR_TIMES };
})();

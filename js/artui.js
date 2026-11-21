/* Shared in-game art UI (top bar, exit popup, win popup, plain popup) used by every mini-game.
 * Art: assets/ui/web, positions from assets/ui/web/ui.json (tools/prep_ui.ps1).
 * Exposes window.Memoir.artUI.
 */
(() => {
  "use strict";

  const UI_DIR = "assets/ui/web/";
  // Box of each piece in % of the 9:16 canvas
  const UI = {
    top_back:          { x: 3.24,  y: 2.76,  w: 10.09, h: 4.17 },    // "กลับ" arrow (in-game exit + level screens)
    top_level:         { x: 31.57, y: 0.21,  w: 27.96, h: 7.60 },    // TV-shaped "ด่าน" box
    top_seconds:       { x: 76.85, y: 0.21,  w: 22.22, h: 15.36 },   // "วิ" box with 3 stars drawn in
    top_star_empty:    { x: 82.04, y: 8.12,  w: 12.78, h: 2.40 },
    top_star_full:     { x: 82.04, y: 8.12,  w: 12.78, h: 2.40 },
    // Start banner: drawn at x 15.74 / w 71.11, shrunk here so it stays left of the taller "วิ" box
    memorize_start:    { x: 12.5,  y: 10.0,  w: 62.5,  h: 9.1 },
    memorize_count:    { x: 12.5,  y: 10.0,  w: 62.5,  h: 9.1 },     // same banner with "เริ่ม" painted out
    wrong_minus10:     { x: 7.96,  y: 73.44, w: 89.54, h: 22.55 },   // red burst "จิ้มผิดถูกหัก"
    exit_panel:        { x: 12.41, y: 24.22, w: 77.59, h: 47.66 },
    exit_btn_exit:     { x: 34.54, y: 49.64, w: 35.65, h: 7.97 },
    exit_btn_continue: { x: 34.54, y: 58.07, w: 35.65, h: 7.97 },
    win_panel:         { x: 12.41, y: 18.02, w: 77.59, h: 60.99 },
    win_title:         { x: 4.17,  y: 8.49,  w: 44.26, h: 20.78 },
    win_stars:         { x: 28.52, y: 26.77, w: 47.13, h: 7.66 },
    win_time:          { x: 39.54, y: 35.26, w: 24.17, h: 2.76 },
    win_no_miss:       { x: 40.56, y: 39.27, w: 23.89, h: 3.59 },
    win_few_miss:      { x: 43.24, y: 39.58, w: 20.46, h: 3.02 },
    win_coins:         { x: 40.65, y: 44.58, w: 24.63, h: 3.12 },
    win_btn_next:      { x: 34.54, y: 49.64, w: 35.65, h: 7.97 },
    win_btn_replay:    { x: 34.54, y: 58.07, w: 35.65, h: 7.97 },
    win_btn_levels:    { x: 34.54, y: 66.67, w: 35.65, h: 8.02 },
  };
  // Where numbers are written onto the art: centre point in % of the canvas
  const NUM = {
    level: { x: 47.0, y: 5.0 },    // after "ด่าน" on the TV screen
    time:  { x: 85.2, y: 5.3 },    // left of "วิ"
    count: { x: 62.2, y: 14.55 },  // where "เริ่ม" is on the banner
  };

  function place(el, box) {
    Object.assign(el.style, { left: box.x + "%", top: box.y + "%", width: box.w + "%", height: box.h + "%" });
    return el;
  }
  function img(src) {
    const i = document.createElement("img");
    i.src = src;
    i.alt = "";
    i.draggable = false;
    return i;
  }
  function uiImg(name, parent, cls) {
    const i = img(UI_DIR + name + ".png");
    i.className = "ui-piece" + (cls ? " " + cls : "");
    parent.appendChild(place(i, UI[name]));
    return i;
  }
  function uiBtn(name, parent, label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ui-piece ui-btn";
    btn.setAttribute("aria-label", label);
    btn.appendChild(img(UI_DIR + name + ".png"));
    btn.addEventListener("click", onClick);
    parent.appendChild(place(btn, UI[name]));
    return btn;
  }
  function uiNum(key, parent, cls) {
    const s = document.createElement("span");
    s.className = "ui-num " + cls;
    s.style.left = NUM[key].x + "%";
    s.style.top = NUM[key].y + "%";
    parent.appendChild(s);
    return s;
  }
  // "ใช้เวลา __ วินาที": art split at the blank (<name>_left/_right.png), laid out as [text][number][text]
  function uiLine(name, parent) {
    const box = UI[name];
    const row = document.createElement("div");
    row.className = "ui-line";
    Object.assign(row.style, { top: box.y + "%", height: box.h + "%", left: (box.x + box.w / 2 - 50) + "%" });
    const num = document.createElement("span");
    num.className = "ui-line-num";
    row.append(img(`${UI_DIR}${name}_left.png`), num, img(`${UI_DIR}${name}_right.png`));
    parent.appendChild(row);
    return num;
  }
  function layer(parent, cls) {
    const d = document.createElement("div");
    d.className = "ui-layer " + cls;
    parent.appendChild(d);
    return d;
  }
  // Show only the first n of 3 stars drawn side by side in one image.
  // center: shift what is left so the visible stars stay centred (win popup).
  function showStars(el, n, center) {
    el.style.clipPath = n >= 3 ? "none" : `inset(0 ${100 - n * 100 / 3}% 0 0)`;
    if (center) el.style.translate = `${(3 - n) * 100 / 6}% 0`;
  }

  // ---------- Ready-made blocks ----------

  // Top bar: "กลับ" button (asks before leaving), "ด่าน N", and either the "วิ" timer box
  // (its 3 stars are drawn in the art) or, for games without a timer, a row of stars.
  function topBar(root, { onExit, timer = true }) {
    const hud = layer(root, "ui-hud");
    uiBtn("top_back", hud, "ออกจากด่าน", onExit);
    uiImg("top_level", hud);
    const levelNum = uiNum("level", hud, "num-level");
    let timerBox = null, timeNum = null, setStars;
    if (timer) {
      timerBox = uiImg("top_seconds", hud);
      timeNum = uiNum("time", hud, "num-time");
      // Lost stars: cover the drawn stars from the right with empty stars
      const empty = uiImg("top_star_empty", hud);
      setStars = (n) => { empty.style.clipPath = `inset(0 0 0 ${Math.min(3, n) * 100 / 3}%)`; empty.hidden = n >= 3; };
    } else {
      uiImg("top_star_empty", hud);
      const full = uiImg("top_star_full", hud);
      setStars = (n) => showStars(full, n);
    }
    return {
      el: hud,
      setLevel: (n) => { levelNum.textContent = n; },
      setTime: (s) => { if (timeNum) timeNum.textContent = s; },
      setLow: (on) => { if (timeNum) { timeNum.classList.toggle("is-low", on); timerBox.classList.toggle("is-low", on); } },
      setStars,
    };
  }

  // "ออกจากด่านนี้?" popup
  function exitPopup(root, { onExit, onContinue }) {
    const pop = layer(root, "ui-popup");
    pop.hidden = true;
    uiImg("exit_panel", pop);
    uiBtn("exit_btn_exit", pop, "ออก", onExit);
    uiBtn("exit_btn_continue", pop, "เล่นต่อ", onContinue);
    return pop;
  }

  // "ผ่าน! เก่งมาก" popup
  function winPopup(root, { onNext, onReplay, onLevels }) {
    const pop = layer(root, "ui-popup");
    pop.hidden = true;
    uiImg("win_panel", pop);
    uiImg("win_title", pop, "pop-in");
    const stars = uiImg("win_stars", pop);
    const timeNum = uiLine("win_time", pop);
    const noMiss = uiImg("win_no_miss", pop);
    const fewMiss = uiImg("win_few_miss", pop);
    const coinsNum = uiLine("win_coins", pop);
    const next = uiBtn("win_btn_next", pop, "ด่านต่อไป", onNext);
    uiBtn("win_btn_replay", pop, "เล่นอีกครั้ง", onReplay);
    uiBtn("win_btn_levels", pop, "เลือกด่าน", onLevels);
    return {
      el: pop,
      // Until the empty-star art arrives, only the earned stars are shown (centred)
      fill({ stars: n, seconds, misses, coins, hasNext }) {
        showStars(stars, n, true);
        timeNum.textContent = seconds;
        noMiss.hidden = misses > 0;
        fewMiss.hidden = misses === 0;
        coinsNum.textContent = coins;
        next.hidden = !hasNext;
      },
    };
  }

  // Plain popup (for screens whose art has not arrived yet, e.g. time-out / lost)
  function plainPopup(modal, card, { title, lines = [], buttons = [] }) {
    card.innerHTML =
      `<h2>${title}</h2>` +
      lines.map((l) => `<p>${l}</p>`).join("") +
      `<div class="modal-buttons"></div>`;
    const box = card.querySelector(".modal-buttons");
    buttons.filter(Boolean).forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "modal-btn" + (b.primary ? " is-primary" : "");
      btn.textContent = b.label;
      btn.addEventListener("click", b.onClick);
      box.appendChild(btn);
    });
    modal.hidden = false;
  }

  window.Memoir.artUI = {
    UI, NUM, place, uiImg, uiBtn, uiNum, uiLine, layer, showStars,
    topBar, exitPopup, winPopup, plainPopup,
  };
})();

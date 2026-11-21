/* How to play (วิธีเล่น): a popup with a short looping demo made from each game's own art,
 * a pointing finger that plays it, and 3 short steps.
 *
 *   - Shown by itself every time level 1 of a game is started from the level map.
 *   - "?" button on each game's level map (shows that game).
 *   - Frame: assets/ui/web/win_panel.png (Drive "ผ่านแล้ว_กรอบหลัง"); X at the top right closes it.
 */
(() => {
  "use strict";

  const M = window.Memoir;
  const SEEN_KEY = "memoir.howto.v1";
  const seenData = (() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch (e) { return {}; } })();
  const seen = (g) => !!seenData[g];
  function markSeen(g) { seenData[g] = true; try { localStorage.setItem(SEEN_KEY, JSON.stringify(seenData)); } catch (e) { /* storage off */ } }

  const GAMES = {
    decor: {
      title: "หาสิ่งผิดปกติในบ้าน",
      steps: ["จำของในห้องไว้ให้ดี 5 วินาที", "ของ 1 ชิ้นจะค่อยๆ เปลี่ยนสีหรือขนาด", "เห็นแล้วแตะที่ของชิ้นนั้นเลย ยิ่งเร็วยิ่งได้ดาวเยอะ"],
      demo: demoDecor,
    },
    melody: {
      title: "สร้างดนตรีและเสียงเพลง",
      steps: ["ฟังเพลงและดูแผ่นเสียงที่สว่างขึ้น", "แตะแผ่นเสียงตามลำดับเดิม ภายใน 10 วินาที", "แต่ละรอบเพลงจะยาวขึ้นทีละโน้ต"],
      demo: demoMelody,
    },
    market: {
      title: "ตลาดนัดเก็บผักผลไม้",
      steps: ["จำรายการผลไม้และจำนวนที่ต้องเก็บ", "ลากผลไม้ไปซ้าย-ขวา แล้วปล่อยลงตะกร้า", "ผลไม้เหมือนกัน 3 ลูกติดกัน = เก็บได้ 1 ชิ้น"],
      demo: demoMarket,
    },
  };
  const ORDER = ["melody", "decor", "market"];   // same order as the game-select page

  // =====================================================================
  // Popup
  // =====================================================================
  const modal = document.createElement("div");
  modal.className = "howto";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="howto-card" role="dialog" aria-modal="true" aria-labelledby="howto-title">
      <img class="howto-frame" src="assets/ui/web/win_panel.png" alt="" draggable="false">
      <button type="button" class="howto-x" aria-label="ปิด">✕</button>
      <div class="howto-body">
        <h2 id="howto-title" class="howto-title">วิธีเล่น</h2>
        <div class="howto-tabs" role="tablist"></div>
        <div class="howto-demo" aria-hidden="true"></div>
        <ol class="howto-steps"></ol>
        <button type="button" class="howto-go"></button>
      </div>
    </div>`;
  document.getElementById("stage").append(modal);
  const $ = (s) => modal.querySelector(s);
  const demoBox = $(".howto-demo"), tabs = $(".howto-tabs"), steps = $(".howto-steps"), go = $(".howto-go"), title = $(".howto-title");

  let current = null, stopDemo = null, onDone = null, firstGame = null;

  function show(game) {
    current = game;
    const g = GAMES[game];
    title.textContent = g.title;
    steps.innerHTML = g.steps.map((s) => `<li>${s}</li>`).join("");
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.g === game));
    if (stopDemo) stopDemo();
    demoBox.innerHTML = "";
    stopDemo = g.demo(demoBox);
  }

  // open(game) — one game; open(null) — all games with tabs
  function open(game, opts = {}) {
    onDone = opts.onDone || null;
    firstGame = opts.first ? game : null;
    tabs.innerHTML = "";
    tabs.hidden = !!game;
    if (!game) {
      ORDER.forEach((k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.g = k;
        b.textContent = { melody: "ดนตรี", decor: "บ้าน", market: "ตลาด" }[k];
        b.addEventListener("click", () => show(k));
        tabs.append(b);
      });
    }
    go.textContent = opts.first ? "เริ่มเล่นเลย" : "เข้าใจแล้ว";
    modal.hidden = false;
    show(game || ORDER[0]);
    go.focus({ preventScroll: true });
  }
  function close() {
    modal.hidden = true;
    if (stopDemo) { stopDemo(); stopDemo = null; }
    demoBox.innerHTML = "";
    if (firstGame) markSeen(firstGame);
    const cb = onDone;
    onDone = null; firstGame = null;
    if (cb) cb();
  }
  $(".howto-x").addEventListener("click", close);
  go.addEventListener("click", close);
  modal.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Before a level starts from the level map: level 1 always shows how to play first
  // (other levels never do); the level starts when the popup closes.
  function beforeLevel(game, level, startFn) {
    if (level !== 1 || !GAMES[game]) return false;
    open(game, { first: true, onDone: startFn });
    return true;
  }

  // =====================================================================
  // Demo helpers: a tiny timeline that loops until the popup closes
  // =====================================================================
  function el(tag, cls, parent, style) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (parent) parent.append(e);
    return e;
  }
  function pic(src, cls, parent, style) {
    const i = el("img", cls, parent, style);
    i.src = src; i.alt = ""; i.draggable = false;
    return i;
  }
  // runs script(api) again and again; returns stop()
  function loop(box, script) {
    let alive = true;
    const timers = new Set();
    const wait = (ms) => new Promise((res, rej) => {
      const t = setTimeout(() => { timers.delete(t); alive ? res() : rej(new Error("stop")); }, ms);
      timers.add(t);
    });
    const hand = el("div", "howto-hand", box);
    hand.innerHTML = '<img src="assets/icons/web/hand.png" alt="" draggable="false">';
    // finger tip at (x%, y%) of the demo box
    const handTo = (x, y, ms = 600) => {
      hand.animate([{}, { left: x + "%", top: y + "%" }], { duration: ms, easing: "ease-in-out", fill: "forwards" });
      return wait(ms);
    };
    const tap = async () => {
      hand.animate([{ transform: "translate(-40%, 0) scale(1)" }, { transform: "translate(-40%, 0) scale(0.82)" }, { transform: "translate(-40%, 0) scale(1)" }],
        { duration: 320, easing: "ease-out" });
      const ring = el("span", "howto-tap", box, { left: hand.style.left, top: hand.style.top });
      const r = hand.getBoundingClientRect(), b = box.getBoundingClientRect();
      ring.style.left = ((r.left + r.width / 2 - b.left) / b.width * 100) + "%";
      ring.style.top = ((r.top - b.top) / b.height * 100) + "%";
      setTimeout(() => ring.remove(), 600);
      await wait(320);
    };
    const showHand = (on) => hand.animate([{}, { opacity: on ? 1 : 0 }], { duration: 250, fill: "forwards" });
    const api = { wait, handTo, tap, hand, showHand };
    (async () => {
      while (alive) {
        box.getAnimations({ subtree: true }).forEach((a) => a.cancel());   // start each round clean
        try { await script(api); } catch (e) { if (!alive) return; throw e; }
      }
    })();
    return () => { alive = false; timers.forEach(clearTimeout); timers.clear(); box.getAnimations({ subtree: true }).forEach((a) => a.cancel()); };
  }
  function place(e, x, y, w, h) { Object.assign(e.style, { left: x + "%", top: y + "%", width: w + "%", height: h + "%" }); return e; }
  function caption(box, text) {
    let c = box.querySelector(".howto-cap");
    if (!c) c = el("div", "howto-cap", box);
    c.textContent = text;
    c.hidden = !text;
  }

  // ---------- Decor: the lamp slowly changes colour, the finger taps it ----------
  function demoDecor(box) {
    box.classList.add("is-decor");
    // show the part of the room x 30–100%, y 30–60% of the canvas
    const R = { x: 30, y: 30, w: 70, h: 30 };
    const world = el("div", "howto-world", box, {
      width: (100 / R.w * 100) + "%", height: (100 / R.h * 100) + "%",
      left: (-R.x / R.w * 100) + "%", top: (-R.y / R.h * 100) + "%",
    });
    pic("assets/decor/web/room.jpg", "howto-fill", world);
    const items = {
      calendar: [33.24, 32.29, 10.74, 8.80], plant: [38.52, 41.56, 19.44, 10.73], radio: [45.93, 51.20, 7.96, 5.10],
      lamp: [60.28, 40.16, 11.30, 6.93], pillow: [68.61, 45.52, 13.80, 6.04], bear: [78.89, 50.10, 10.74, 4.27],
    };
    const els = {};
    Object.entries(items).forEach(([k, [x, y, w, h]]) => { els[k] = place(pic(`assets/decor/web/items/${k}.png`, "howto-item", world), x, y, w, h); });
    const lamp = els.lamp;
    // lamp centre in demo-box %
    const lx = (60.28 + 11.30 / 2 - R.x) / R.w * 100, ly = (40.16 + 6.93 / 2 - R.y) / R.h * 100;
    return loop(box, async ({ wait, handTo, tap, hand, showHand }) => {
      lamp.style.filter = "none";
      box.querySelectorAll(".howto-ring").forEach((r) => r.remove());
      Object.assign(hand.style, { left: "80%", top: "110%" });
      showHand(false);
      caption(box, "จำห้องนี้ไว้นะ");
      await wait(1800);
      caption(box, "ของชิ้นไหนเปลี่ยนไป?");
      lamp.animate([{ filter: "hue-rotate(0deg) saturate(1)" }, { filter: "hue-rotate(150deg) saturate(1.6)" }], { duration: 2400, fill: "forwards", easing: "ease-in" });
      await wait(1600);
      showHand(true);
      await handTo(lx, ly, 900);
      await tap();
      const ring = place(el("span", "howto-ring", box), lx - 13, ly - 20, 26, 40);
      caption(box, "เจอแล้ว! โคมไฟเปลี่ยนสี");
      await wait(2000);
      ring.remove();
    });
  }

  // ---------- Melody: 2 records light up, then the finger taps them in order ----------
  function demoMelody(box) {
    box.classList.add("is-melody");
    const recs = [];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);   // 3 across × 2 rows fits the wide demo box
      const r = place(pic(`assets/melody/web/rec${i + 1}.png`, "howto-rec", box), 7 + col * 30, 6 + row * 38, 26, 34);
      recs.push(r);
    }
    const center = (i) => { const col = i % 3, row = Math.floor(i / 3); return [7 + col * 30 + 13, 6 + row * 38 + 17]; };
    const seq = [0, 4];
    const light = (i, ms) => recs[i].animate([{ filter: "brightness(1)" }, { filter: "brightness(1.6) drop-shadow(0 0 6px #ffe680)", offset: 0.2 }, { filter: "brightness(1.6) drop-shadow(0 0 6px #ffe680)", offset: 0.8 }, { filter: "brightness(1)" }], { duration: ms });
    return loop(box, async ({ wait, handTo, tap, hand, showHand }) => {
      Object.assign(hand.style, { left: "50%", top: "110%" });
      showHand(false);
      caption(box, "ฟังและดูให้ดี");
      await wait(700);
      for (const i of seq) { light(i, 900); await wait(1100); }
      caption(box, "ถึงตาคุณ กดตามลำดับ");
      showHand(true);
      for (const i of seq) {
        const [x, y] = center(i);
        await handTo(x, y, 700);
        light(i, 500);
        await tap();
        await wait(250);
      }
      caption(box, "ถูกต้อง! รอบต่อไปเพลงจะยาวขึ้น");
      await wait(1800);
    });
  }

  // ---------- Market: remember the list, drag a fruit, 3 in a row pop ----------
  function demoMarket(box) {
    box.classList.add("is-market");
    pic("assets/market/web/basket_b.png", "howto-basket", box);
    const F = "assets/market/web/";
    const sit = [place(pic(F + "orange.png", "howto-fruit", box), 30, 64, 15, 22), place(pic(F + "orange.png", "howto-fruit", box), 44, 66, 15, 22)];
    const other = place(pic(F + "mangosteen.png", "howto-fruit", box), 60, 64, 15, 22);
    const drop = place(pic(F + "orange.png", "howto-fruit", box), 70, 2, 15, 22);
    const list = el("div", "howto-list", box);
    list.innerHTML = `<img src="${F}orange.png" alt=""> × 1`;
    return loop(box, async ({ wait, handTo, tap, hand, showHand }) => {
      [...sit, other].forEach((f) => { f.style.opacity = 1; f.getAnimations().forEach((a) => a.cancel()); });
      drop.getAnimations().forEach((a) => a.cancel());
      Object.assign(drop.style, { left: "70%", top: "2%", opacity: 0 });
      box.querySelectorAll(".howto-plus").forEach((p) => p.remove());
      showHand(false);
      Object.assign(hand.style, { left: "78%", top: "110%" });
      list.hidden = false;
      caption(box, "");
      await wait(1800);
      list.hidden = true;
      drop.style.opacity = 1;
      caption(box, "ลากไปซ้าย-ขวา แล้วปล่อย");
      showHand(true);
      await handTo(77, 14, 700);
      await tap();
      // drag left together
      drop.animate([{ left: "70%" }, { left: "37%" }], { duration: 1000, easing: "ease-in-out", fill: "forwards" });
      await handTo(44, 14, 1000);
      showHand(false);
      // let go: falls next to the two oranges
      drop.animate([{ left: "37%", top: "2%" }, { left: "37%", top: "47%" }], { duration: 600, easing: "cubic-bezier(.5,0,1,1)", fill: "forwards" });
      await wait(650);
      caption(box, "3 ลูกติดกัน = เก็บได้ 1 ชิ้น");
      [...sit, drop].forEach((f) => f.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.25)", opacity: 1, offset: 0.4 }, { transform: "scale(0.1)", opacity: 0 }], { duration: 500, fill: "forwards" }));
      const plus = place(el("span", "howto-plus", box), 34, 40, 30, 14);
      plus.textContent = "+1";
      await wait(2000);
    });
  }

  // =====================================================================
  // "?" buttons (drawn in code in the game's own colours)
  // =====================================================================
  function helpBtn(parent, game, style) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "howto-btn";
    b.setAttribute("aria-label", "วิธีเล่น");
    b.textContent = "?";
    Object.assign(b.style, style || {});
    b.addEventListener("click", (e) => { e.stopPropagation(); open(game); });
    parent.append(b);
    return b;
  }
  ["melody", "decor", "market"].forEach((g) => {
    const s = document.getElementById(`screen-levels-${g}`);
    if (s) helpBtn(s, g);
  });

  M.howto = { open, beforeLevel, seen, GAMES };
})();

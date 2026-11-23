/* How to play (วิธีเล่น): a popup with a short looping demo made from each game's own art,
 * a pointing finger that plays it, and 3 short steps.
 *
 *   - Shown by itself every time level 1 of a game is started from the level map.
 *   - "?" button on each game's level map (shows that game).
 *   - Frame: assets/ui/web/win_panel.png (Drive "ผ่านแล้ว_กรอบหลัง"); X at the top right closes it.
 *   - "ทดลองเล่น" turns the same popup into a short practice round (PRACTICE below): the finger
 *     shows each step, a step text explains it, and the player does it. At the end "เล่นเลย"
 *     starts level 1 of that game.
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
        <p class="howto-say" hidden></p>
        <button type="button" class="howto-go">ทดลองเล่น</button>
      </div>
      <div class="howto-done" hidden>
        <p>เยี่ยมมาก!<br>พร้อมเล่นจริงแล้ว</p>
        <button type="button" class="howto-play">เล่นเลย</button>
      </div>
    </div>`;
  document.getElementById("stage").append(modal);
  const $ = (s) => modal.querySelector(s);
  const demoBox = $(".howto-demo"), tabs = $(".howto-tabs"), steps = $(".howto-steps"), go = $(".howto-go"), title = $(".howto-title");
  const say = $(".howto-say"), done = $(".howto-done"), card = $(".howto-card");

  let current = null, stopDemo = null, onDone = null, firstGame = null;

  // back to the "how to play" view (looping demo + 3 steps + ทดลองเล่น)
  function resetView() {
    card.classList.remove("is-practice");
    steps.hidden = false; go.hidden = false; say.hidden = true; done.hidden = true;
    demoBox.className = "howto-demo";
  }

  function show(game) {
    current = game;
    resetView();
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
    modal.hidden = false;
    show(game || ORDER[0]);
    go.focus({ preventScroll: true });
  }
  // start = true: "เล่นเลย" after the practice (level 1 starts); false: X / Escape just closes the popup
  function close(start) {
    modal.hidden = true;
    if (stopDemo) { stopDemo(); stopDemo = null; }
    demoBox.innerHTML = "";
    resetView();
    if (firstGame) markSeen(firstGame);
    const cb = onDone, game = current;
    onDone = null; firstGame = null;
    if (start !== true) return;
    if (cb) cb();                                         // level 1 was chosen on the map
    else if (M[game] && M[game].start) M[game].start(1);  // opened from "?": go to level 1
  }
  $(".howto-x").addEventListener("click", () => close(false));
  go.addEventListener("click", () => startPractice(current));
  $(".howto-play").addEventListener("click", () => close(true));

  // ---------- ทดลองเล่น: the same popup becomes a small practice round ----------
  function startPractice(game) {
    if (stopDemo) stopDemo();
    demoBox.innerHTML = "";
    card.classList.add("is-practice");
    steps.hidden = true; go.hidden = true; say.hidden = false; done.hidden = true;
    title.textContent = "ทดลองเล่น";
    stopDemo = PRACTICE[game](demoBox, () => {
      done.hidden = false;
      $(".howto-play").focus({ preventScroll: true });
    });
  }
  // step text under the practice box: "ขั้นที่ 1/3" + what to do
  function sayStep(n, of, text) {
    say.innerHTML = `<b>รอบที่ ${n}/${of}</b><span></span>`;
    say.querySelector("span").textContent = text;
    say.animate([{ transform: "scale(0.94)", opacity: 0.4 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "ease-out" });
  }
  modal.addEventListener("keydown", (e) => { if (e.key === "Escape") close(false); });
  modal.addEventListener("click", (e) => { if (e.target === modal) close(false); });   // tap outside = close

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
  // the pointing finger and its moves, inside box
  function makeHand(box, wait) {
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
    // finger bobs on the spot ("tap here") until stopped
    let bob = null;
    const point = (x, y) => {
      if (bob) bob.cancel();
      hand.getAnimations().forEach((a) => a.cancel());
      Object.assign(hand.style, { left: x + "%", top: y + "%", opacity: 1 });
      bob = hand.animate([{ transform: "translate(-40%, 0)" }, { transform: "translate(-40%, 18%)" }, { transform: "translate(-40%, 0)" }],
        { duration: 900, iterations: Infinity, easing: "ease-in-out" });
    };
    const unpoint = () => { bob = null; hand.getAnimations().forEach((a) => a.cancel()); hand.style.opacity = 0; };
    return { hand, handTo, tap, showHand, point, unpoint };
  }

  // runs script(api) again and again; returns stop()
  function loop(box, script) {
    let alive = true;
    const timers = new Set();
    const wait = (ms) => new Promise((res, rej) => {
      const t = setTimeout(() => { timers.delete(t); alive ? res() : rej(new Error("stop")); }, ms);
      timers.add(t);
    });
    const api = { wait, ...makeHand(box, wait) };
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
  // ทดลองเล่น (practice). Every round goes in the same order, slowly, so it is easy to follow:
  //   1. an explanation card covers the play area (stays long enough to read; tap to skip)
  //   2. the task appears (records light up / something in the room changes / a fruit appears)
  //   3. the finger does it as an example
  //   4. "ตาคุณแล้ว": the same kind of task again and the player does it
  //      (if they wait or tap wrong, the finger points at the answer)
  // Nothing is scored, no hearts are used. When finished: finish() shows "เล่นเลย".
  // =====================================================================
  function practice(box, script, finish) {
    let alive = true;
    const timers = new Set(), cleanups = new Set();
    const STOP = new Error("stop");
    const wait = (ms) => new Promise((res, rej) => {
      const t = setTimeout(() => { timers.delete(t); alive ? res() : rej(STOP); }, ms);
      timers.add(t);
    });
    // fn() after ms unless cancelled first
    const later = (ms, fn) => {
      const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
      timers.add(t);
      return { cancel: () => { clearTimeout(t); timers.delete(t); } };
    };
    // resolves with the tapped target; onMiss(e) for a tap anywhere else in the box
    const waitTap = (targets, onMiss) => new Promise((res, rej) => {
      const h = (e) => {
        const hit = targets.find((t) => t === e.target || t.contains(e.target));
        if (hit) { off(); res(hit); } else if (onMiss) onMiss(e);
      };
      const off = () => { box.removeEventListener("pointerdown", h); cleanups.delete(cancel); };
      const cancel = () => { off(); rej(STOP); };
      box.addEventListener("pointerdown", h);
      cleanups.add(cancel);
    });
    // explanation card over the play area; reading time grows with the text; tap = next
    const explain = (text, minMs = 4000) => new Promise((res, rej) => {
      const card = el("div", "howto-explain", box.closest(".howto-card") || box);
      card.innerHTML = `<p></p><i class="howto-explain-bar"><b></b></i><small>แตะเพื่อไปต่อ</small>`;
      card.querySelector("p").textContent = text;
      const ms = Math.max(minMs, text.length * 85);
      card.querySelector(".howto-explain-bar b").animate([{ width: "100%" }, { width: "0%" }], { duration: ms, fill: "forwards" });
      let t = null;
      const done = () => { clearTimeout(t); timers.delete(t); cleanups.delete(cancel); card.remove(); alive ? res() : rej(STOP); };
      const cancel = () => { clearTimeout(t); card.remove(); rej(STOP); };
      t = setTimeout(done, ms); timers.add(t);
      card.addEventListener("pointerdown", (e) => { e.stopPropagation(); done(); }, { once: true });
      cleanups.add(cancel);
    });
    const shake = (e) => e.animate([{ translate: "0 0" }, { translate: "-6% 0" }, { translate: "6% 0" }, { translate: "-4% 0" }, { translate: "0 0" }], { duration: 380 });
    const api = {
      wait, later, waitTap, explain, shake, alive: () => alive, cleanups,
      caption: (t) => caption(box, t),
      // text under the play area: which round / what is happening now
      say: (round, of, text) => sayStep(round, of, text),
      ...makeHand(box, wait),
    };
    api.hand.style.opacity = 0;
    // finger comes in from below, taps at (x, y), stays there
    api.fingerTap = async (x, y) => {
      if (getComputedStyle(api.hand).opacity === "0") {
        api.hand.getAnimations().forEach((a) => a.cancel());
        Object.assign(api.hand.style, { left: x + "%", top: "112%", opacity: 1 });
      }
      await api.handTo(x, y, 750);
      await api.tap();
    };
    api.fingerAway = async () => { await api.handTo(parseFloat(api.hand.style.left) || 50, 112, 450); api.unpoint(); };
    script(api).then(() => { if (alive) finish(); }, (e) => { if (e !== STOP) throw e; });
    return () => {
      alive = false;
      timers.forEach(clearTimeout); timers.clear();
      [...cleanups].forEach((c) => c());
      box.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    };
  }

  const PRACTICE = {
    // ---------- Melody: round 1 = 1 record, round 2 = 2 records in order ----------
    melody(box, finish) {
      box.classList.add("is-melody", "is-play");
      const NOTES = ["C4", "D4", "E4", "F4", "G4", "A4"];
      const recs = [];
      for (let i = 0; i < 6; i++) {
        const col = i % 3, row = Math.floor(i / 3);
        recs.push(place(pic(`assets/melody/web/rec${i + 1}.png`, "howto-rec", box), 7 + col * 30, 6 + row * 38, 26, 34));
      }
      const center = (i) => { const col = i % 3, row = Math.floor(i / 3); return [7 + col * 30 + 13, 6 + row * 38 + 17]; };
      const mel = M.melody || {};
      const light = (i, ms) => {
        recs[i].animate([{ filter: "brightness(1)" }, { filter: "brightness(1.6) drop-shadow(0 0 6px #ffe680)", offset: 0.2 }, { filter: "brightness(1.6) drop-shadow(0 0 6px #ffe680)", offset: 0.8 }, { filter: "brightness(1)" }], { duration: ms });
        try { if (mel.playNote) mel.playNote(NOTES[i], ms / 1000 * 0.8); } catch (e) { /* no sound */ }
      };
      const ROUNDS = [
        { seq: [1], intro: "แผ่นเสียงจะสว่างขึ้นพร้อมเสียงเพลง\nจำไว้ว่าแผ่นไหนสว่าง" },
        { seq: [1, 3], intro: "รอบต่อไปเพลงจะยาวขึ้น 1 โน้ต\nจำแผ่นที่สว่างทั้ง 2 แผ่น ตามลำดับ" },
      ];
      const of = ROUNDS.length;

      return practice(box, async (p) => {
        const showTask = async (seq) => {
          p.caption("ดูและฟังให้ดี");
          await p.wait(800);
          for (const i of seq) { light(i, 1100); await p.wait(1600); }
        };
        for (let r = 0; r < of; r++) {
          const { seq, intro } = ROUNDS[r];
          // 1. explanation
          p.say(r + 1, of, "อ่านคำอธิบาย");
          p.caption("");
          await p.explain(intro);
          // 2. the task
          p.say(r + 1, of, "ดูโจทย์: แผ่นเสียงที่สว่างขึ้น");
          await showTask(seq);
          // 3. the finger shows the answer
          p.say(r + 1, of, "ดูตัวอย่าง: นิ้วแตะแผ่นเสียงตามลำดับที่สว่าง");
          p.caption("ดูนิ้วแตะให้ดูนะ");
          for (const i of seq) {
            await p.fingerTap(...center(i));
            light(i, 600);
            await p.wait(650);
          }
          await p.fingerAway();
          p.caption("แบบนี้เลย!");
          await p.wait(1000);
          // 4. the player's turn: the same task again
          p.say(r + 1, of, "ลองเอง: แตะแผ่นเสียงตามลำดับที่สว่าง");
          await p.explain(r === of - 1
            ? "ตาคุณแล้ว!\nดูโจทย์อีกครั้ง แล้วแตะตามลำดับ\n(เกมจริงต้องแตะให้ทันใน 10 วินาที)"
            : "ตาคุณแล้ว!\nดูโจทย์อีกครั้ง แล้วแตะแผ่นที่สว่าง");
          p.say(r + 1, of, "ลองเอง: แตะแผ่นเสียงตามลำดับที่สว่าง");
          await showTask(seq);
          let help = false;
          for (;;) {
            p.caption("ถึงตาคุณ แตะเลย");
            let ok = true;
            for (const i of seq) {
              if (help) p.point(...center(i));
              const hint = p.later(5000, () => { p.point(...center(i)); p.caption("แตะแผ่นที่นิ้วชี้นะ"); });
              const hit = await p.waitTap(recs);
              hint.cancel(); p.unpoint();
              if (hit !== recs[i]) {
                p.shake(hit);
                try { if (mel.playWrong) mel.playWrong(); } catch (e) { /* no sound */ }
                ok = false; break;
              }
              light(i, 600);
              await p.wait(350);
            }
            if (ok) break;
            help = true;
            p.caption("ไม่เป็นไรนะ ดูอีกครั้ง นิ้วจะช่วยชี้");
            await p.wait(1800);
            await showTask(seq);
          }
          p.caption(r === of - 1 ? "เก่งมาก! ถูกต้องทั้งหมด" : "ถูกต้อง! เก่งมาก");
          await p.wait(1600);
        }
      }, finish);
    },

    // ---------- Decor: round 1 = something changes colour, round 2 = something changes size ----------
    decor(box, finish) {
      box.classList.add("is-decor", "is-play");
      const R = { x: 30, y: 30, w: 70, h: 30 };
      const world = el("div", "howto-world", box, {
        width: (100 / R.w * 100) + "%", height: (100 / R.h * 100) + "%",
        left: (-R.x / R.w * 100) + "%", top: (-R.y / R.h * 100) + "%",
      });
      pic("assets/decor/web/room.jpg", "howto-fill", world);
      const ITEMS = {
        calendar: [33.24, 32.29, 10.74, 8.80], plant: [38.52, 41.56, 19.44, 10.73], radio: [45.93, 51.20, 7.96, 5.10],
        lamp: [60.28, 40.16, 11.30, 6.93], pillow: [68.61, 45.52, 13.80, 6.04], bear: [78.89, 50.10, 10.74, 4.27],
      };
      const els = {};
      Object.entries(ITEMS).forEach(([k, [x, y, w, h]]) => { els[k] = place(pic(`assets/decor/web/items/${k}.png`, "howto-item", world), x, y, w, h); });
      const centerOf = (k) => { const [x, y, w, h] = ITEMS[k]; return [(x + w / 2 - R.x) / R.w * 100, (y + h / 2 - R.y) / R.h * 100]; };
      const NAMES = { lamp: "โคมไฟ", pillow: "หมอน", plant: "ต้นไม้", bear: "ตุ๊กตาหมี" };
      const change = (k, kind) => kind === "color"
        ? els[k].animate([{ filter: "hue-rotate(0deg) saturate(1)" }, { filter: "hue-rotate(150deg) saturate(1.7)" }], { duration: 3000, fill: "forwards", easing: "ease-in" })
        : els[k].animate([{ transform: "scale(1)" }, { transform: "scale(1.6)" }], { duration: 3000, fill: "forwards", easing: "ease-in" });
      const reset = () => {
        Object.values(els).forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
        box.querySelectorAll(".howto-ring").forEach((r) => r.remove());
      };
      const ring = (k) => { const [x, y] = centerOf(k); place(el("span", "howto-ring", box), x - 13, y - 20, 26, 40); };
      const ROUNDS = [
        { kind: "color", demo: "lamp", mine: "pillow", intro: "จำของในห้องไว้ให้ดี\nแล้วของ 1 ชิ้นจะค่อยๆ เปลี่ยนสี", what: "เปลี่ยนสี" },
        { kind: "size", demo: "plant", mine: "bear", intro: "บางครั้งของจะค่อยๆ เปลี่ยนขนาด\nใหญ่ขึ้นหรือเล็กลง", what: "ใหญ่ขึ้น" },
      ];
      const of = ROUNDS.length;

      return practice(box, async (p) => {
        const showTask = async (k, kind) => {
          reset();
          p.caption("");
          for (const n of [3, 2, 1]) { p.caption(`จำห้องนี้ไว้นะ… ${n}`); await p.wait(1000); }
          p.caption("ดูให้ดี อะไรเปลี่ยนไป?");
          change(k, kind);
          await p.wait(3200);
        };
        for (let r = 0; r < of; r++) {
          const { kind, demo, mine, intro, what } = ROUNDS[r];
          // 1. explanation
          p.say(r + 1, of, "อ่านคำอธิบาย");
          p.caption("");
          await p.explain(intro);
          // 2. the task
          p.say(r + 1, of, "ดูโจทย์: จำห้อง แล้วดูว่าอะไรเปลี่ยน");
          await showTask(demo, kind);
          // 3. the finger shows the answer
          p.say(r + 1, of, `ดูตัวอย่าง: นิ้วแตะของที่${what}`);
          p.caption("ดูนิ้วแตะให้ดูนะ");
          await p.fingerTap(...centerOf(demo));
          ring(demo);
          p.caption(`เจอแล้ว! ${NAMES[demo]}${what}`);
          await p.wait(1800);
          await p.fingerAway();
          // 4. the player's turn: another thing changes the same way
          p.say(r + 1, of, `ลองเอง: หาของที่${what} แล้วแตะเลย`);
          await p.explain("ตาคุณแล้ว!\nจำห้องไว้ แล้วแตะของที่เปลี่ยนไป");
          p.say(r + 1, of, `ลองเอง: หาของที่${what} แล้วแตะเลย`);
          await showTask(mine, kind);
          p.caption("แตะของที่เปลี่ยนไป");
          const hint = p.later(4500, () => { p.point(...centerOf(mine)); p.caption(`ลองแตะ${NAMES[mine]}ที่นิ้วชี้`); });
          await p.waitTap([els[mine]], (e) => {
            const it = Object.values(els).find((x) => x === e.target);
            if (it) p.shake(it);
            p.point(...centerOf(mine));
            p.caption("ยังไม่ใช่ ของที่เปลี่ยนคือชิ้นที่นิ้วชี้");
          });
          hint.cancel(); p.unpoint();
          ring(mine);
          p.caption(`เก่งมาก! ${NAMES[mine]}${what}`);
          await p.wait(1800);
        }
      }, finish);
    },

    // ---------- Market: round 1 = orange, round 2 = mangosteen (drag, let go, 3 in a row) ----------
    market(box, finish) {
      box.classList.add("is-market", "is-play");
      pic("assets/market/web/basket_b.png", "howto-basket", box);
      const F = "assets/market/web/";
      // two oranges on the left, two mangosteens on the right, sitting in the basket
      const sitting = [
        place(pic(F + "orange.png", "howto-fruit", box), 14, 64, 15, 22), place(pic(F + "orange.png", "howto-fruit", box), 27, 66, 15, 22),
        place(pic(F + "mangosteen.png", "howto-fruit", box), 57, 66, 15, 22), place(pic(F + "mangosteen.png", "howto-fruit", box), 70, 64, 15, 22),
      ];
      const list = el("div", "howto-list", box);
      list.innerHTML = `<span><img src="${F}orange.png" alt=""> × 1</span><span><img src="${F}mangosteen.png" alt=""> × 1</span>`;
      list.hidden = true;
      const ROUNDS = [
        { kind: "orange", name: "ส้ม", from: 70, land: 21, ok: [10, 33], pair: [0, 1],
          intro: "ลากผลไม้ไปซ้าย-ขวา แล้วปล่อย\nให้ตกลงไปติดกับผลไม้แบบเดียวกัน" },
        { kind: "mangosteen", name: "มังคุด", from: 8, land: 63, ok: [52, 76], pair: [2, 3],
          intro: "ผลไม้เหมือนกัน 3 ลูกติดกัน\n= เก็บได้ 1 ชิ้น\nลองกับมังคุดบ้าง" },
      ];
      const of = ROUNDS.length;
      let fruit = null, zone = null;
      const newFruit = (kind, from) => {
        if (fruit) fruit.remove();
        fruit = place(pic(F + kind + ".png", "howto-fruit", box), from, 2, 15, 22);
        return fruit;
      };
      const resetBasket = () => {
        sitting.forEach((f) => { f.getAnimations().forEach((a) => a.cancel()); f.style.opacity = 1; });
        box.querySelectorAll(".howto-plus").forEach((e) => e.remove());
        if (fruit) { fruit.remove(); fruit = null; }
      };
      const fall = (top) => fruit.animate([{ top: "2%" }, { top: top + "%" }], { duration: 550, easing: "cubic-bezier(.5,0,1,1)", fill: "forwards" });
      const pop = async (p, pair) => {
        [...pair.map((i) => sitting[i]), fruit].forEach((f) => f.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.25)", opacity: 1, offset: 0.4 }, { transform: "scale(0.1)", opacity: 0 }], { duration: 500, fill: "forwards" }));
        place(el("span", "howto-plus", box), 30, 40, 40, 14).textContent = "+1";
        await p.wait(1700);
      };
      // drag: the fruit follows the finger left–right; resolves with the left % where it was let go
      const dragOnce = (p) => new Promise((res, rej) => {
        let dragging = false, id = null, grabDx = 0;
        const bx = () => box.getBoundingClientRect();
        const xOf = (e) => (e.clientX - bx().left) / bx().width * 100;
        const down = (e) => {
          dragging = true; id = e.pointerId;
          try { box.setPointerCapture(id); } catch (err) { /* ok */ }
          grabDx = fruit.contains(e.target) ? xOf(e) - parseFloat(fruit.style.left) : 7.5;
          move(e);
          p.unpoint();
        };
        const move = (e) => {
          if (!dragging || e.pointerId !== id) return;
          fruit.style.left = Math.max(2, Math.min(83, xOf(e) - grabDx)) + "%";
        };
        const up = (e) => {
          if (!dragging || e.pointerId !== id) return;
          dragging = false; off();
          res(parseFloat(fruit.style.left));
        };
        const off = () => {
          box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move);
          box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
          p.cleanups.delete(cancel);
        };
        const cancel = () => { off(); rej(new Error("stop")); };
        box.addEventListener("pointerdown", down); box.addEventListener("pointermove", move);
        box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
        p.cleanups.add(cancel);
      });

      return practice(box, async (p) => {
        // 0. the shopping list
        p.say(1, of, "อ่านคำอธิบาย");
        await p.explain("ก่อนเริ่มเกมจะมีรายการผลไม้ให้จำ\nว่าต้องเก็บอะไร กี่ชิ้น");
        p.say(1, of, "ดูโจทย์: จำรายการผลไม้");
        list.hidden = false;
        p.caption("จำไว้นะ: ส้ม 1 มังคุด 1");
        await p.wait(3500);
        list.hidden = true;
        for (let r = 0; r < of; r++) {
          const { kind, name, from, land, ok, pair, intro } = ROUNDS[r];
          resetBasket();
          // 1. explanation
          p.say(r + 1, of, "อ่านคำอธิบาย");
          p.caption("");
          await p.explain(intro);
          // 2. the task: a fruit appears at the top
          p.say(r + 1, of, `ดูโจทย์: ${name}ลูกใหม่อยู่ด้านบน`);
          newFruit(kind, from);
          fruit.animate([{ transform: "scale(0.3)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 400 });
          p.caption(`${name}ลูกใหม่มาแล้ว`);
          await p.wait(1400);
          // 3. the finger drags it over the same fruits and lets go
          p.say(r + 1, of, `ดูตัวอย่าง: นิ้วลาก${name}ไปเหนือ${name} 2 ลูก แล้วปล่อย`);
          p.caption("ดูนิ้วลากให้ดูนะ");
          await p.fingerTap(from + 7.5, 14);
          fruit.animate([{ left: from + "%" }, { left: land + "%" }], { duration: 1300, easing: "ease-in-out", fill: "forwards" });
          await p.handTo(land + 7.5, 14, 1300);
          fruit.style.left = land + "%";
          await p.fingerAway();
          fall(47);
          await p.wait(600);
          p.caption("3 ลูกติดกัน = เก็บได้ 1 ชิ้น");
          await pop(p, pair);
          // 4. the player's turn
          resetBasket();
          p.say(r + 1, of, `ลองเอง: ลาก${name}ไปวางเหนือ${name} 2 ลูก`);
          await p.explain(`ตาคุณแล้ว!\nลาก${name}ไปเหนือ${name} 2 ลูก แล้วปล่อยนิ้ว`);
          p.say(r + 1, of, `ลองเอง: ลาก${name}ไปวางเหนือ${name} 2 ลูก`);
          for (;;) {
            newFruit(kind, from);
            zone = zone || el("span", "howto-zone", box);
            place(zone, ok[0], 2, ok[1] - ok[0] + 15, 62);
            zone.hidden = false;
            p.caption(`ลาก${name}ไปในกรอบ แล้วปล่อย`);
            const hint = p.later(4000, () => p.point(from + 7.5, 14));
            p.point(from + 7.5, 14);
            const left = await dragOnce(p);
            hint.cancel(); p.unpoint();
            zone.hidden = true;
            if (left >= ok[0] && left <= ok[1]) {
              fruit.style.left = land + "%";
              fall(47);
              await p.wait(600);
              break;
            }
            fall(64);
            await p.wait(600);
            p.caption(`ยังไม่ติดกับ${name} ลองใหม่อีกครั้งนะ`);
            await p.wait(1600);
          }
          p.caption(`เก่งมาก! เก็บ${name}ได้ 1 ชิ้น`);
          await pop(p, pair);
        }
        p.caption("ครบรายการแล้ว!");
        await p.wait(1000);
      }, finish);
    },
  };

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

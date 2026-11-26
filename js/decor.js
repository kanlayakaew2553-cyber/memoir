/* Memory Decor — spot the item in the room that is slowly changing.
 *
 * Flow of one level:
 *   1. A random set of items appears in the room, each exactly where the artist drew it.
 *   2. 5 s "look at the room" preview (no tapping).
 *   3. 60 s countdown. One item changes slowly (colour or size) and finishes changing at 40–50 s.
 *   4. Tap the changing item → win. Tap another item → red flash + "coins will be deducted" message.
 *   5. Stars by time used: ≤30 s = 3, ≤50 s = 2, otherwise 1. Time out = lose, 0 stars.
 */
(() => {
  "use strict";

  // =====================================================================
  // Settings (tune here)
  // =====================================================================
  const CONFIG = {
    previewSeconds: 5,
    timeLimit: 60,
    starTimes: { three: 30, two: 50 },    // ≤ 30 s → 3 stars, ≤ 50 s → 2 stars, else 1
    maxLevel: 100,
    // PLACEHOLDER until the coin system is defined.
    // NOTE: the wrong-tap message art says "10 เหรียญ"; change the art too if this changes.
    coinPenaltyPerMiss: 10,
    coinRewardByStars: [0, 10, 20, 30],
  };

  // How many items are in the room, by level
  function itemCountFor(level) {
    if (level <= 20) return randInt(5, 6);
    if (level <= 50) return randInt(7, 8);
    if (level <= 80) return randInt(9, 10);
    return randInt(11, 12);
  }

  // How strong and how fast the change is (smaller / slower = harder). Three stages:
  //   Levels 1–10  (BOLD): the opposite colour, extra vivid (e.g. green → purple), or the item grows
  //                        to an unrealistic size; the change is over quickly (about 12–25 s).
  //   Levels 11–19 (EASY): colour jumps to a different tone, items grow from small to clearly big.
  //   Levels 20–100: gets subtler a little every level.
  // hueDeg: colour shift around the colour wheel (180 = opposite colour).
  // saturate: colour made more vivid at the end of the change (1 = unchanged).
  // grow / shrink: size change as a fraction (1.8 = grows to 2.8× its size, 0.4 = 40 % smaller).
  // endsBetween: seconds after the countdown starts when the change is complete.
  const BOLD_UNTIL = 10;
  const EASY_UNTIL = 19;
  const STRENGTH = {
    //              first level → last level of the stage
    bold: { hueDeg: [180, 180], saturate: [1.8, 1.5], grow: [1.8, 1.2], shrink: [0.5, 0.5], endsBetween: [[10, 14], [20, 25]] },
    easy: { hueDeg: [180, 140], saturate: [1.2, 1.0], grow: [0.9, 0.6], shrink: [0.5, 0.4], endsBetween: [[30, 38], [36, 45]] },
    hard: { hueDeg: [130, 20],  saturate: [1.0, 1.0], grow: [0.55, 0.10], shrink: [0.38, 0.08], endsBetween: [[40, 50], [40, 50]] },
  };
  function changeStrengthFor(level) {
    level = clamp(level, 1, CONFIG.maxLevel);
    const stage = level <= BOLD_UNTIL ? "bold" : level <= EASY_UNTIL ? "easy" : "hard";
    const [from, to] = stage === "bold" ? [1, BOLD_UNTIL] : stage === "easy" ? [BOLD_UNTIL + 1, EASY_UNTIL] : [EASY_UNTIL + 1, CONFIG.maxLevel];
    const t = (level - from) / Math.max(1, to - from);
    const S = STRENGTH[stage];
    const pick = (k) => lerp(S[k][0], S[k][1], t);
    return {
      bold: stage === "bold",
      easy: stage !== "hard",                 // easy + bold: big items only, always small → big
      hueDeg: pick("hueDeg"), saturate: pick("saturate"), grow: pick("grow"), shrink: pick("shrink"),
      endsBetween: [lerp(S.endsBetween[0][0], S.endsBetween[1][0], t), lerp(S.endsBetween[0][1], S.endsBetween[1][1], t)],
    };
  }

  // In easy levels, very small items (pencil, small frames) are never the changing item.
  const MIN_TARGET_AREA_EASY = 35;   // w × h in %², e.g. pencil ≈ 24, lamp ≈ 78

  // =====================================================================
  // Art data: room items
  // =====================================================================
  const DIR = "assets/decor/web/items/";

  // Each item stays exactly where the artist drew it (its angle was drawn for that spot).
  // x/y/w/h: the item's box in % of the 9:16 canvas, from assets/decor/web/items.json
  // (tools/prep_decor.ps1). colour: colourful enough for a colour change.
  const ITEMS = {
    frame_v:      { name: "กรอบรูปแนวตั้ง",   x: 6.20,  y: 29.58, w: 6.30,  h: 4.90,  colour: true  },
    frame_h:      { name: "กรอบรูปแนวนอน",   x: 24.63, y: 27.24, w: 8.43,  h: 3.85,  colour: true  },
    calendar:     { name: "ปฏิทิน",           x: 33.24, y: 32.29, w: 10.74, h: 8.80,  colour: false },
    poster_md:    { name: "โปสเตอร์วง",       x: 54.44, y: 32.66, w: 7.78,  h: 6.98,  colour: true  },
    poster_queen: { name: "โปสเตอร์วง",       x: 58.80, y: 24.69, w: 7.22,  h: 6.51,  colour: true  },
    newspaper:    { name: "หนังสือพิมพ์",     x: 32.96, y: 50.99, w: 11.48, h: 3.65,  colour: false },
    radio:        { name: "วิทยุ",            x: 45.93, y: 51.20, w: 7.96,  h: 5.10,  colour: false },
    cd_player:    { name: "เครื่องเล่นซีดี",  x: 15.09, y: 45.16, w: 12.50, h: 3.70,  colour: false },
    lamp:         { name: "โคมไฟ",            x: 60.28, y: 40.16, w: 11.30, h: 6.93,  colour: true  },
    pillow:       { name: "หมอน",             x: 68.61, y: 45.52, w: 13.80, h: 6.04,  colour: true  },
    bear:         { name: "ตุ๊กตาหมี",        x: 78.89, y: 50.10, w: 10.74, h: 4.27,  colour: true  },
    book:         { name: "หนังสือ",          x: 50.28, y: 83.91, w: 15.93, h: 6.35,  colour: true  },
    book_stack:   { name: "กองหนังสือ",       x: 62.41, y: 75.83, w: 16.85, h: 8.12,  colour: true  },
    slippers:     { name: "รองเท้าใส่ในบ้าน", x: 2.31,  y: 68.91, w: 15.37, h: 10.00, colour: true  },
    headphones:   { name: "หูฟัง",            x: 25.93, y: 70.68, w: 23.43, h: 11.51, colour: false },
    pencil:       { name: "ดินสอ",            x: 45.65, y: 83.65, w: 5.09,  h: 4.79,  colour: true  },
    tapes:        { name: "ตลับเทป",          x: 39.81, y: 66.93, w: 20.00, h: 5.16,  colour: false },
    vase:         { name: "แจกันดอกไม้",      x: 78.61, y: 69.17, w: 21.39, h: 19.64, colour: false },
    // plant sits behind the cabinet and sofa, so growing it would spill over them: colour only
    plant:        { name: "กระถางต้นไม้",     x: 38.52, y: 41.56, w: 19.44, h: 10.73, colour: true, noSize: true },
  };

  // Landscape room (Drive "แยกเลเยอร์แนวนอน"): its own items, box in % of the 4:3 room
  // (tools/prep_landscape.ps1 -> assets/decor/web/items_land).
  const DIR_LAND = "assets/decor/web/items_land/";
  const ITEMS_LAND = {
    books:   { name: "กองหนังสือ",  x: 4.79,  y: 41.67, w: 4.93,  h: 6.64,  colour: true  },
    books2:  { name: "กองหนังสือ",  x: 3.56,  y: 32.81, w: 6.30,  h: 7.29,  colour: true  },
    clock:   { name: "นาฬิกา",       x: 16.85, y: 11.72, w: 6.15,  h: 8.20,  colour: true  },
    coffee:  { name: "แก้วกาแฟ",    x: 84.62, y: 68.16, w: 4.88,  h: 3.97,  colour: true  },
    cookies: { name: "ชามคุกกี้",    x: 89.06, y: 70.25, w: 5.37,  h: 4.30,  colour: true  },
    dad:     { name: "รูปพ่อ",       x: 8.35,  y: 22.85, w: 8.74,  h: 8.40,  colour: true  },
    record:  { name: "แผ่นเสียง",    x: 7.32,  y: 78.97, w: 8.15,  h: 9.51,  colour: true  },
    record2: { name: "แผ่นเสียง",    x: 10.16, y: 70.83, w: 10.50, h: 7.68,  colour: true  },
    rubik:   { name: "รูบิก",        x: 3.86,  y: 55.21, w: 2.98,  h: 3.71,  colour: true  },
    toycar:  { name: "รถของเล่น",    x: 0.83,  y: 26.69, w: 6.54,  h: 4.82,  colour: true  },
    vase:    { name: "แจกัน",        x: 89.84, y: 56.64, w: 4.00,  h: 11.59, colour: true  },
  };
  // the room picture and items that match the screen right now
  const isLand = () => !!(window.Memoir.orient && window.Memoir.orient.isLand());
  const roomSet = (land) => (land ? { items: ITEMS_LAND, dir: DIR_LAND, minEasy: 30 } : { items: ITEMS, dir: DIR, minEasy: MIN_TARGET_AREA_EASY });

  // =====================================================================
  // Small helpers
  // =====================================================================
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function starsFor(elapsed) {
    if (elapsed <= CONFIG.starTimes.three) return 3;
    if (elapsed <= CONFIG.starTimes.two) return 2;
    return 1;
  }

  // =====================================================================
  // Room layout
  // =====================================================================
  // Only WHICH items appear is random; each one stays in its drawn spot.
  function layoutRoom(count, items) {
    return shuffle(Object.keys(items)).slice(0, count).map((id) => {
      const it = items[id];
      return { id, rect: { l: it.x, t: it.y, w: it.w, h: it.h } };
    });
  }

  // =====================================================================
  // Tap detection (uses the item's actual pixels, so tapping a see-through corner of
  // one item reaches the item behind it)
  // =====================================================================
  const alphaCache = new Map();
  function alphaData(img) {
    if (alphaCache.has(img.src)) return alphaCache.get(img.src);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    let data = null;
    try { data = { w: c.width, h: c.height, px: ctx.getImageData(0, 0, c.width, c.height).data }; } catch (e) { data = null; }
    alphaCache.set(img.src, data);
    return data;
  }
  function opaqueAt(img, clientX, clientY) {
    const r = img.getBoundingClientRect();
    const d = alphaData(img);
    if (!d) return true;
    const u = Math.floor((clientX - r.left) / r.width * d.w);
    const v = Math.floor((clientY - r.top) / r.height * d.h);
    if (u < 0 || v < 0 || u >= d.w || v >= d.h) return false;
    // check a small neighbourhood so thin items (pencil, headphone cable) are easy to hit
    const R = Math.max(2, Math.round(d.w * 0.04));
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
      const x = u + dx, y = v + dy;
      if (x >= 0 && y >= 0 && x < d.w && y < d.h && d.px[(y * d.w + x) * 4 + 3] > 40) return true;
    }
    return false;
  }

  // =====================================================================
  // Art UI (shared pieces come from js/artui.js)
  // =====================================================================
  const $ = (id) => document.getElementById(id);
  const A = window.Memoir.artUI;
  const root = $("decor-ui");

  // Top bar with timer
  const hud = A.topBar(root, { onExit: () => onExit(), timer: true });

  // "สังเกตห้องนี้ไว้นะ!" banner with the 5…1 countdown, then "เริ่ม"
  const banner = A.layer(root, "ui-banner");
  const bannerCount = A.uiImg("memorize_count", banner);
  const bannerStart = A.uiImg("memorize_start", banner);
  const countNum = A.uiNum("count", banner, "num-count");
  // the art says "จำห้องนี้ไว้!"; its words are covered (same orange) with "สังเกตห้องนี้ไว้นะ!"
  const bannerText = document.createElement("div");
  bannerText.className = "decor-banner-text";
  bannerText.textContent = "สังเกตห้องนี้ไว้นะ!";
  banner.appendChild(bannerText);
  if (window.Memoir.orient) window.Memoir.orient.box(bannerText, [15.6, 11.1, 37.5, 6.9], "auto");

  // Wrong-tap message
  const wrongMsg = A.uiImg("wrong_minus10", root, "ui-wrong");
  let wrongTimer = 0;

  // Short text note (used to point at the changed item after a time-out)
  const note = document.createElement("div");
  note.className = "decor-note";
  note.hidden = true;
  root.appendChild(note);

  const exitPop = A.exitPopup(root, { onExit: () => exitToLevels(), onContinue: () => resume() });
  const win$ = A.winPopup(root, {
    onNext: () => start(S.level + 1),
    onReplay: () => start(S.level),
    onLevels: () => exitToLevels(),
  });
  const winPop = win$.el;

  // =====================================================================
  // Game state
  // =====================================================================
  const els = {
    screen: $("screen-decor-game"), items: $("decor-items"), flash: $("decor-flash"),
    modal: $("decor-modal"), card: $("decor-modal-card"),
  };

  let S = null;          // current level state
  let rafId = 0;

  function popupOpen() { return !exitPop.hidden || !winPop.hidden || !els.modal.hidden; }
  function hidePopups() { exitPop.hidden = true; winPop.hidden = true; els.modal.hidden = true; }

  function start(level) {
    if (!window.Memoir.wallet.check(() => start(level))) return;   // out of hearts
    stop();
    const land = isLand();
    const room = roomSet(land);
    const ITEMS = room.items;
    const placed = layoutRoom(Math.min(Object.keys(ITEMS).length, itemCountFor(level)), ITEMS);
    const strength = changeStrengthFor(level);
    const big = placed.filter((p) => p.rect.w * p.rect.h >= room.minEasy);
    const pool = strength.easy && big.length ? big : placed;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const colourOk = ITEMS[target.id].colour;
    const kind = colourOk && (ITEMS[target.id].noSize || Math.random() < 0.5) ? "colour" : "size";

    S = {
      level, placed, target, kind, land, ITEMS,
      dir: Math.random() < 0.5 ? -1 : 1,
      sizeDir: strength.easy || Math.random() < 0.6 ? 1 : -1,   // easy levels: always small → big
      strength,
      changeEnd: rand(strength.endsBetween[0], strength.endsBetween[1]),
      phase: "loading", previewLeft: CONFIG.previewSeconds, elapsed: 0,
      misses: 0, paused: false, last: 0, nodes: new Map(),
    };

    // Build the items, back to front
    els.items.innerHTML = "";
    placed.slice().sort((a, b) => (a.rect.t + a.rect.h) - (b.rect.t + b.rect.h)).forEach((p) => {
      const img = document.createElement("img");
      img.src = room.dir + p.id + ".png";
      img.alt = ITEMS[p.id].name;
      img.draggable = false;
      img.className = "decor-item";
      Object.assign(img.style, {
        left: p.rect.l + "%", top: p.rect.t + "%", width: p.rect.w + "%", height: p.rect.h + "%",
      });
      els.items.appendChild(img);
      S.nodes.set(p.id, img);
    });

    hud.setLevel(level);
    hud.setTime(CONFIG.timeLimit);
    hud.setLow(false);
    hud.setStars(3);
    hidePopups();
    note.hidden = true;
    wrongMsg.classList.remove("is-shown");
    banner.hidden = false;
    bannerCount.hidden = false;
    bannerStart.hidden = true;
    countNum.hidden = false;
    countNum.textContent = CONFIG.previewSeconds;
    window.Memoir.showScreen("screen-decor-game");

    const imgs = [...S.nodes.values()];
    const myState = S;
    const loaded = (i) => i.complete && i.naturalWidth ? Promise.resolve()
      : new Promise((res) => { i.addEventListener("load", res, { once: true }); i.addEventListener("error", res, { once: true }); });
    const timeout = new Promise((res) => setTimeout(res, 4000));   // never get stuck on a slow image
    Promise.race([Promise.all(imgs.map(loaded)), timeout]).then(() => {
      if (S !== myState) return;
      imgs.forEach(alphaData);
      S.phase = "preview";
      S.last = performance.now();
      rafId = requestAnimationFrame(tick);
    });
  }

  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (S) S.phase = "stopped";
    els.items.querySelectorAll(".decor-ring").forEach((n) => n.remove());
  }

  function tick(now) {
    if (!S || S.phase === "stopped" || S.phase === "done") return;
    const dt = Math.min(0.25, (now - S.last) / 1000);
    S.last = now;
    if (!S.paused) {
      if (S.phase === "preview") {
        S.previewLeft -= dt;
        if (S.previewLeft <= 0) {
          S.phase = "play";
          // show the real "เริ่ม" word, then let the banner go
          bannerCount.hidden = true;
          countNum.hidden = true;
          bannerStart.hidden = false;
          const myState = S;
          setTimeout(() => { if (S === myState && S.phase === "play") banner.hidden = true; }, 800);
        } else {
          countNum.textContent = Math.ceil(S.previewLeft);
        }
      } else if (S.phase === "play") {
        S.elapsed += dt;
        applyChange();
        const left = Math.max(0, CONFIG.timeLimit - S.elapsed);
        hud.setTime(Math.ceil(left));
        hud.setLow(left <= 10);
        hud.setStars(starsFor(S.elapsed));
        if (left <= 0) { lose(); return; }
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function applyChange() {
    const p = clamp(S.elapsed / S.changeEnd, 0, 1);
    const img = S.nodes.get(S.target.id);
    if (S.kind === "colour") {
      img.style.filter = `hue-rotate(${S.dir * S.strength.hueDeg * p}deg) saturate(${1 + (S.strength.saturate - 1) * p})`;
    } else {
      const amount = S.sizeDir > 0 ? S.strength.grow : -S.strength.shrink;
      img.style.transform = `scale(${1 + amount * p})`;
      if (S.strength.bold && amount > 0) img.style.zIndex = "50";   // a hugely grown item stays on top
    }
  }

  // ---------- Tapping ----------
  els.items.addEventListener("pointerdown", (e) => {
    if (!S || S.phase !== "play" || S.paused) return;
    const hit = itemAt(e.clientX, e.clientY);
    if (!hit) return;                       // tapped empty floor/wall: ignore
    if (hit === S.target.id) win();
    else miss(hit);
  });

  function itemAt(x, y) {
    const stageRect = $("stage").getBoundingClientRect();
    const pad = stageRect.width * 0.03;     // a little forgiveness around each item
    // the changing item first: once it has grown it may stretch over other items
    const list = [...S.nodes.entries()].reverse().sort((a, b) => (b[0] === S.target.id) - (a[0] === S.target.id));
    for (const [id, img] of list) {
      const r = img.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && opaqueAt(img, x, y)) return id;
    }
    let best = null, bestD = Infinity;
    for (const [id, img] of list) {
      const r = img.getBoundingClientRect();
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
        if (d < bestD) { bestD = d; best = id; }
      }
    }
    return best;
  }

  function miss(id) {
    S.misses++;
    els.flash.classList.remove("is-on"); void els.flash.offsetWidth; els.flash.classList.add("is-on");
    const img = S.nodes.get(id);
    img.classList.remove("is-wrong"); void img.offsetWidth; img.classList.add("is-wrong");
    wrongMsg.classList.add("is-shown");
    clearTimeout(wrongTimer);
    wrongTimer = setTimeout(() => wrongMsg.classList.remove("is-shown"), 2000);
    if (navigator.vibrate) navigator.vibrate(120);
  }

  function ring(id, cls) {
    const img = S.nodes.get(id);
    const box = img.getBoundingClientRect();
    const st = els.items.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = "decor-ring " + cls;
    const padX = box.width * 0.18, padY = box.height * 0.18;
    Object.assign(d.style, {
      left: ((box.left - st.left - padX) / st.width * 100) + "%",
      top: ((box.top - st.top - padY) / st.height * 100) + "%",
      width: ((box.width + padX * 2) / st.width * 100) + "%",
      height: ((box.height + padY * 2) / st.height * 100) + "%",
    });
    els.items.appendChild(d);
  }

  // ---------- End of level ----------
  function win() {
    S.phase = "done";
    cancelAnimationFrame(rafId);
    wrongMsg.classList.remove("is-shown");
    ring(S.target.id, "is-good");
    const stars = starsFor(S.elapsed);
    const used = Math.min(CONFIG.timeLimit, Math.ceil(S.elapsed));
    const penalty = S.misses * CONFIG.coinPenaltyPerMiss;
    const coins = Math.max(0, CONFIG.coinRewardByStars[stars] - penalty);
    window.Memoir.progress.setStars("decor", S.level, stars);
    window.Memoir.history.add("decor", S.level, { win: true, sec: S.elapsed, miss: S.misses, stars });
    window.Memoir.wallet.addCoins(coins);

    win$.fill({ stars, seconds: used, misses: S.misses, coins, hasNext: S.level < CONFIG.maxLevel });

    const myState = S;
    setTimeout(() => { if (S === myState) win$.show(); }, 900);
  }

  function lose() {
    if (window.Memoir.sound) window.Memoir.sound.play("lose");   // game-over sound
    S.phase = "done";
    cancelAnimationFrame(rafId);
    wrongMsg.classList.remove("is-shown");
    hud.setTime(0);
    hud.setStars(0);
    window.Memoir.history.add("decor", S.level, { win: false, sec: CONFIG.timeLimit, miss: S.misses, stars: 0 });
    window.Memoir.wallet.loseHeart();
    ring(S.target.id, "is-reveal");
    const level = S.level;
    const name = S.ITEMS[S.target.id].name;
    const how = S.kind === "colour" ? "เปลี่ยนสี" : (S.sizeDir > 0 ? "ขยายใหญ่ขึ้น" : "เล็กลง");
    // Let the player see which item it was before the popup covers the room
    note.textContent = "หมดเวลา! ดูของที่เปลี่ยน";
    note.hidden = false;
    const myState = S;
    setTimeout(() => { if (S === myState) note.hidden = true; }, 2500);
    // Time-out popup: plain version until its art arrives
    setTimeout(() => S === myState && A.plainPopup(els.modal, els.card, {
      title: "หมดเวลา",
      lines: [`ของที่เปลี่ยนคือ "${name}"`, `(${how})`, "(เสียหัวใจ 1 ดวง)"],
      buttons: [
        { label: "ลองอีกครั้ง", primary: true, onClick: () => start(level) },
        { label: "เลือกด่าน", onClick: exitToLevels },
      ],
    }), 2600);
  }

  function exitToLevels() {
    stop();
    hidePopups();
    window.Memoir.showScreen("screen-levels-decor");
  }

  // ---------- Exit button (pauses while asking) ----------
  function onExit() {
    if (!S || S.phase === "done" || S.phase === "stopped") { exitToLevels(); return; }
    S.paused = true;
    exitPop.hidden = false;
  }
  function resume() {
    exitPop.hidden = true;
    if (!S) return;
    if (S.land !== isLand() && S.phase !== "done") { start(S.level); return; }   // turned while paused
    S.paused = false;
    S.last = performance.now();
  }

  // Pause when the app goes to the background
  document.addEventListener("visibilitychange", () => {
    if (!S || !els.screen.classList.contains("is-active")) return;
    if (document.hidden) S.paused = true;
    else if (!popupOpen()) { S.paused = false; S.last = performance.now(); }
  });

  // Screen turned during a level: the other room has other items, so watch the new room from the
  // start (same level, no heart lost). Not while a popup is open (resume() checks again).
  if (window.Memoir.orient) window.Memoir.orient.on((land) => {
    if (!S || S.land === land || !els.screen.classList.contains("is-active")) return;
    if (S.phase === "done" || S.phase === "stopped" || popupOpen()) return;
    start(S.level);
  });

  // debug: inspect / fast-forward from the browser console, e.g. Memoir.decor.debug.state().elapsed = 55
  window.Memoir.decor = { start, stop, CONFIG, debug: { state: () => S } };
})();

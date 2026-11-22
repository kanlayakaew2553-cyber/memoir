/* Memory Market — remember the shopping list, then collect it by dropping fruit into a basket.
 *
 * One level:
 *   - A list of 2–3 kinds with 1–9 of each is shown for 5 seconds (no input), then hidden.
 *   - One fruit at a time waits at the top. Drag left / right, let go → it falls into the basket
 *     and rolls with gravity (like real fruit). The next fruit is shown in the "ถัดไป" box.
 *   - 3 or more fruits of the same kind touching each other vanish = 1 collected
 *     (every 3 in the group count 1). Fruit that falls in afterwards can make combos.
 *   - Collected counts of all 6 kinds are shown; the list itself stays hidden.
 *   - Every kind on the list reached → win right away. No time limit.
 *     Stars: exact → 3; a kind over by 1–2 → 2; over by more, or collected a kind not on the list → 1.
 *   - Fruit sticking out above the dashed line for 2 seconds = basket full → lost (−1 heart, to come).
 */
(() => {
  "use strict";

  // =====================================================================
  // Settings (tune here)
  // =====================================================================
  const CONFIG = {
    previewSeconds: 5,       // the list is shown this long
    dropCooldown: 0.55,      // seconds before the next fruit appears
    gravity: 190,            // world units / s² (world is 100 wide)
    dangerSeconds: 2.0,      // above the line this long → basket full
    settleGrace: 1.3,        // a fruit that was just dropped is not checked against the line
    touchGap: 0.8,           // how close (world units) counts as "touching"
    questShare: 0.82,        // chance the next fruit is a kind on the list
    maxDistractorRun: 1,     // never 2 off-list fruits in a row
    maxLevel: 100,
    // PLACEHOLDER until the coin system is defined
    coinRewardByStars: [0, 10, 20, 30],
  };

  // Difficulty by level (see the design notes)
  function levelSpec(level) {
    const pick = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    if (level <= 10) return { kinds: 2, min: 1, max: 2, distract: 1 };
    if (level <= 30) return { kinds: pick(2, 3), min: 1, max: 4, distract: 2 };
    if (level <= 60) return { kinds: 3, min: 2, max: 6, distract: 3 };
    return { kinds: 3, min: 3, max: 9, distract: 3 };
  }

  // Stars from the final counts
  function starsFor(quest, collected) {
    let over = 0;
    const listed = new Set(quest.map((q) => q.t));
    for (const q of quest) over = Math.max(over, collected[q.t] - q.target);
    const wrong = collected.some((c, t) => c > 0 && !listed.has(t));
    if (wrong || over > 2) return 1;
    if (over > 0) return 2;
    return 3;
  }

  // =====================================================================
  // The 6 kinds (art: assets/market/web/<id>.png, made by tools/prep_market.ps1).
  // shape = sprite size + collision circles that follow the drawn outline (pixels of the sprite),
  // copied from assets/market/web/market.json.
  // =====================================================================
  const ART_DIR = "assets/market/web/";
  const KINDS = [
    { id: "chomphu",    name: "ชมพู่",  color: "#f25a6a",
      shape: { w: 182, h: 256, area: 25336, com: [94.577, 153.598], circles: [[80, 182, 73.84], [103, 106, 38.48]] } },
    { id: "durian",     name: "ทุเรียน", color: "#a89a2a",
      shape: { w: 187, h: 256, area: 29495, com: [95.507, 141.637], circles: [[94, 138, 84.995]] } },
    { id: "mango",      name: "มะม่วง", color: "#f2b81c",
      shape: { w: 151, h: 256, area: 24975, com: [72.025, 142.723], circles: [[78, 116, 74.88], [60, 195, 52.51]] } },
    { id: "mangosteen", name: "มังคุด", color: "#7a3a8c",
      shape: { w: 246, h: 256, area: 46776, com: [122.691, 126.541], circles: [[125, 135, 120.461]] } },
    { id: "orange",     name: "ส้ม",    color: "#f57a1f",
      shape: { w: 232, h: 256, area: 42163, com: [118.871, 137.478], circles: [[117, 146, 112.803]] } },
    { id: "watermelon", name: "แตงโม",  color: "#e8483f",
      shape: { w: 254, h: 256, area: 36014, com: [131.756, 158.924], circles: [[136, 165, 92.56], [142, 65, 40.745], [42, 208, 34], [222, 208, 34]] } },   // + the 2 bottom corners
  ];
  const FRUIT_SIZE = 7.2;   // every fruit gets the drawn area of a circle this big (world units)
  KINDS.forEach((k) => {
    const sh = k.shape;
    const s = Math.sqrt(Math.PI * FRUIT_SIZE * FRUIT_SIZE / sh.area);   // world units per sprite pixel
    k.scale = s;
    k.circles = sh.circles.map(([x, y, r]) => ({ x: (x - sh.com[0]) * s, y: (y - sh.com[1]) * s, r: r * s }));
    k.bound = Math.max(...k.circles.map((c) => Math.hypot(c.x, c.y) + c.r));
    // mass from the circles; inertia of the circles about the centre
    let m = 0, I = 0;
    k.circles.forEach((c) => { const mi = c.r * c.r; m += mi; I += mi * (c.r * c.r / 2 + c.x * c.x + c.y * c.y); });
    k.mass = m; k.inertia = I;
    k.halfW = Math.max(...k.circles.map((c) => Math.abs(c.x) + c.r));   // for keeping it inside when held
    k.src = `${ART_DIR}${k.id}.png`;
    const im = new Image();
    im.onload = () => { k.image = im; };
    im.src = k.src;
  });

  // =====================================================================
  // World: 100 × 177.8 units (9:16). The basket art (basket_b, the deep one) is laid out here;
  // its inner walls come from the art outline (tools/prep_market.ps1 → market.json "walls").
  // =====================================================================
  const W = 100, H = 100 * 16 / 9;
  const BASKET_ART = {
    src: ART_DIR + "basket_b.png",
    aspect: (86.34 * 1080) / (58.15 * 1920),   // width / height of the art
    // [y, left, right] in % of the cropped basket, from its widest row (the rim) down
    rows: [[46.505,0.322,99.464],[49.731,0.429,99.356],[52.957,0.536,99.249],[56.183,0.858,98.82],[59.409,1.502,98.391],
           [62.634,2.253,97.425],[65.86,3.219,96.459],[69.086,4.614,95.172],[72.312,6.009,93.67],[75.538,7.833,91.845],
           [78.763,9.871,89.807],[81.989,12.446,87.232],[85.215,15.451,84.227],[88.441,18.991,80.794],[91.667,23.498,76.288],
           [94.892,29.399,70.386],[96.505,33.691,66.738],[98.118,38.948,60.73]],
    rimTop: 26,          // % of the art: top of the rim ellipse (the "full" line sits here)
  };
  const BASKET = (() => {
    const w = 96, x = 2;
    const h = w / BASKET_ART.aspect;
    const bottom = H * 0.975, y = bottom - h;
    const P = ([py, pl, pr]) => [y + py / 100 * h, x + pl / 100 * w, x + pr / 100 * w];
    const rows = BASKET_ART.rows.map(P);
    return { x, y, w, h, rows, rimY: rows[0][0], left: rows[0][1], right: rows[0][2], bottom: rows[rows.length - 1][0] };
  })();
  const WALL_PAD = 3.2;                                   // thickness of the wicker
  const DANGER_Y = BASKET.y + BASKET_ART.rimTop / 100 * BASKET.h;
  const HOLD_Y = 44;
  // Wall segments: straight up from the rim, along the bowl, across the bottom, back up
  const WALLS = (() => {
    const L = [[BASKET.left, -40], ...BASKET.rows.map((r) => [r[1], r[0]])];
    const R = [[BASKET.right, -40], ...BASKET.rows.map((r) => [r[2], r[0]])];
    const pts = [...L, ...R.reverse()];
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
    return segs;
  })();
  const basketImg = new Image();
  basketImg.src = BASKET_ART.src;

  const $ = (id) => document.getElementById(id);
  const A = window.Memoir.artUI;
  const els = {
    screen: $("screen-market-game"), canvas: $("market-canvas"), flash: $("market-flash"),
    modal: $("market-modal"), card: $("market-modal-card"),
  };
  const g = els.canvas.getContext("2d");

  function iconEl(t, size) {
    const k = KINDS[t];
    const el = document.createElement("img");
    el.src = k.src;
    el.alt = "";
    el.draggable = false;
    el.className = "mk-icon";
    el.setAttribute("aria-label", k.name);
    if (size) el.style.setProperty("--s", size);
    return el;
  }

  // ---------- Art UI ----------
  const root = $("market-ui");
  const hud = A.topBar(root, { onExit: () => onExit(), timer: false });
  // Stars only come at the end here (showing them live would give the list away)
  hud.el.querySelectorAll('img[src*="top_star"]').forEach((i) => { i.hidden = true; });

  const counters = document.createElement("div");
  counters.className = "mk-counters mk-font";
  root.appendChild(counters);

  const nextBox = document.createElement("div");
  nextBox.className = "mk-next mk-font";
  root.appendChild(nextBox);

  const questCard = document.createElement("div");
  questCard.className = "mk-quest mk-font";
  questCard.hidden = true;
  root.appendChild(questCard);

  const hint = document.createElement("div");
  hint.className = "melody-hint mk-hint";
  root.appendChild(hint);

  const exitPop = A.exitPopup(root, { onExit: () => exitToLevels(), onContinue: () => resume() });
  const win$ = A.winPopup(root, {
    onNext: () => start(S.level + 1),
    onReplay: () => start(S.level),
    onLevels: () => exitToLevels(),
  });

  // =====================================================================
  // Game state
  // =====================================================================
  let S = null;
  let raf = 0, last = 0;

  function popupOpen() { return !exitPop.hidden || !win$.el.hidden || !els.modal.hidden; }
  function hidePopups() { exitPop.hidden = true; win$.el.hidden = true; els.modal.hidden = true; }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function start(level) {
    if (!window.Memoir.wallet.check(() => start(level))) return;   // out of hearts
    stop();
    const spec = levelSpec(level);
    const order = shuffle(KINDS.map((_, i) => i));
    const quest = order.slice(0, spec.kinds).map((t) => ({
      t, target: spec.min + Math.floor(Math.random() * (spec.max - spec.min + 1)),
    }));
    const distract = order.slice(spec.kinds, spec.kinds + spec.distract);
    S = {
      level, quest, distract,
      collected: KINDS.map(() => 0),
      fruits: [], floaters: [],
      phase: "memorize", memLeft: CONFIG.previewSeconds,
      held: null, heldX: 50, cooldown: 0, next: null,
      distractorRun: 0, dropsSincePop: 1,
      time: 0, warn: 0, paused: false, result: null,
    };
    hud.setLevel(level);
    hidePopups();
    buildCounters();
    buildQuest();
    nextBox.hidden = true;
    hint.textContent = "";
    window.Memoir.showScreen("screen-market-game");
    resize();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (S) S.phase = "stopped";
  }

  function buildCounters() {
    counters.innerHTML = "";
    KINDS.forEach((_, t) => {
      const chip = document.createElement("div");
      chip.className = "mk-chip";
      const b = document.createElement("b");
      b.textContent = "0";
      chip.append(iconEl(t), b);
      counters.appendChild(chip);
    });
  }
  function bumpCounter(t) {
    const chip = counters.children[t];
    chip.querySelector("b").textContent = S.collected[t];
    chip.classList.remove("is-bump"); void chip.offsetWidth; chip.classList.add("is-bump");
  }

  function buildQuest() {
    questCard.innerHTML = "<h3>จำรายการนี้ไว้นะ</h3><ul></ul><div class='mk-count'></div>";
    const ul = questCard.querySelector("ul");
    S.quest.forEach((q) => {
      const li = document.createElement("li");
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = `× ${q.target}`;
      li.append(iconEl(q.t), n);
      ul.appendChild(li);
    });
    questCard.hidden = false;
    questCard.querySelector(".mk-count").textContent = CONFIG.previewSeconds;
  }

  function beginPlay() {
    S.phase = "play";
    questCard.hidden = true;
    S.next = nextKind();
    serveNext();
    if (S.level <= 3) {
      hint.textContent = "ลากผลไม้ไปซ้าย-ขวา แล้วปล่อยลงตะกร้า";
      const my = S;
      setTimeout(() => { if (S === my) hint.textContent = ""; }, 3500);
    }
  }

  // ---------- Which fruit comes next (fair: mostly kinds on the list, the ones still needed most) ----------
  function inPlay(t) {
    let n = S.fruits.filter((f) => f.t === t && !f.popping).length;
    if (S.held && S.held.t === t) n++;
    if (S.next === t) n++;
    return n;
  }
  // A kind the player should NOT collect (off the list, or already has enough) may only come
  // when it cannot force a mistake: at most 2 in play, or a 3rd only while the 2 in the basket
  // lie apart — then 3 together only happens if the player drops it next to them.
  function safeExtra(t) {
    const n = inPlay(t);
    if (n < 2) return true;
    if (n > 2) return false;
    const two = S.fruits.filter((f) => f.t === t && !f.popping);
    if (two.length !== 2) return false;                 // one is still waiting at the top
    return gapBetween(two[0], two[1]) > CONFIG.touchGap + 6;
  }
  function done(q) { return S.collected[q.t] >= q.target; }
  function nextKind() {
    const extras = S.distract.filter(safeExtra);
    const useList = Math.random() < CONFIG.questShare || S.distractorRun >= CONFIG.maxDistractorRun || !extras.length;
    if (useList) {
      const weights = S.quest.map((q) => {
        if (done(q)) return safeExtra(q.t) ? 0.25 : 0;                // already done: rarely, and only safely
        const need = q.target - S.collected[q.t];
        return Math.min(6, Math.max(1, need * 3 - inPlay(q.t)));      // still needed: often
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        S.distractorRun = 0;
        let r = Math.random() * sum;
        for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0 && weights[i] > 0) return S.quest[i].t; }
        return S.quest[weights.findIndex((w) => w > 0)].t;
      }
    }
    if (extras.length) {
      S.distractorRun++;
      return extras[Math.floor(Math.random() * extras.length)];
    }
    // nothing is safe (very full basket): give a kind that is still needed
    const open = S.quest.filter((q) => !done(q));
    return (open.length ? open : S.quest)[0].t;
  }

  function serveNext() {
    S.held = { t: S.next };
    S.heldX = clampX(S.heldX, S.held.t);
    S.next = nextKind();
    nextBox.innerHTML = "<span>ถัดไป</span>";
    nextBox.appendChild(iconEl(S.next));
    nextBox.hidden = false;
  }

  function clampX(x, t) {
    const m = KINDS[t].halfW + WALL_PAD + 0.3;
    return Math.max(BASKET.left + m, Math.min(BASKET.right - m, x));
  }

  function drop() {
    if (!S.held) return;
    const t = S.held.t, k = KINDS[t];
    const x = clampX(S.heldX, t);
    S.fruits.push({
      t, x, y: HOLD_Y, vx: 0, vy: 0, a: 0, w: (Math.random() - 0.5) * 0.6,
      invM: 1 / k.mass, invI: 1 / k.inertia, k,
      wc: k.circles.map(() => ({ x: 0, y: 0, r: 0 })),
      sq: 0, sqv: 0, rest: 0, droppedAt: S.time, above: 0, popping: false, pop: 0,
    });
    S.held = null;
    S.cooldown = CONFIG.dropCooldown;
    S.dropsSincePop++;
  }

  // ---------- Input: drag left/right, let go to drop ----------
  let dragging = false;
  function worldX(e) {
    const r = els.canvas.getBoundingClientRect();
    return (e.clientX - r.left) / r.width * W;
  }
  els.canvas.addEventListener("pointerdown", (e) => {
    if (!S || S.phase !== "play" || !S.held || popupOpen()) return;
    e.preventDefault();
    dragging = true;
    try { els.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    S.heldX = clampX(worldX(e), S.held.t);
  });
  els.canvas.addEventListener("pointermove", (e) => {
    if (!dragging || !S || !S.held) return;
    S.heldX = clampX(worldX(e), S.held.t);
  });
  const endDrag = (e, doDrop) => {
    if (!dragging) return;
    dragging = false;
    if (doDrop && S && S.phase === "play" && S.held && !popupOpen()) {
      S.heldX = clampX(worldX(e), S.held.t);
      drop();
    }
  };
  els.canvas.addEventListener("pointerup", (e) => endDrag(e, true));
  els.canvas.addEventListener("pointercancel", (e) => endDrag(e, false));

  // =====================================================================
  // Loop
  // =====================================================================
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S && !S.paused) update(dt);
    draw();
  }

  function update(dt) {
    S.time += dt;
    if (S.phase === "memorize") {
      S.memLeft -= dt;
      questCard.querySelector(".mk-count").textContent = Math.max(1, Math.ceil(S.memLeft));
      if (S.memLeft <= 0) beginPlay();
      return;
    }
    physics(dt);
    S.fruits.forEach((f) => { if (f.popping) f.pop += dt; });
    S.fruits = S.fruits.filter((f) => !f.popping || f.pop < 0.3);
    S.floaters.forEach((fl) => { fl.age += dt; });
    S.floaters = S.floaters.filter((fl) => fl.age < 1.1);
    if (S.phase !== "play") return;
    findGroups();
    if (S.phase !== "play") return;
    checkFull(dt);
    if (!S.held) {
      S.cooldown -= dt;
      if (S.cooldown <= 0 && S.phase === "play") serveNext();
    }
  }

  // =====================================================================
  // Rigid-body physics for shaped fruit
  //   Each fruit is a rigid body made of 1–2 circles that follow its drawn outline, so a mango
  //   lies on its side, a watermelon slice tips over, round fruit rolls. Impulses with friction
  //   and a little bounce; hard hits squash the fruit for a moment (wobble).
  // =====================================================================
  const PHYS = {
    substeps: 6,
    iterations: 8,
    bounce: 0.22,          // restitution for hard hits
    bounceMin: 30,         // slower hits (units/s) don't bounce → the pile settles
    friction: 0.5,
    wallFriction: 0.35,
    slop: 0.04,            // allowed overlap (world units)
    push: 0.55,            // share of overlap fixed per step
    damping: 0.9995,       // velocity kept per substep (air)
    angDamping: 0.997,
    restSpeed: 1.2,        // below this (units/s) a touching fruit counts as resting
    squashPerSpeed: 0.0011,
    squashMax: 0.2,
    wobbleSpring: 260,
    wobbleDamp: 11,
  };

  function updateCircles(f) {
    const c = Math.cos(f.a), s = Math.sin(f.a), shrink = f.popping ? Math.max(0.05, 1 - f.pop / 0.3) : 1;
    f.k.circles.forEach((lc, i) => {
      const w = f.wc[i];
      w.x = f.x + c * lc.x - s * lc.y;
      w.y = f.y + s * lc.x + c * lc.y;
      w.r = lc.r * shrink;
    });
  }

  function squash(f, speed) {
    const s = Math.min(PHYS.squashMax, speed * PHYS.squashPerSpeed);
    if (s > 0.02 && s > Math.abs(f.sq)) { f.sq = s; f.sqv = 0; }
  }

  // contact: A may be null (a wall). n points from A to B; (px,py) = contact point.
  function addContact(list, A, B, nx, ny, pen, px, py) {
    const rbx = px - B.x, rby = py - B.y;
    const rax = A ? px - A.x : 0, ray = A ? py - A.y : 0;
    const iA = A ? A.invM : 0, iIA = A ? A.invI : 0;
    const rnA = rax * ny - ray * nx, rnB = rbx * ny - rby * nx;
    const tx = -ny, ty = nx;
    const rtA = rax * ty - ray * tx, rtB = rbx * ty - rby * tx;
    const kn = iA + B.invM + rnA * rnA * iIA + rnB * rnB * B.invI;
    const kt = iA + B.invM + rtA * rtA * iIA + rtB * rtB * B.invI;
    // approach speed for bounce + squash
    const vrx = (B.vx - B.w * rby) - (A ? A.vx - A.w * ray : 0);
    const vry = (B.vy + B.w * rbx) - (A ? A.vy + A.w * rax : 0);
    const vn = vrx * nx + vry * ny;
    if (-vn > PHYS.bounceMin) { squash(B, -vn); if (A) squash(A, -vn); }
    list.push({
      A, B, nx, ny, tx, ty, pen, rax, ray, rbx, rby, kn, kt,
      bias: -vn > PHYS.bounceMin ? -vn * PHYS.bounce : 0,
      mu: A ? PHYS.friction : PHYS.wallFriction, jn: 0, jt: 0,
    });
    B.touch = true; if (A) A.touch = true;
  }

  function findContacts(F) {
    const list = [];
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      if (a.popping) continue;
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j];
        if (b.popping) continue;
        const R = a.k.bound + b.k.bound;
        if (Math.abs(a.x - b.x) > R || Math.abs(a.y - b.y) > R) continue;
        for (const ca of a.wc) for (const cb of b.wc) {
          const dx = cb.x - ca.x, dy = cb.y - ca.y, min = ca.r + cb.r, d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          addContact(list, a, b, nx, ny, min - d, ca.x + nx * ca.r, ca.y + ny * ca.r);
        }
      }
      // basket walls
      for (const c of a.wc) {
        for (const [x1, y1, x2, y2] of WALLS) {
          const ex = x2 - x1, ey = y2 - y1, len2 = ex * ex + ey * ey;
          let u = ((c.x - x1) * ex + (c.y - y1) * ey) / len2;
          u = Math.max(0, Math.min(1, u));
          const qx = x1 + ex * u, qy = y1 + ey * u;
          const dx = c.x - qx, dy = c.y - qy, rr = c.r + WALL_PAD, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          const d = Math.sqrt(d2);
          addContact(list, null, a, dx / d, dy / d, rr - d, qx + dx / d * WALL_PAD, qy + dy / d * WALL_PAD);
        }
      }
    }
    return list;
  }

  function applyImpulse(c, px, py) {
    const A = c.A, B = c.B;
    B.vx += px * B.invM; B.vy += py * B.invM; B.w += (c.rbx * py - c.rby * px) * B.invI;
    if (A) { A.vx -= px * A.invM; A.vy -= py * A.invM; A.w -= (c.rax * py - c.ray * px) * A.invI; }
  }

  function physics(dt) {
    const F = S.fruits, h = dt / PHYS.substeps, G = CONFIG.gravity;
    for (let s = 0; s < PHYS.substeps; s++) {
      for (const f of F) { f.vy += G * h; f.touch = false; updateCircles(f); }
      const C = findContacts(F);
      for (let it = 0; it < PHYS.iterations; it++) {
        for (const c of C) {
          const A = c.A, B = c.B;
          const vrx = (B.vx - B.w * c.rby) - (A ? A.vx - A.w * c.ray : 0);
          const vry = (B.vy + B.w * c.rbx) - (A ? A.vy + A.w * c.rax : 0);
          // push apart along the normal
          const vn = vrx * c.nx + vry * c.ny;
          let dj = (-vn + c.bias) / c.kn;
          const jn = Math.max(0, c.jn + dj); dj = jn - c.jn; c.jn = jn;
          applyImpulse(c, c.nx * dj, c.ny * dj);
          // friction along the surface (makes fruit roll instead of slide)
          const vt = vrx * c.tx + vry * c.ty;
          let djt = -vt / c.kt;
          const maxF = c.mu * c.jn;
          const jt = Math.max(-maxF, Math.min(maxF, c.jt + djt)); djt = jt - c.jt; c.jt = jt;
          applyImpulse(c, c.tx * djt, c.ty * djt);
        }
      }
      for (const f of F) {
        f.vx *= PHYS.damping; f.vy *= PHYS.damping; f.w *= PHYS.angDamping;
        // a touching, almost-still fruit settles fully (no slow creeping)
        if (f.touch && Math.hypot(f.vx, f.vy) < PHYS.restSpeed && Math.abs(f.w) < 0.3) {
          f.vx *= 0.85; f.vy *= 0.85; f.w *= 0.85;
        }
        f.x += f.vx * h; f.y += f.vy * h; f.a += f.w * h;
      }
      // fix leftover overlap
      for (const c of C) {
        const corr = Math.max(0, c.pen - PHYS.slop) * PHYS.push;
        if (!corr) continue;
        const iA = c.A ? c.A.invM : 0, sum = iA + c.B.invM;
        c.B.x += c.nx * corr * c.B.invM / sum; c.B.y += c.ny * corr * c.B.invM / sum;
        if (c.A) { c.A.x -= c.nx * corr * iA / sum; c.A.y -= c.ny * corr * iA / sum; }
      }
    }
    for (const f of F) {
      updateCircles(f);
      f.sqv += (-PHYS.wobbleSpring * f.sq - PHYS.wobbleDamp * f.sqv) * dt;
      f.sq += f.sqv * dt;
      if (Math.abs(f.sq) < 0.002 && Math.abs(f.sqv) < 0.02) { f.sq = 0; f.sqv = 0; }
    }
  }

  // Smallest gap between two fruits' shapes (negative = overlapping)
  function gapBetween(a, b) {
    let best = Infinity;
    for (const ca of a.wc) for (const cb of b.wc) best = Math.min(best, Math.hypot(cb.x - ca.x, cb.y - ca.y) - ca.r - cb.r);
    return best;
  }

  // 3+ of the same kind touching → vanish, every 3 count 1
  function findGroups() {
    const F = S.fruits.filter((f) => !f.popping);
    const seen = new Set();
    let found = false;
    for (const f of F) {
      if (seen.has(f)) continue;
      const group = [f], queue = [f];
      seen.add(f);
      while (queue.length) {
        const a = queue.pop();
        for (const b of F) {
          if (seen.has(b) || b.t !== a.t) continue;
          if (Math.abs(a.x - b.x) > a.k.bound + b.k.bound + 2) continue;
          if (gapBetween(a, b) <= CONFIG.touchGap) { seen.add(b); group.push(b); queue.push(b); }
        }
      }
      if (group.length < 3) continue;
      found = true;
      const n = Math.floor(group.length / 3);
      group.forEach((g2) => { g2.popping = true; g2.pop = 0; });
      S.collected[f.t] += n;
      bumpCounter(f.t);
      const cx = group.reduce((s, g2) => s + g2.x, 0) / group.length;
      const cy = group.reduce((s, g2) => s + g2.y, 0) / group.length;
      S.floaters.push({ x: cx, y: cy, text: `+${n}`, age: 0 });
      if (S.dropsSincePop === 0) S.floaters.push({ x: cx, y: cy - 10, text: "คอมโบ!", age: 0, combo: true });
      playPop(S.dropsSincePop === 0);
    }
    if (!found) return;
    S.dropsSincePop = 0;
    if (S.quest.every((q) => S.collected[q.t] >= q.target)) win();
  }

  function checkFull(dt) {
    let worst = 0;
    for (const f of S.fruits) {
      const top = Math.min(...f.wc.map((c) => c.y - c.r));
      if (!f.popping && S.time - f.droppedAt > CONFIG.settleGrace && top < DANGER_Y) {
        f.above += dt;
        worst = Math.max(worst, f.above);
      } else f.above = 0;
    }
    S.warn = worst;
    if (worst >= CONFIG.dangerSeconds) lose();
  }

  // =====================================================================
  // Drawing
  // =====================================================================
  let scale = 1;
  function resize() {
    const r = els.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    els.canvas.width = Math.round(r.width * dpr);
    els.canvas.height = Math.round(r.height * dpr);
    scale = els.canvas.width / W;
  }
  new ResizeObserver(resize).observe(els.canvas);

  function draw() {
    if (!S) return;
    const c = g;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, els.canvas.width, els.canvas.height);
    c.setTransform(scale, 0, 0, scale, 0, 0);

    if (basketImg.complete && basketImg.naturalWidth) c.drawImage(basketImg, BASKET.x, BASKET.y, BASKET.w, BASKET.h);

    // "full" line across the rim
    const warn = S.warn > 0.25;
    c.save();
    c.setLineDash([3, 2.2]);
    c.lineWidth = 0.9;
    c.strokeStyle = warn ? (Math.floor(S.time * 6) % 2 ? "#ff2a1a" : "#ffd0c8") : "rgba(253,240,213,0.85)";
    c.beginPath(); c.moveTo(BASKET.left + 3, DANGER_Y); c.lineTo(BASKET.right - 3, DANGER_Y); c.stroke();
    c.restore();

    S.fruits.forEach((f) => {
      const size = f.popping ? Math.max(0.05, 1 - f.pop / 0.3) : 1;
      drawFruit(c, f.t, f.x, f.y, f.a, f.popping ? 1 - f.pop / 0.3 : 1, f.sq, size);
    });

    // fruit waiting at the top + guide line
    if (S.held && S.phase === "play") {
      c.save();
      c.setLineDash([1.4, 1.8]);
      c.lineWidth = 0.5;
      c.strokeStyle = "rgba(255,250,235,0.85)";
      c.beginPath(); c.moveTo(S.heldX, HOLD_Y + KINDS[S.held.t].bound); c.lineTo(S.heldX, BASKET.bottom); c.stroke();
      c.restore();
      drawFruit(c, S.held.t, S.heldX, HOLD_Y, 0, 1, 0, 1);
    }

    // "+1" / "คอมโบ!"
    S.floaters.forEach((fl) => {
      const a = 1 - fl.age / 1.1;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.font = `${fl.combo ? 7 : 9}px Itim, sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.lineWidth = 1.6; c.strokeStyle = "#fdf0d5";
      c.fillStyle = fl.combo ? "#d2491b" : "#7a2e0e";
      const y = fl.y - fl.age * 14;
      c.strokeText(fl.text, fl.x, y); c.fillText(fl.text, fl.x, y);
      c.restore();
    });
  }

  // Fruit sprite drawn around its centre of mass, turned by its angle; squash keeps the bottom in place
  function drawFruit(c, t, x, y, ang, alpha, sq, size) {
    const k = KINDS[t], sh = k.shape, s = k.scale * size;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y + FRUIT_SIZE * sq);
    c.scale(1 + sq, 1 - sq);
    c.rotate(ang);
    if (k.image) {
      c.drawImage(k.image, -sh.com[0] * s, -sh.com[1] * s, sh.w * s, sh.h * s);
    } else {
      c.fillStyle = k.color;
      k.circles.forEach((lc) => { c.beginPath(); c.arc(lc.x * size, lc.y * size, lc.r * size, 0, Math.PI * 2); c.fill(); });
    }
    c.restore();
  }

  // ---------- Sounds (Web Audio, no files) ----------
  let audio = null;
  function ac() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  function playPop(combo) {
    try {
      const a = ac(), t = a.currentTime;
      [0, combo ? 0.09 : null].forEach((d, i) => {
        if (d === null) return;
        const o = a.createOscillator(), gn = a.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(i ? 880 : 620, t + d);
        o.frequency.exponentialRampToValueAtTime(i ? 1320 : 980, t + d + 0.12);
        gn.gain.setValueAtTime(0.0001, t + d);
        gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.25 * ((window.Memoir.sound && window.Memoir.sound.volume) ?? 1)), t + d + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
        o.connect(gn); gn.connect(a.destination);
        o.start(t + d); o.stop(t + d + 0.3);
      });
    } catch (e) { /* no sound */ }
  }

  // =====================================================================
  // End of level
  // =====================================================================
  function win() {
    S.phase = "done";
    S.held = null;
    nextBox.hidden = true;
    hint.textContent = "ครบแล้ว เก่งมาก!";
    const stars = starsFor(S.quest, S.collected);
    window.Memoir.progress.setStars("market", S.level, stars);
    const listed = new Set(S.quest.map((q) => q.t));
    const extra = S.quest.reduce((s, q) => s + Math.max(0, S.collected[q.t] - q.target), 0) +
                  S.collected.reduce((s, c, t) => s + (listed.has(t) ? 0 : c), 0);
    window.Memoir.history.add("market", S.level, { win: true, sec: S.time - CONFIG.previewSeconds, miss: extra, stars, full: false });
    window.Memoir.wallet.addCoins(CONFIG.coinRewardByStars[stars]);
    win$.fill({
      stars, seconds: Math.round(S.time - CONFIG.previewSeconds), misses: extra,
      coins: CONFIG.coinRewardByStars[stars], hasNext: S.level < CONFIG.maxLevel,
    });
    const my = S;
    setTimeout(() => { if (S === my) { hint.textContent = ""; win$.show(); } }, 1100);
  }

  function lose() {
    if (window.Memoir.sound) window.Memoir.sound.play("lose");   // game-over sound
    S.phase = "done";
    S.held = null;
    nextBox.hidden = true;
    els.flash.classList.remove("is-on"); void els.flash.offsetWidth; els.flash.classList.add("is-on");
    if (navigator.vibrate) navigator.vibrate(150);
    window.Memoir.history.add("market", S.level, { win: false, sec: S.time - CONFIG.previewSeconds, miss: 0, stars: 0, full: true });
    window.Memoir.wallet.loseHeart();
    const level = S.level;
    A.plainPopup(els.modal, els.card, {
      title: "ตะกร้าเต็มแล้ว",
      lines: ["ไม่เป็นไรนะ ลองใหม่อีกครั้ง", "(เสียหัวใจ 1 ดวง)"],
      buttons: [
        { label: "ลองอีกครั้ง", primary: true, onClick: () => start(level) },
        { label: "เลือกด่าน", onClick: exitToLevels },
      ],
    });
  }

  function exitToLevels() {
    stop();
    hidePopups();
    window.Memoir.showScreen("screen-levels-market");
  }

  // ---------- Exit popup / leaving the app pause everything ----------
  function onExit() {
    if (!S || S.phase === "done" || S.phase === "stopped") { exitToLevels(); return; }
    S.paused = true;
    dragging = false;
    exitPop.hidden = false;
  }
  function resume() {
    exitPop.hidden = true;
    if (S) S.paused = false;
    last = performance.now();
  }
  document.addEventListener("visibilitychange", () => {
    if (!S || !els.screen.classList.contains("is-active")) return;
    if (document.hidden) S.paused = true;
    else if (!popupOpen()) { S.paused = false; last = performance.now(); }
  });

  window.Memoir.market = { start, stop, CONFIG, KINDS, levelSpec, starsFor, debug: { state: () => S, step: (dt) => { if (S) update(dt); }, draw: () => draw() } };
})();

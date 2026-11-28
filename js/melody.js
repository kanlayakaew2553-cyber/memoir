/* Memory Melody — Simon-style: watch the records light up with a melody, then tap them in order.
 *
 * One level:
 *   - The level has N notes (see notesFor). A melody is played in its real note order; which
 *     record lights up for each note is random (6 records).
 *   - Round k (k = 1…N): the first k records light up one by one with the first k notes,
 *     then the player taps the same k records in order. Each correct tap plays that note.
 *   - Wrong tap: every record flashes red, the same round is shown again.
 *   - All N done → win. Stars by wrong taps: 0 → 3, 1–3 → 2, 4 → 1. The 5th wrong tap → lost
 *     (and 1 heart is lost — heart system still to come).
 *   - After the records have played, the player has 10 seconds to tap the whole round;
 *     not finished in time → the level is lost (stars still come from wrong taps only).
 */
(() => {
  "use strict";

  // =====================================================================
  // Settings (tune here)
  // =====================================================================
  const CONFIG = {
    // Paced for older players: slow enough to follow each record comfortably
    lightOn: 1.3,          // seconds a record stays lit while showing the sequence
    gap: 0.6,              // seconds between two lit records
    roundPause: 1.6,       // pause before showing the next round
    retryPause: 1.2,       // pause before showing the same round again after a wrong tap
    tapLight: 0.5,         // how long a record lights when the player taps it
    redFlash: 1.4,         // seconds all records flash red after a wrong tap
    answerSeconds: 10,     // after the records have played: time to tap the whole round, else the level is lost
    maxMisses: 5,          // the 5th wrong tap loses the level
    maxLevel: 100,
    // PLACEHOLDER until the coin system is defined
    coinRewardByStars: [0, 10, 20, 30],
  };

  // Number of notes: levels 1–5 → 3, +1 every 5 levels up to level 50 (12), then +1 every 10 levels
  function notesFor(level) {
    level = Math.max(1, Math.min(CONFIG.maxLevel, level));
    if (level <= 50) return 3 + Math.floor((level - 1) / 5);
    return 12 + Math.ceil((level - 50) / 10);
  }

  // Stars by number of wrong taps
  function starsFor(misses) {
    if (misses === 0) return 3;
    if (misses <= 3) return 2;
    return 1;
  }

  // =====================================================================
  // Melodies — notes in the order they are played. Need at least 17 notes (level 100).
  // Note names: C D E F G A B, optional # (sharp), octave number. e.g. "C4", "F#4", "A5".
  // PLACEHOLDER: "Twinkle Twinkle Little Star" (public domain) until the real songs arrive.
  // =====================================================================
  const MELODIES = [
    {
      name: "Twinkle Twinkle Little Star",
      notes: ["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4",
              "G4", "G4", "F4", "F4", "E4", "E4", "D4"],
    },
  ];

  // =====================================================================
  // Sound (made in code with the Web Audio API — no sound files needed)
  // =====================================================================
  let audio = null;
  function ctx() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  // master volume from Settings (0–1)
  const vol = () => (window.Memoir.sound ? window.Memoir.sound.volume : 1);
  function freq(note) {
    const m = /^([A-G])(#?)(\d)$/.exec(note);
    if (!m) return 440;
    const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  }
  // Soft music-box / piano-like tone
  function playNote(note, seconds) {
    const ac = ctx(), t = ac.currentTime, f = freq(note);
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.35 * vol()), t + 0.015);
    out.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.5);
    out.connect(ac.destination);
    [[1, "triangle", 1], [2, "sine", 0.35], [3, "sine", 0.12]].forEach(([mul, type, vol]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f * mul; g.gain.value = vol;
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + seconds + 0.6);
    });
  }
  // Short low "wrong" sound
  function playWrong() {
    const ac = ctx(), t = ac.currentTime;
    [0, 0.18].forEach((d, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "square"; o.frequency.value = i ? 150 : 200;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.12 * vol()), t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
      o.connect(g); g.connect(ac.destination);
      o.start(t + d); o.stop(t + d + 0.3);
    });
  }

  // =====================================================================
  // Records (art: assets/melody/web, positions from its ui.json via tools/prep_ui.ps1)
  // =====================================================================
  const REC_DIR = "assets/melody/web/";
  const RECORDS = [
    { x: 12.04, y: 16.82, w: 35.93, h: 20.16 },   // rec1 top-left
    { x: 12.04, y: 42.14, w: 35.93, h: 20.16 },   // rec2 middle-left
    { x: 11.94, y: 66.51, w: 35.93, h: 20.16 },   // rec3 bottom-left
    { x: 55.74, y: 16.82, w: 35.93, h: 20.16 },   // rec4 top-right
    { x: 55.74, y: 42.14, w: 35.93, h: 20.16 },   // rec5 middle-right
    { x: 55.74, y: 66.51, w: 35.93, h: 20.16 },   // rec6 bottom-right
  ];

  const $ = (id) => document.getElementById(id);
  const A = window.Memoir.artUI;
  const els = {
    screen: $("screen-melody-game"), records: $("melody-records"), flash: $("melody-flash"),
    modal: $("melody-modal"), card: $("melody-modal-card"),
  };

  const recBtns = RECORDS.map((box, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rec";
    b.setAttribute("aria-label", `แผ่นเสียง ${i + 1}`);
    const im = document.createElement("img");
    im.src = `${REC_DIR}rec${i + 1}.png`;
    im.alt = "";
    im.draggable = false;
    b.appendChild(im);
    // landscape: 3 across × 2 rows (rec1-3 on top, rec4-6 below)
    const col = i % 3, row = Math.floor(i / 3);
    if (window.Memoir.orient) window.Memoir.orient.box(b, box, [12.1 + col * 26.3, 17 + row * 36, 23.25, 31], "center");
    else A.place(b, box);
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); onTap(i); });
    els.records.appendChild(b);
    return b;
  });

  // ---------- Art UI ----------
  const root = $("melody-ui");
  const hud = A.topBar(root, { onExit: () => onExit(), timer: false });

  // "ผิดได้อีก N ครั้ง" box (no art yet — sits where the timer box is in the Decor game)
  const tries = document.createElement("div");
  tries.className = "melody-tries";
  tries.innerHTML = '<small>ผิดได้อีก</small><b></b>';
  root.appendChild(tries);
  const triesNum = tries.querySelector("b");

  // Answer timer: appears after the records have played; 10 s to tap the whole round
  const timer = document.createElement("div");
  timer.className = "melody-timer";
  timer.hidden = true;
  timer.setAttribute("role", "timer");
  timer.innerHTML = '<b></b><small>วินาที</small>';
  root.appendChild(timer);
  const timerNum = timer.querySelector("b");

  // Hint at the bottom: "watch" / "your turn"
  const hint = document.createElement("div");
  hint.className = "melody-hint";
  root.appendChild(hint);

  // "โจทย์" frame: a glowing frame with a tag around the records while the song is being shown,
  // so it is obvious this is the part to watch (not to tap yet)
  const taskFrame = document.createElement("div");
  taskFrame.className = "melody-task";
  taskFrame.hidden = true;
  taskFrame.innerHTML = '<span class="melody-task-tag">โจทย์ · ดูและฟังให้ดี</span>';
  els.records.after(taskFrame);
  const showTask = (on) => { taskFrame.hidden = !on; };

  const exitPop = A.exitPopup(root, { onExit: () => exitToLevels(), onContinue: () => resume() });
  const win$ = A.winPopup(root, {
    onNext: () => start(S.level + 1),
    onReplay: () => start(S.level),
    onLevels: () => exitToLevels(),
  });

  // =====================================================================
  // Game
  // =====================================================================
  let S = null;

  const sleep = (sec) => new Promise((r) => setTimeout(r, sec * 1000));
  function popupOpen() { return !exitPop.hidden || !win$.el.hidden || !els.modal.hidden; }
  function hidePopups() { exitPop.hidden = true; win$.el.hidden = true; els.modal.hidden = true; }

  function randomButtons(n) {
    const seq = [];
    for (let i = 0; i < n; i++) {
      let b;
      do { b = Math.floor(Math.random() * RECORDS.length); } while (i > 0 && b === seq[i - 1]);   // no same record twice in a row
      seq.push(b);
    }
    return seq;
  }

  // =====================================================================
  // Coach (ด่านทดลองเล่น): freezes the game, darkens everything except what it talks about,
  // explains it, and waits for "เข้าใจแล้ว".
  // =====================================================================
  const coachEl = document.createElement("div");
  coachEl.className = "coach";
  coachEl.hidden = true;
  coachEl.innerHTML = `
    <div class="coach-spot"></div>
    <img class="coach-hand" src="assets/icons/web/hand.png" alt="" draggable="false">
    <div class="coach-box" role="dialog" aria-live="polite"><p></p><div class="coach-btns"></div></div>`;
  els.screen.appendChild(coachEl);
  const coachSpot = coachEl.querySelector(".coach-spot"), coachHand = coachEl.querySelector(".coach-hand");
  const coachBox = coachEl.querySelector(".coach-box"), coachText = coachEl.querySelector("p"), coachBtns = coachEl.querySelector(".coach-btns");

  // resolves with the index of the button pressed
  function coach(targets, text, { buttons = ["เข้าใจแล้ว"], hand = false, round = false } = {}) {
    return new Promise((resolve) => {
      const scr = els.screen.getBoundingClientRect();
      const pct = (v, size) => (v / size * 100) + "%";
      let r = null;
      if (targets && targets.length) {
        const rs = targets.map((t) => t.getBoundingClientRect());
        const pad = scr.width * 0.02;
        r = {
          l: Math.min(...rs.map((x) => x.left)) - pad, t: Math.min(...rs.map((x) => x.top)) - pad,
          r: Math.max(...rs.map((x) => x.right)) + pad, b: Math.max(...rs.map((x) => x.bottom)) + pad,
        };
        Object.assign(coachSpot.style, {
          left: pct(r.l - scr.left, scr.width), top: pct(r.t - scr.top, scr.height),
          width: pct(r.r - r.l, scr.width), height: pct(r.b - r.t, scr.height),
        });
      }
      coachEl.classList.toggle("no-spot", !r);
      coachSpot.classList.toggle("is-round", round);
      // the explanation goes under the spot when it is high on the screen, above it when low
      coachBox.style.top = coachBox.style.bottom = "";
      if (!r) coachBox.style.top = "34%";
      else if ((r.t + r.b) / 2 - scr.top < scr.height * 0.5) coachBox.style.top = pct(r.b - scr.top + scr.height * 0.02, scr.height);
      else coachBox.style.bottom = pct(scr.bottom - r.t + scr.height * 0.02, scr.height);
      coachHand.hidden = !(hand && r);
      if (hand && r) Object.assign(coachHand.style, { left: pct((r.l + r.r) / 2 - scr.left, scr.width), top: pct((r.t + r.b) / 2 - scr.top, scr.height) });
      coachText.textContent = text;
      coachBtns.innerHTML = "";
      buttons.forEach((label, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "coach-btn" + (i === 0 ? " is-primary" : "");
        b.textContent = label;
        b.addEventListener("click", () => { coachEl.hidden = true; resolve(i); });
        coachBtns.appendChild(b);
      });
      coachEl.hidden = false;
      coachBtns.firstChild.focus({ preventScroll: true });
    });
  }
  // shows a coach card once per practice (key); false if the game moved on meanwhile (exit / pause)
  async function teach(key, targets, text, token, opts) {
    if (!S || !S.practice || S.coached.has(key)) return true;
    await coach(targets, text, opts);
    if (!S || token !== S.token) return false;
    S.coached.add(key);
    return true;
  }

  // ด่านทดลองเล่น: 2 short rounds, no hearts, nothing saved, every step explained
  function practice() { start(1, { practice: true }); }

  function start(level, opts = {}) {
    const isPractice = !!opts.practice;
    if (!isPractice && !window.Memoir.wallet.check(() => start(level))) return;   // out of hearts
    stop();
    ctx();   // unlock sound (this runs from a tap)
    const n = isPractice ? 2 : notesFor(level);
    const songs = MELODIES.filter((m) => m.notes.length >= n);
    const song = (songs.length ? songs : MELODIES)[Math.floor(Math.random() * (songs.length || MELODIES.length))];
    S = {
      level, n, song,
      notes: song.notes.slice(0, n),
      buttons: randomButtons(n),
      round: 1, pos: 0, misses: 0,
      phase: "show", token: 0,
      activeMs: 0, since: performance.now(),
      practice: isPractice, coached: new Set(),
    };
    hud.setLevel(isPractice ? "ฝึก" : level);
    hud.setStars(3);
    triesNum.textContent = CONFIG.maxMisses;
    hidePopups();
    recBtns.forEach((b) => b.classList.remove("is-lit", "is-red"));
    window.Memoir.showScreen("screen-melody-game");
    playRound(1.2);
  }

  function stop() {
    showTask(false);
    coachEl.hidden = true;
    if (S) { S.token++; S.phase = "stopped"; }
    recBtns.forEach((b) => b.classList.remove("is-lit", "is-red"));
  }

  // Show the first `round` records with their notes, then let the player tap
  async function playRound(delay = CONFIG.roundPause) {
    const token = ++S.token;
    S.phase = "show";
    S.pos = 0;
    els.records.classList.add("is-locked");
    hint.textContent = `ฟังและดูให้ดีนะ (รอบ ${S.round}/${S.n})`;
    if (S.round === 1 && !await teach("intro", null,
      "ยินดีต้อนรับสู่ด่านทดลองเล่น\nด่านนี้ไม่เสียหัวใจ ลองได้เต็มที่\nจะมีคำอธิบายทุกขั้นตอนนะ", token)) return;
    if (S.round === 2 && !await teach("round2", null,
      "รอบต่อไปเพลงจะยาวขึ้นทีละ 1 โน้ต\nแผ่นเสียงจะสว่างทีละแผ่น\nจำลำดับให้ดี แล้วกดตามลำดับเดิม", token)) return;
    showTask(true);
    await sleep(delay);
    for (let i = 0; i < S.round; i++) {
      if (token !== S.token) return;
      const b = S.buttons[i];
      light(b, S.notes[i], CONFIG.lightOn);
      if (S.practice && !S.coached.has("light")) {
        // the first lit record: freeze it lit, darken the rest, explain
        await sleep(0.4);
        if (token !== S.token) return;
        clearTimeout(recBtns[b]._t);
        const ok = await teach("light", [recBtns[b]],
          "ตอนที่มีกรอบ \"โจทย์\" คือกำลังโชว์โจทย์\nแผ่นเสียงที่กะพริบสว่างขึ้นพร้อมเสียงเพลง\nคือแผ่นที่คุณต้องจำไว้ แล้วกดตามให้ถูก", token);
        recBtns[b].classList.remove("is-lit");
        if (!ok) return;
        await sleep(CONFIG.gap);
        continue;
      }
      await sleep(CONFIG.lightOn + CONFIG.gap);
    }
    if (token !== S.token) return;
    showTask(false);
    if (S.practice && !S.coached.has("turn")) {
      // the player's turn and the 10-second circle, explained before the time starts
      timer.hidden = false; timerNum.textContent = CONFIG.answerSeconds;
      timer.style.setProperty("--p", "1"); timer.classList.remove("is-low");
      if (!await teach("turn", [recBtns[S.buttons[0]]], "ถึงตาคุณแล้ว!\nแตะแผ่นเสียงที่สว่างเมื่อกี้", token, { hand: true })) return;
      if (!await teach("timer", [timer], `ต้องแตะให้ครบภายใน ${CONFIG.answerSeconds} วินาที\nวงกลมนี้บอกเวลาที่เหลือ`, token, { round: true })) return;
    }
    S.phase = "input";
    els.records.classList.remove("is-locked");
    hint.textContent = `ถึงตาคุณแล้ว กดตามให้ครบ ${S.round} แผ่น`;
    runAnswerTimer(token);
  }

  // 10 seconds to tap the whole round; runs until the round ends (any token change) or time is up
  function runAnswerTimer(token) {
    const end = performance.now() + CONFIG.answerSeconds * 1000;
    timer.hidden = false;
    const tick = () => {
      if (!S || token !== S.token || S.phase !== "input") { timer.hidden = true; return; }
      const left = Math.max(0, (end - performance.now()) / 1000);
      timerNum.textContent = Math.ceil(left);
      timer.style.setProperty("--p", (left / CONFIG.answerSeconds).toFixed(3));
      timer.classList.toggle("is-low", left <= 3);
      if (left <= 0) { timeUp(); return; }
      setTimeout(tick, 100);
    };
    tick();
  }

  async function timeUp() {
    showTask(false);
    const token = ++S.token;
    timer.hidden = true;
    if (S.practice) {   // practice: no losing, explain and try the round again
      playWrong();
      S.phase = "wrong";
      els.records.classList.add("is-locked");
      await coach(null, `หมดเวลาแล้ว\nต้องแตะให้ครบภายใน ${CONFIG.answerSeconds} วินาที\nไม่เป็นไร ลองรอบนี้ใหม่อีกครั้งนะ`);
      if (S && token === S.token) playRound(CONFIG.retryPause);
      return;
    }
    playWrong();
    if (navigator.vibrate) navigator.vibrate(150);
    els.flash.classList.remove("is-on"); void els.flash.offsetWidth; els.flash.classList.add("is-on");
    hud.setStars(0);
    lose("time");
  }

  function light(i, note, seconds) {
    const b = recBtns[i];
    b.classList.remove("is-lit"); void b.offsetWidth; b.classList.add("is-lit");
    playNote(note, seconds);
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove("is-lit"), seconds * 1000);
  }

  function onTap(i) {
    if (!S || S.phase !== "input" || popupOpen()) return;
    if (i === S.buttons[S.pos]) {
      light(i, S.notes[S.pos], CONFIG.tapLight);
      S.pos++;
      if (S.practice && !S.coached.has("right")) { explainRight(i); return; }
      afterRight();
    } else {
      wrong();
    }
  }
  function afterRight() {
    if (S.pos === S.round) {
      if (S.round === S.n) { win(); return; }
      S.round++;
      playRound();
    }
  }
  // practice: the first right tap is explained (the clock stops meanwhile)
  async function explainRight(i) {
    const token = ++S.token;
    S.phase = "coach";
    els.records.classList.add("is-locked");
    await sleep(0.5);
    if (token !== S.token) return;
    if (!await teach("right", [recBtns[i]], "ถูกต้อง!\nแตะถูกแล้ว แผ่นเสียงจะสว่างและมีเสียงเพลง", token)) return;
    if (S.pos < S.round) {   // more records to tap in this round
      S.phase = "input";
      els.records.classList.remove("is-locked");
      runAnswerTimer(token);
    } else afterRight();
  }

  async function wrong() {
    S.misses++;
    S.phase = "wrong";
    showTask(false);
    const token = ++S.token;
    els.records.classList.add("is-locked");
    playWrong();
    if (navigator.vibrate) navigator.vibrate(150);
    els.flash.classList.remove("is-on"); void els.flash.offsetWidth; els.flash.classList.add("is-on");
    recBtns.forEach((b) => { b.classList.remove("is-lit"); b.classList.add("is-red"); });
    hud.setStars(S.misses >= CONFIG.maxMisses ? 0 : starsFor(S.misses));
    triesNum.textContent = Math.max(0, CONFIG.maxMisses - S.misses);
    hint.textContent = "ผิดแล้ว ลองใหม่อีกครั้งนะ";
    await sleep(CONFIG.redFlash);
    recBtns.forEach((b) => b.classList.remove("is-red"));
    if (token !== S.token) return;
    if (S.practice) {   // practice never ends by mistakes
      if (!await teach("wrong", [tries],
        "แตะผิด แผ่นเสียงจะกะพริบเป็นสีแดง\nแล้วเพลงรอบนั้นจะเล่นให้ดูใหม่\nช่องนี้บอกว่าผิดได้อีกกี่ครั้ง\n(ด่านทดลองไม่เสียหัวใจ)", token)) return;
      if (S.misses >= CONFIG.maxMisses) { S.misses = CONFIG.maxMisses - 1; triesNum.textContent = 1; hud.setStars(1); }
      playRound(CONFIG.retryPause);
      return;
    }
    if (S.misses >= CONFIG.maxMisses) { lose(); return; }
    playRound(CONFIG.retryPause);   // same round again
  }

  function secondsPlayed() {
    return Math.round((S.activeMs + (performance.now() - S.since)) / 1000);
  }

  async function win() {
    showTask(false);
    S.phase = "done";
    S.token++;
    els.records.classList.add("is-locked");
    hint.textContent = "เก่งมาก!";
    if (S.practice) {   // nothing is saved; go to the real level 1 or practise again
      const my = S;
      await sleep(0.8);
      if (S !== my) return;
      if (window.Memoir.sound) window.Memoir.sound.play("win");
      const pick = await coach(null, "เก่งมาก! ผ่านด่านทดลองเล่นแล้ว\nพร้อมเล่นจริงแล้วใช่ไหม?", { buttons: ["เริ่มเล่นด่าน 1", "ทดลองเล่นอีกครั้ง"] });
      if (S !== my) return;
      if (pick === 0) start(1); else practice();
      return;
    }
    const stars = starsFor(S.misses);
    window.Memoir.progress.setStars("melody", S.level, stars);
    window.Memoir.history.add("melody", S.level, { win: true, sec: secondsPlayed(), miss: S.misses, stars });
    window.Memoir.wallet.addCoins(CONFIG.coinRewardByStars[stars]);
    win$.fill({
      stars, seconds: secondsPlayed(), misses: S.misses,
      coins: CONFIG.coinRewardByStars[stars], hasNext: S.level < CONFIG.maxLevel,
    });
    const myState = S;
    setTimeout(() => { if (S === myState) win$.show(); }, 900);
  }

  function lose(reason) {
    showTask(false);
    if (window.Memoir.sound) window.Memoir.sound.play("lose");   // game-over sound
    S.phase = "done";
    timer.hidden = true;
    els.records.classList.add("is-locked");
    hint.textContent = "";
    window.Memoir.history.add("melody", S.level, { win: false, sec: secondsPlayed(), miss: S.misses, stars: 0 });
    window.Memoir.wallet.loseHeart();
    const level = S.level;
    A.plainPopup(els.modal, els.card, {
      title: "ไม่เป็นไรนะ",
      lines: [reason === "time" ? `หมดเวลา กดไม่ครบใน ${CONFIG.answerSeconds} วินาที` : `กดผิดครบ ${CONFIG.maxMisses} ครั้งแล้ว`, "(เสียหัวใจ 1 ดวง)"],
      buttons: [
        { label: "ลองอีกครั้ง", primary: true, onClick: () => start(level) },
        { label: "เลือกด่าน", onClick: exitToLevels },
      ],
    });
  }

  function exitToLevels() {
    stop();
    hidePopups();
    window.Memoir.showScreen("screen-levels-melody");
  }

  // ---------- Exit popup: stop the show; "เล่นต่อ" shows the current round again ----------
  function pause() {
    if (!S || S.phase === "done" || S.phase === "stopped") return false;
    S.token++;
    S.activeMs += performance.now() - S.since;
    S.phase = "paused";
    showTask(false);
    coachEl.hidden = true;   // shown again when the round replays
    els.records.classList.add("is-locked");
    recBtns.forEach((b) => b.classList.remove("is-lit", "is-red"));
    return true;
  }
  function onExit() {
    if (!pause()) { exitToLevels(); return; }
    exitPop.hidden = false;
  }
  function resume() {
    exitPop.hidden = true;
    if (!S || S.phase !== "paused") return;
    S.since = performance.now();
    playRound(0.6);
  }

  // Leaving the app pauses; coming back shows the current round again
  document.addEventListener("visibilitychange", () => {
    if (!S || !els.screen.classList.contains("is-active")) return;
    if (document.hidden) pause();
    else if (!popupOpen() && S.phase === "paused") resume();
  });

  window.Memoir.melody = { start, stop, practice, CONFIG, notesFor, playNote, playWrong, debug: { state: () => S } };
})();

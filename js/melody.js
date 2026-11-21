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
    out.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
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
      g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.02);
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
    A.place(b, box);
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

  function start(level) {
    if (!window.Memoir.wallet.check(() => start(level))) return;   // out of hearts
    stop();
    ctx();   // unlock sound (this runs from a tap)
    const n = notesFor(level);
    const songs = MELODIES.filter((m) => m.notes.length >= n);
    const song = (songs.length ? songs : MELODIES)[Math.floor(Math.random() * (songs.length || MELODIES.length))];
    S = {
      level, n, song,
      notes: song.notes.slice(0, n),
      buttons: randomButtons(n),
      round: 1, pos: 0, misses: 0,
      phase: "show", token: 0,
      activeMs: 0, since: performance.now(),
    };
    hud.setLevel(level);
    hud.setStars(3);
    triesNum.textContent = CONFIG.maxMisses;
    hidePopups();
    recBtns.forEach((b) => b.classList.remove("is-lit", "is-red"));
    window.Memoir.showScreen("screen-melody-game");
    playRound(1.2);
  }

  function stop() {
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
    await sleep(delay);
    for (let i = 0; i < S.round; i++) {
      if (token !== S.token) return;
      light(S.buttons[i], S.notes[i], CONFIG.lightOn);
      await sleep(CONFIG.lightOn + CONFIG.gap);
    }
    if (token !== S.token) return;
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

  function timeUp() {
    S.token++;
    timer.hidden = true;
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
      if (S.pos === S.round) {
        if (S.round === S.n) { win(); return; }
        S.round++;
        playRound();
      }
    } else {
      wrong();
    }
  }

  async function wrong() {
    S.misses++;
    S.phase = "wrong";
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
    if (S.misses >= CONFIG.maxMisses) { lose(); return; }
    playRound(CONFIG.retryPause);   // same round again
  }

  function secondsPlayed() {
    return Math.round((S.activeMs + (performance.now() - S.since)) / 1000);
  }

  function win() {
    S.phase = "done";
    S.token++;
    els.records.classList.add("is-locked");
    hint.textContent = "เก่งมาก!";
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

  window.Memoir.melody = { start, stop, CONFIG, notesFor, debug: { state: () => S } };
})();

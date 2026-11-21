(() => {
  "use strict";

  // ---------- Screen switcher ----------
  let current = "screen-cover";
  const onShowHooks = {};   // screen id -> function run each time that screen is shown

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("is-active", s.id === id);
    });
    current = id;
    if (toastEl) toastEl.classList.remove("is-shown");
    updateNav(id);
    updateBackdrop(id);
    if (onShowHooks[id]) onShowHooks[id]();
  }

  // ---------- Backdrop: fills the space around the 9:16 stage (iPad, tall phones, desktop) ----------
  // Uses the screen's own background picture (its first image, or its CSS background).
  const backdrop = document.getElementById("backdrop");
  function updateBackdrop(id) {
    const s = document.getElementById(id);
    if (!s || !backdrop) return;
    const pic = s.querySelector("img.layer");
    let url = pic ? `url("${pic.src}")` : getComputedStyle(s).backgroundImage;
    if (!url || url === "none") return;          // keep the last one (e.g. the plain placeholder)
    backdrop.style.backgroundImage = url;
  }
  updateBackdrop(current);

  // ---------- iPhone / iPad: no pinch zoom (double-tap zoom is off via touch-action in CSS) ----------
  ["gesturestart", "gesturechange"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));

  // ---------- Stamp menu at the bottom: on every menu screen, never during a game ----------
  // screen id -> which stamp is "current"
  const NAV_TAB = {
    "screen-home": "home",
    "screen-game-select": "games",
    "screen-levels-melody": "games",
    "screen-levels-market": "games",
    "screen-levels-decor": "games",
  };
  let placeholderTab = "games";   // set by showPlaceholder ("อันดับ" → rank)
  function updateNav(id) {
    const nav = document.getElementById("main-nav");
    const tab = id === "screen-placeholder" ? placeholderTab : NAV_TAB[id];
    nav.hidden = !tab;
    nav.querySelectorAll(".nav-stamp").forEach((s) => s.classList.toggle("is-current", s.dataset.tab === tab));
    nav.querySelectorAll(".tab-hit").forEach((b) => {
      const isCur = b.dataset.art === "nav-" + tab;
      if (isCur) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  // ---------- Toast (short message at the bottom of the screen) ----------
  const toastEl = document.getElementById("toast");
  let toastTimer = 0;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("is-bad", kind === "bad");
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-shown"), 2000);
  }

  // ---------- Saved progress: best stars per game/level (this device only) ----------
  const STORE_KEY = "memoir.progress.v1";
  const progress = {
    data: (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } })(),
    stars(game, level) { return (this.data[game] && this.data[game][level]) || 0; },
    setStars(game, level, stars) {
      this.data[game] = this.data[game] || {};
      if (stars > this.stars(game, level)) this.data[game][level] = stars;   // keep the best
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage off */ }
    },
    isUnlocked(game, level) { return level === 1 || this.stars(game, level - 1) > 0; },
  };

  // ---------- Play history (for the doctor's progress page): one record per finished level ----------
  //   { g: "decor"|"melody"|"market", lv, d: "YYYY-MM-DD", t: ms, win, sec, miss, stars, full }
  const HISTORY_KEY = "memoir.history.v1";
  const history = {
    list: (() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; } })(),
    add(game, level, rec) {
      const now = new Date();
      const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      this.list.push(Object.assign({ g: game, lv: level, d, t: now.getTime() }, rec));
      if (this.list.length > 2000) this.list.splice(0, this.list.length - 2000);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(this.list)); } catch (e) { /* storage off */ }
    },
  };

  // run fn each time screen id is shown (several scripts may add one for the same screen)
  const onShow = (id, fn) => { const prev = onShowHooks[id]; onShowHooks[id] = prev ? () => { prev(); fn(); } : fn; };
  window.Memoir = { showScreen, toast, progress, history, onShow };

  // ---------- Level select screens (built from config) ----------
  // box = [left, top, width, height] in % of the 9:16 canvas, measured from each button layer.
  // Button art layers are full-canvas PNGs, so they line up with the background automatically.
  const LEVEL_COUNT = 10;   // levels per game shown on the map
  const LEVEL_SCREENS = [
    {
      id: "screen-levels-melody", game: "Memory Melody", dir: "assets/levels_melody/web",
      key: "melody",  // playable: shows stars + locks, starts Memoir.melody
      padColor: "#d07a31",   // colour under the map (matches the bottom of the art)
      levels: [
        [22.2, 76.6, 34.3, 18.8], [52.8, 58.3, 34.3, 18.8], [17.6, 38.0, 36.1, 20.3],
        [51.9, 19.3, 33.3, 18.8], [24.1,  4.2, 29.6, 17.2],
      ],
    },
    {
      id: "screen-levels-market", game: "Memory Market", dir: "assets/levels_market/web",
      key: "market",  // playable: shows stars + locks, starts Memoir.market
      extraLayers: [{ src: "waves.png", className: "waves" }],
      padColor: "#8cbcb9",
      levels: [
        [25.0, 72.9, 15.7, 25.5], [50.0, 54.7, 15.7, 30.2], [25.9, 34.9, 15.7, 26.0],
        [55.6, 15.1, 18.5, 26.0], [34.3,  1.0, 15.7, 26.0],
      ],
      // levels 6-10: their own drawn page that continues the map upward (Drive "6-10")
      page2: { bg: "bg2.jpg", blend: 10, levels: [   // blend: soft fade (cqh) where the pages meet
        [59.2, 72.7, 15.7, 25.9], [34.0, 54.6, 15.7, 30.5], [58.1, 35.1, 15.7, 25.9],
        [26.1, 15.3, 17.8, 25.9], [49.7,  1.3, 15.7, 25.9],
      ] },
    },
    {
      id: "screen-levels-decor", game: "Memory Decor", dir: "assets/levels_decor/web",
      key: "decor",   // playable: shows stars + locks, starts Memoir.decor
      padColor: "#a55f24",
      levels: [
        [30.6, 78.1, 18.5, 15.6], [58.3, 61.5, 22.2, 13.5], [24.1, 43.8, 24.1, 12.5],
        [60.2, 21.9, 17.6, 12.5], [25.9,  8.3, 25.9, 12.5],
      ],
      // levels 6-10: their own drawn page that continues the map upward (Drive "6-10")
      page2: { bg: "bg2.jpg", overlap: 2.4, levels: [   // overlap: the art repeats 2.4% of the height at the join
        [30.5, 78.4, 18.2, 14.9], [58.9, 61.7, 21.8, 13.2], [24.1, 43.8, 23.7, 12.4],
        [60.4, 22.3, 17.0, 12.1], [26.5,  8.4, 24.6, 15.7],
      ] },
    },
  ];


  function img(src, className) {
    const el = document.createElement("img");
    el.src = src;
    el.alt = "";
    el.draggable = false;
    el.className = "layer" + (className ? " " + className : "");
    return el;
  }

  function buildLevelScreen(cfg) {
    const screen = document.createElement("section");
    screen.id = cfg.id;
    screen.className = "screen";
    screen.setAttribute("aria-label", "เลือกด่าน " + cfg.game);

    // The level map scrolls (like mobile level maps): it is one screen tall plus room for the
    // stamp menu, opens scrolled to the bottom (level 1), and can grow upward with more levels later.
    const scroller = document.createElement("div");
    scroller.className = "level-scroll";
    scroller.style.background = cfg.padColor;
    const map = document.createElement("div");
    map.className = "level-map";
    scroller.appendChild(map);
    screen.appendChild(scroller);

    // The drawn map holds 5 levels per page; pages are stacked upward (levels 6-10 on page 2).
    // A game with its own page-2 art (cfg.page2) uses it; otherwise page 1 is repeated with
    // renumbered buttons (tools/make_level_numbers.ps1).
    const perPage = cfg.levels.length;
    const pages = Math.ceil(LEVEL_COUNT / perPage);
    const ov = (cfg.page2 && cfg.page2.overlap) || 0;    // pages drawn to overlap a little
    const step = 100 - ov;
    map.style.height = `calc(${pages * 100 - ov * (pages - 1)}cqh + 19cqh)`;   // + room for the stamp menu
    const sections = [];
    for (let p = 0; p < pages; p++) {
      const sec = document.createElement("div");   // the art, exactly one 9:16 screen
      sec.className = "level-art";
      sec.style.top = `${(pages - 1 - p) * step}cqh`;
      const own = p > 0 && cfg.page2;
      sec.appendChild(img(`${cfg.dir}/${own ? cfg.page2.bg : "bg.jpg"}`));
      // soft blend at the top of a page that has a different drawn page above it
      if (cfg.page2 && cfg.page2.blend && p === 0 && pages > 1) {
        const blend = document.createElement("div");
        blend.className = "level-blend";
        blend.style.backgroundImage = `url("${cfg.dir}/${cfg.page2.bg}")`;
        blend.style.height = cfg.page2.blend + "cqh";
        sec.appendChild(blend);
      }
      if (!own) (cfg.extraLayers || []).forEach((l) => sec.appendChild(img(`${cfg.dir}/${l.src}`, l.className)));
      map.appendChild(sec);
      sections.push(sec);
    }

    const PAD = 1; // enlarge tap areas a little (in %)
    Array.from({ length: LEVEL_COUNT }, (_, i) => i).forEach((i) => {
      const n = i + 1;
      const page = Math.floor(i / perPage);
      const [l, t, w, h] = (page > 0 && cfg.page2 ? cfg.page2.levels : cfg.levels)[i % perPage];
      const sec = sections[page];
      const art = img(`${cfg.dir}/lv${n}.png`, "press-art");
      art.id = `${cfg.id}-art-${n}`;
      art.style.setProperty("--cx", `${l + w / 2}%`);
      art.style.setProperty("--cy", `${t + h / 2}%`);
      sec.appendChild(art);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hit-area";
      btn.dataset.art = art.id;
      if (cfg.key) {
        btn.dataset.game = cfg.key;
        btn.dataset.level = n;
      } else {
        btn.dataset.placeholder = `${cfg.game} – ด่าน ${n}`;   // TODO: start the real level
      }
      btn.setAttribute("aria-label", `ด่าน ${n}`);
      Object.assign(btn.style, {
        left: `${l - PAD}%`, top: `${t - PAD}%`, width: `${w + PAD * 2}%`, height: `${h + PAD * 2}%`,
      });
      sec.appendChild(btn);

      if (cfg.key) {
        const stars = document.createElement("div");
        stars.className = "lv-stars";
        stars.id = `${cfg.id}-stars-${n}`;
        Object.assign(stars.style, { left: `${l + w / 2}%`, top: `${t + h + 0.3}%` });
        sec.appendChild(stars);
      }
    });

    const toBottom = () => { scroller.scrollTop = scroller.scrollHeight; };
    onShowHooks[cfg.id] = toBottom;
    if (cfg.key) {
      onShowHooks[cfg.id] = () => {
        toBottom();
        for (let n = 1; n <= LEVEL_COUNT; n++) {
          const got = progress.stars(cfg.key, n);
          const locked = !progress.isUnlocked(cfg.key, n);
          document.getElementById(`${cfg.id}-art-${n}`).classList.toggle("is-locked", locked);
          const s = document.getElementById(`${cfg.id}-stars-${n}`);
          s.innerHTML = locked
            ? '<img class="lv-lock" src="assets/icons/web/lock.png" alt="ล็อก" draggable="false">'
            : [1, 2, 3].map((k) => `<img src="assets/ui/web/star_single.png" alt="" draggable="false" class="${k <= got ? "on" : ""}">`).join("");
          s.setAttribute("aria-label", locked ? "ล็อก" : `${got} ดาว`);
        }
      };
    }

    // Back button: "กลับ" art, same spot as in the games' top bar
    const back = document.createElement("button");
    back.type = "button";
    back.className = "back-art";
    back.dataset.go = "screen-game-select";
    back.setAttribute("aria-label", "กลับ");
    back.innerHTML = '<img src="assets/ui/web/top_back.png" alt="" draggable="false">';
    Object.assign(back.style, { left: "3.24%", top: "2.76%", width: "10.09%", height: "4.17%" });
    screen.appendChild(back);   // stays put while the map scrolls

    document.getElementById("screen-placeholder").before(screen);
  }

  LEVEL_SCREENS.forEach(buildLevelScreen);

  // Placeholder for screens that are not designed yet; "กลับ" returns to where we came from.
  let placeholderReturn = "screen-home";
  function showPlaceholder(title) {
    placeholderReturn = current;
    placeholderTab = title === "อันดับ" ? "rank" : "games";
    document.getElementById("placeholder-title").textContent = title;
    showScreen("screen-placeholder");
  }
  document.getElementById("placeholder-back").addEventListener("click", () => {
    showScreen(placeholderReturn);
  });

  // ---------- Mouse hover ----------
  // Invisible tap areas sit over buttons drawn in the art, so the hover look goes on the art.
  // Mouse only: on touch screens a tap would leave the button looking "hovered".
  function bindHover(el, arts) {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") arts.forEach((a) => a.classList.add("is-hover"));
    });
    el.addEventListener("pointerleave", () => arts.forEach((a) => a.classList.remove("is-hover")));
  }

  // ---------- Generic press handling ----------
  // onPress / onRelease change the look; onActivate runs only if released over the button.
  function bindPress(el, { onPress, onRelease, onActivate }) {
    let pressed = false;

    const press = () => { pressed = true; onPress && onPress(); };
    const release = (activate) => {
      if (!pressed) return;
      pressed = false;
      onRelease && onRelease(activate);
      if (activate) onActivate();
    };

    el.addEventListener("pointerdown", (e) => {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone: still handle the tap */ }
      press();
    });
    el.addEventListener("pointerup", (e) => {
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right &&
                     e.clientY >= r.top  && e.clientY <= r.bottom;
      release(inside);
    });
    el.addEventListener("pointercancel", () => release(false));

    // Keyboard: Enter / Space
    el.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); press(); }
    });
    el.addEventListener("keyup", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); release(true); }
    });

    el.addEventListener("click", (e) => e.preventDefault());
  }

  // Where a button goes: data-go="screen-id" or data-placeholder="title"
  function navigateFrom(el) {
    if (el.dataset.level) {
      const game = el.dataset.game, level = Number(el.dataset.level);
      if (!progress.isUnlocked(game, level)) { toast(`ผ่านด่าน ${level - 1} ก่อนนะ`); return; }
      const startIt = () => window.Memoir[game].start(level);
      // level 1: how-to-play popup first, the level starts when it closes
      if (window.Memoir.howto && window.Memoir.howto.beforeLevel(game, level, startIt)) return;
      startIt();
      return;
    }
    if (el.dataset.go) showScreen(el.dataset.go);
    else if (el.dataset.placeholder) showPlaceholder(el.dataset.placeholder);
  }

  // ---------- Cover: Start button ----------
  const startBtn = document.getElementById("start-btn");
  const artUp    = document.getElementById("start-normal");   // raised
  const artDown  = document.getElementById("start-pressed");  // pressed
  const overlay  = document.getElementById("dark-overlay");
  const FADE_MS  = 450;   // must match .overlay transition in CSS
  let starting = false;

  function setStartPressed(on) {
    artUp.classList.toggle("is-hidden", on);
    artDown.classList.toggle("is-hidden", !on);
  }

  bindPress(startBtn, {
    onPress:   () => { if (!starting) setStartPressed(true); },
    onRelease: (activate) => { if (!activate) setStartPressed(false); },
    onActivate: () => {
      if (starting) return;
      starting = true;
      overlay.classList.add("is-shown");
      setTimeout(() => {
        // signed in → home; otherwise the sign up / sign in screen
        showScreen(window.MemoirAccount && window.MemoirAccount.current ? "screen-home" : "screen-login");
        // reset cover for next time
        starting = false;
        setStartPressed(false);
        overlay.classList.remove("is-shown");
      }, FADE_MS + 100);
    },
  });

  // ---------- Buttons drawn in the art (game select) ----------
  document.querySelectorAll(".hit-area[data-art]").forEach((btn) => {
    const art = document.getElementById(btn.dataset.art);
    bindPress(btn, {
      onPress:   () => art.classList.add("is-pressed"),
      onRelease: () => art.classList.remove("is-pressed"),
      onActivate: () => setTimeout(() => navigateFrom(btn), 90),
    });
    bindHover(btn, [art]);
  });
  bindHover(startBtn, [artUp, artDown]);

  // ---------- Bottom tab bar and CSS back buttons ----------
  document.querySelectorAll(".tabbar .tab, .back-btn, .back-art").forEach((tab) => {
    if (tab.classList.contains("is-current")) return;   // already on this page
    bindPress(tab, {
      onPress:   () => tab.classList.add("is-pressed"),
      onRelease: () => tab.classList.remove("is-pressed"),
      onActivate: () => navigateFrom(tab),
    });
  });

  // Stop long-press context menu on mobile
  window.addEventListener("contextmenu", (e) => e.preventDefault());
})();

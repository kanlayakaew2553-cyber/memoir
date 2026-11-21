/* ผลการประเมิน (was อันดับ) — the doctor's dashboard (the player side comes later).
 *
 * Tabs (buttons on the pier at the bottom):
 *   ข้อมูลคนไข้ – list of patients; tap one → spider chart of their skills
 *   MENU       – doctor profile, calendar, play-streak, progress graph, chat preview
 *   CHATBOX    – chat with patients (2 sample contacts, replies are simulated)
 * A small switch (top right) flips between doctor and player view for the presentation;
 * the real choice will come from the sign-in page later.
 *
 * Data: play history from window.Memoir.history (this device's player). Calendar and chat are
 * saved in this browser (localStorage).
 */
(() => {
  "use strict";

  const DIR = "assets/rank/web/";
  // Boxes in % of the 9:16 canvas, measured from the art (tools/prep_rank.ps1 → rank.json)
  const BOX = {
    wood: [0, 88.05, 100, 11.95],
    rower: [36.57, 81.3, 27.55, 11.82],
    btn_patient: [2.59, 92.24, 25.97, 6.25],
    btn_menu: [37.04, 92.24, 25.97, 6.25],
    btn_chat: [71.53, 92.24, 25.97, 6.25],
    // MENU page panels
    avatar: [1.67, 9.27, 17.59, 9.9],
    profile: [20.19, 4.79, 75.56, 19.48],
    calendar: [3.15, 28.65, 45.37, 19.48],
    streak: [52.22, 28.65, 45.37, 19.48],
    graph: [3.52, 52.29, 53.7, 26.56],
    chatMini: [60.19, 52.19, 37.41, 26.67],
    // patient list rows
    // (moved 3.6% down from the art so the "กลับ" button and the role switch stay clear)
    rows: [[7.78, 8.29, 86.11, 10.83], [7.78, 20.68, 86.11, 10.83], [7.78, 32.77, 86.11, 10.83],
           [7.78, 45.16, 86.11, 10.83], [7.78, 57.77, 86.11, 10.83], [7.78, 70.37, 86.11, 10.73]],
    chat: [7.04, 7.5, 87.22, 72.5],
  };

  const $ = (id) => document.getElementById(id);
  const M = window.Memoir;
  const screen = $("screen-rank");

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function place(e, [x, y, w, h]) {
    Object.assign(e.style, { left: x + "%", top: y + "%", width: w + "%", height: h + "%" });
    return e;
  }
  function img(src, cls, box) {
    const i = el("img", cls);
    i.src = src; i.alt = ""; i.draggable = false;
    if (box) place(i, box);
    return i;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage off */ } }
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  // =====================================================================
  // Patients and their skills
  // =====================================================================
  // Patients = the player accounts signed up on this device (their real play history), then the
  // 2 sample chat contacts (no play data yet). The list holds up to 6 (the rows drawn in the art).
  const PAL = ["#e0612f", "#3f8f9f", "#c9892b", "#6f9a3a", "#b0507a", "#5b6fb0"];
  const ACC = window.MemoirAccount;
  const PATIENTS = [
    ...(ACC ? ACC.players() : []).slice(0, 4).map((p, i) => ({
      id: "acc:" + p.email, name: p.name, short: p.name.charAt(0).toUpperCase(), color: PAL[i % PAL.length],
      records: () => ACC.historyOf(p.email),
    })),
    { id: "p1", name: "คุณสมศรี ใจดี", short: "ส", color: "#4f8f8a", records: () => [] },
    { id: "p2", name: "คุณประยูร มีสุข", short: "ป", color: "#8a5bb0", records: () => [] },
  ];

  const clamp = (v) => Math.max(0, Math.min(100, v));
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  // Score 0–100 for one finished level
  const SCORE = {
    observe: (r) => (r.g === "decor" ? (r.win ? clamp((60 - r.sec) / 50 * 100) : 0) : null),    // faster = better
    memMelody: (r) => (r.g === "melody" ? (r.win ? clamp(100 - r.miss * 20) : 0) : null),       // fewer misses = better
    memMarket: (r) => (r.g === "market" && r.win ? clamp(100 - r.miss * 20) : null),
    plan: (r) => (r.g === "market" ? (r.win ? clamp(100 - r.miss * 15) : 0) : null),           // basket full = 0
  };
  // recent (last 5) and first (first 5) average of one score
  function trend(recs, fn) {
    const v = recs.map(fn).filter((x) => x != null);
    if (!v.length) return null;
    return { now: avg(v.slice(-5)), first: avg(v.slice(0, 5)), n: v.length };
  }
  function streakOf(recs) {
    const days = new Set(recs.map((r) => r.d));
    const d = new Date();
    if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);   // today not played yet: count up to yesterday
    let n = 0;
    while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function statsOf(p) {
    const recs = p.records();
    const observe = trend(recs, SCORE.observe);
    const melody = trend(recs, SCORE.memMelody);
    const market = trend(recs, SCORE.memMarket);
    const plan = trend(recs, SCORE.plan);
    const memNow = avg([melody, market].filter(Boolean).map((t) => t.now));
    const memFirst = avg([melody, market].filter(Boolean).map((t) => t.first));
    const last14 = new Set(recs.filter((r) => r.t > Date.now() - 14 * 864e5).map((r) => r.d)).size;
    const skills = [
      { key: "observe", name: "การสังเกต", value: observe ? observe.now : null, from: "Memory Decor (เวลาที่ใช้)" },
      { key: "memory", name: "ความจำ", value: memNow, from: "Memory Melody + Market (ความผิดพลาด)" },
      { key: "plan", name: "การวางแผน", value: plan ? plan.now : null, from: "Memory Market (ตะกร้าเต็ม/เก็บเกิน)" },
      { key: "steady", name: "ความสม่ำเสมอ", value: recs.length ? clamp(last14 / 14 * 100) : null, from: "จำนวนวันที่เล่นใน 14 วัน" },
    ];
    // progress bar: average of the 3 games' current scores; change = vs. their first plays
    const games = [observe, melody, market].filter(Boolean);
    const progress = games.length ? avg(games.map((t) => t.now)) : null;
    const change = games.length ? avg(games.map((t) => t.now - t.first)) : null;
    return {
      recs, skills, progress, change, streak: streakOf(recs),
      last: recs.length ? recs[recs.length - 1].d : null,
      byGame: {
        decor: recs.filter((r) => r.g === "decor"), melody: recs.filter((r) => r.g === "melody"), market: recs.filter((r) => r.g === "market"),
      },
    };
  }

  // =====================================================================
  // Screen shell: background, pier, rower, tab buttons, back, role switch
  // =====================================================================
  screen.append(img(DIR + "bg.jpg", "layer"));
  const pages = el("div", "rk-pages");
  screen.append(pages);
  screen.append(img(DIR + "wood.png", "rk-art", BOX.wood));
  screen.append(img(DIR + "rower.png", "rk-art rk-rower", BOX.rower));

  const TABS = [["patient", "ข้อมูลคนไข้"], ["menu", "เมนู"], ["chat", "แชท"]];
  const tabBtns = {};
  TABS.forEach(([key, label]) => {
    const b = el("button", "rk-tab");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.append(img(`${DIR}btn_${key}.png`));
    place(b, BOX["btn_" + key]);
    b.addEventListener("click", () => showTab(key));
    screen.append(b);
    tabBtns[key] = b;
  });

  const back = el("button", "back-art");
  back.type = "button";
  back.setAttribute("aria-label", "กลับ");
  back.innerHTML = '<img src="assets/ui/web/top_back.png" alt="" draggable="false">';
  Object.assign(back.style, { left: "3.24%", top: "2.76%", width: "10.09%", height: "4.17%" });
  back.addEventListener("click", () => M.showScreen("screen-home"));
  screen.append(back);

  // Doctor or player: from the signed-in account (chosen when signing up)
  const me = window.MemoirAccount && window.MemoirAccount.current;
  const role = me && me.role === "doctor" ? "doctor" : "patient";

  // =====================================================================
  // Pages
  //   doctor: ข้อมูลคนไข้ / MENU (dashboard) / CHATBOX (patients)
  //   player: MENU (my own spider chart) / CHATBOX (my doctor); no patient list
  // =====================================================================
  const doctorView = role === "doctor";
  const page = {
    patient: el("div", "rk-page"),
    menu: el("div", "rk-page"),
    chat: el("div", "rk-page"),
  };
  Object.values(page).forEach((p) => pages.append(p));
  let tab = "menu";
  function showTab(key) {
    tab = key;
    render();
  }

  function render() {
    tabBtns.patient.hidden = !doctorView;
    Object.entries(page).forEach(([k, p]) => { p.hidden = k !== tab; });
    Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle("is-current", k === tab));
    if (tab === "menu") (doctorView ? renderMenu : renderMySkills)();
    if (tab === "patient" && doctorView) renderPatients();
    if (tab === "chat") renderChat();
  }
  M.onShow("screen-rank", render);

  // ---------- Player: my own results ----------
  const MY = { id: "me", name: me ? me.name : "ผู้เล่น", short: "", color: "#e0612f", records: () => M.history.list };
  function renderMySkills() {
    const p = page.menu;
    p.innerHTML = "";
    const card = place(el("div", "rk-card rk-my"), BOX.chat);
    card.append(el("h3", "rk-my-title", "ผลการประเมินของฉัน"));
    skillsContent(card, MY, "ยังไม่มีข้อมูลการเล่นเกม<br>เล่นเกมไปสักพัก กราฟทักษะของคุณจะแสดงที่นี่");
    p.append(card);
  }

  // ---------- MENU ----------
  function renderMenu() {
    const p = page.menu;
    p.innerHTML = "";
    // doctor profile (filled in after sign-in)
    const av = place(el("div", "rk-avatar", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4.2"/><path d="M3.8 21c.8-4.6 4.2-7 8.2-7s7.4 2.4 8.2 7z"/></svg>'), BOX.avatar);
    const prof = place(el("div", "rk-card rk-profile",
      `<h3>ข้อมูลแพทย์</h3>
       <p class="rk-doc-name">${me ? esc(me.name) : "-"}</p>
       <p class="rk-muted">${me ? esc(me.email) : ""}</p>
       <p>คนไข้ในความดูแล <b>${PATIENTS.length}</b> คน</p>`), BOX.profile);
    p.append(av, prof);

    // calendar (this month)
    const cal = place(el("button", "rk-card rk-mini-cal"), BOX.calendar);
    cal.type = "button";
    cal.setAttribute("aria-label", "เปิดปฏิทิน");
    cal.innerHTML = miniCalendarHTML();
    cal.addEventListener("click", () => openCalendar());
    p.append(cal);

    // play streak
    const st = place(el("div", "rk-card rk-streak"), BOX.streak);
    st.innerHTML = "<h3>เล่นต่อเนื่อง</h3>" + PATIENTS.map((pt) => {
      const n = statsOf(pt).streak;
      return `<div class="rk-streak-row"><span>${esc(pt.name)}</span><b class="${n ? "" : "is-zero"}">${n ? "🔥 " : ""}${n} วัน</b></div>`;
    }).join("");
    p.append(st);

    // progress graph: one bar per patient (average of the 3 games)
    const gr = place(el("div", "rk-card rk-graph"), BOX.graph);
    gr.innerHTML = "<h3>ความคืบหน้าของคนไข้</h3>";
    const rows = el("div", "rk-bars");
    PATIENTS.forEach((pt) => {
      const s = statsOf(pt);
      const r = el("button", "rk-bar-row");
      r.type = "button";
      r.setAttribute("aria-label", `${pt.name} ดูทักษะ`);
      const val = s.progress == null ? null : Math.round(s.progress);
      const ch = s.change == null ? "" : `<em class="${s.change >= 0 ? "up" : "down"}">${s.change >= 0 ? "+" : ""}${Math.round(s.change)}</em>`;
      r.innerHTML = `<span class="rk-bar-name">${esc(pt.name)}</span>
        <span class="rk-bar-track">${val == null ? '<i class="rk-none">ยังไม่มีข้อมูล</i>' : `<span class="rk-bar-fill" style="width:${val}%; background:${pt.color}"></span>`}</span>
        <span class="rk-bar-val">${val == null ? "–" : val + "%"}${ch}</span>`;
      r.addEventListener("click", () => openSkills(pt));
      rows.append(r);
    });
    gr.append(rows, el("div", "rk-axis", "<span>0%</span><span>50%</span><span>100%</span>"));
    p.append(gr);

    // chat preview
    const cm = place(el("div", "rk-card rk-chat-mini"), BOX.chatMini);
    cm.innerHTML = "<h3>แชท</h3>";
    CONTACTS.forEach((c) => {
      const msgs = messagesWith(c);
      const lastMsg = msgs[msgs.length - 1];
      const b = el("button", "rk-chat-item");
      b.type = "button";
      b.innerHTML = `${avatarHTML(c)}
        <span class="rk-chat-txt"><b>${esc(c.name)}</b><small>${lastMsg ? esc(lastMsg.text) : "เริ่มคุยกันเลย"}</small></span>`;
      b.addEventListener("click", () => { chatWith = c.id; showTab("chat"); });
      cm.append(b);
    });
    p.append(cm);
  }

  // ---------- ข้อมูลคนไข้ ----------
  function renderPatients() {
    const p = page.patient;
    p.innerHTML = "";
    BOX.rows.forEach((box, i) => {
      const pt = PATIENTS[i];
      if (!pt) { p.append(place(el("div", "rk-card rk-row is-empty", "<span>ว่าง</span>"), box)); return; }
      const s = statsOf(pt);
      const r = place(el("button", "rk-card rk-row"), box);
      r.type = "button";
      const val = s.progress == null ? null : Math.round(s.progress);
      r.innerHTML = `<span class="rk-dot big" style="background:${pt.color}">${pt.short}</span>
        <span class="rk-row-main"><b>${esc(pt.name)}</b>
          <small>${s.recs.length ? `เล่นแล้ว ${s.recs.length} ครั้ง · ล่าสุด ${thaiDate(s.last)}` : "ยังไม่มีข้อมูลการเล่น"}</small>
          <span class="rk-bar-track">${val == null ? "" : `<span class="rk-bar-fill" style="width:${val}%; background:${pt.color}"></span>`}</span></span>
        <span class="rk-row-side"><b>${val == null ? "–" : val + "%"}</b><small>${s.streak ? "🔥 " + s.streak + " วัน" : ""}</small></span>`;
      r.addEventListener("click", () => openSkills(pt));
      p.append(r);
    });
  }
  function thaiDate(s) {
    if (!s) return "–";
    const [y, m, d] = s.split("-").map(Number);
    return `${d} ${THAI_MONTHS[m - 1].slice(0, 3)}.`;
  }

  // ---------- Popup layer ----------
  const sheet = el("div", "rk-sheet");
  sheet.hidden = true;
  screen.append(sheet);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
  function openSheet(cls) {
    sheet.innerHTML = "";
    const card = el("div", "rk-sheet-card " + (cls || ""));
    sheet.append(card);
    sheet.hidden = false;
    return card;
  }
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ""; render(); }
  function closeBtn() {
    const b = el("button", "rk-close", "✕");
    b.type = "button";
    b.setAttribute("aria-label", "ปิด");
    b.addEventListener("click", closeSheet);
    return b;
  }

  // ---------- Spider chart of one patient ----------
  function openSkills(pt) {
    const card = openSheet("rk-skills");
    card.append(closeBtn());
    card.append(el("h2", null, esc(pt.name)));
    skillsContent(card, pt, "ยังไม่มีข้อมูลการเล่นเกม<br>เมื่อคนไข้เริ่มเล่น กราฟทักษะจะแสดงที่นี่");
  }
  // spider chart + best / weakest skill + per-game summary (doctor popup and player page)
  function skillsContent(card, pt, emptyMsg) {
    const s = statsOf(pt);
    const known = s.skills.filter((k) => k.value != null);
    if (!known.length) {
      card.append(el("p", "rk-muted rk-center", emptyMsg));
      return;
    }
    card.append(radarSVG(s.skills, pt.color));
    const best = known.reduce((a, b) => (b.value > a.value ? b : a));
    const weak = known.reduce((a, b) => (b.value < a.value ? b : a));
    card.append(el("div", "rk-skill-sum",
      `<p><span class="rk-tag good">เก่งที่สุด</span> ${best.name} (${Math.round(best.value)})</p>
       <p><span class="rk-tag weak">ควรพัฒนาเพิ่ม</span> ${weak.name} (${Math.round(weak.value)})</p>`));
    const list = el("ul", "rk-skill-list");
    s.skills.forEach((k) => {
      list.append(el("li", null, `<b>${k.name}</b><span>${k.value == null ? "ยังไม่มีข้อมูล" : Math.round(k.value) + " / 100"}</span><small>${k.from}</small>`));
    });
    card.append(list);
    const g = s.byGame;
    const avgOf = (a, f) => (a.length ? (a.reduce((x, r) => x + f(r), 0) / a.length) : null);
    const decWin = g.decor.filter((r) => r.win);
    card.append(el("div", "rk-game-sum",
      `<p>Decor: เล่น ${g.decor.length} ครั้ง${decWin.length ? ` · เวลาเฉลี่ย ${avgOf(decWin, (r) => r.sec).toFixed(1)} วิ` : ""}</p>
       <p>Melody: เล่น ${g.melody.length} ครั้ง${g.melody.length ? ` · ผิดเฉลี่ย ${avgOf(g.melody, (r) => r.miss).toFixed(1)} ครั้ง` : ""}</p>
       <p>Market: เล่น ${g.market.length} ครั้ง${g.market.length ? ` · เก็บเกิน/ผิดเฉลี่ย ${avgOf(g.market, (r) => r.miss).toFixed(1)} · ตะกร้าเต็ม ${g.market.filter((r) => r.full).length} ครั้ง` : ""}</p>`));
  }

  function radarSVG(skills, color) {
    const n = skills.length, cx = 150, cy = 140, R = 95;
    const pt = (i, r) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    let svg = `<svg class="rk-radar" viewBox="-40 0 380 285" role="img" aria-label="กราฟทักษะ">`;
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      svg += `<polygon class="ring" points="${skills.map((_, i) => pt(i, R * f).join(",")).join(" ")}"/>`;
    });
    skills.forEach((k, i) => {
      const [x, y] = pt(i, R);
      svg += `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      const [lx, ly] = pt(i, R + 26);
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${k.name}</text>`;
    });
    const poly = skills.map((k, i) => pt(i, R * (k.value || 0) / 100).join(",")).join(" ");
    svg += `<polygon class="area" points="${poly}" style="fill:${color}; stroke:${color}"/>`;
    skills.forEach((k, i) => {
      const [x, y] = pt(i, R * (k.value || 0) / 100);
      svg += `<circle cx="${x}" cy="${y}" r="5" style="fill:${color}"/>`;
    });
    return el("div", "rk-radar-wrap", svg + "</svg>");
  }

  // =====================================================================
  // Chat
  //   doctor ↔ player accounts on this device: real messages both sides can read
  //     (Memoir.account.messages / postMessage)
  //   sample contacts: patients for the doctor, a doctor for the player; their replies are simulated
  // =====================================================================
  const CHAT_KEY = "memoir.chat.v1";
  const SAMPLE_PATIENTS = [
    { id: "p1", name: "คุณสมศรี ใจดี", short: "ส", color: "#4f8f8a",
      replies: ["ค่ะคุณหมอ วันนี้เล่นเกมไปแล้วนะคะ", "ขอบคุณค่ะ จะพยายามเล่นทุกวันค่ะ", "เกมดนตรีสนุกมากเลยค่ะ", "ได้ค่ะ แล้วเจอกันวันนัดนะคะ"] },
    { id: "p2", name: "คุณประยูร มีสุข", short: "ป", color: "#8a5bb0",
      replies: ["ครับหมอ", "เมื่อวานลืมเล่นไปครับ วันนี้จะเล่นครับ", "เกมตลาดยากนิดหน่อยครับ แต่สนุกดี", "ขอบคุณครับหมอ"] },
  ];
  const SAMPLE_DOCTOR = { id: "d0", name: "คุณหมอใจดี (ตัวอย่าง)", short: "หมอ", color: "#4f8f8a", pic: "doctor",
    replies: ["ได้รับข้อความแล้วนะคะ เก่งมากที่เล่นเกมสม่ำเสมอค่ะ", "ลองเล่นเกมดนตรีวันละ 2-3 ด่านนะคะ ช่วยเรื่องความจำได้ดี",
              "ถ้ารู้สึกเหนื่อย พักสายตาก่อนได้เลยค่ะ", "แล้วเจอกันวันนัดนะคะ"] };
  // contacts for this account (real accounts first)
  const CONTACTS = (() => {
    const acc = window.MemoirAccount;
    if (doctorView) {
      const real = (acc ? acc.players() : []).map((p, i) => ({ id: "acc:" + p.email, email: p.email, real: true,
        name: p.name, short: p.name.charAt(0).toUpperCase(), color: PAL[i % PAL.length], pic: "player" }));
      return [...real.slice(0, 3), ...SAMPLE_PATIENTS];
    }
    const docs = (acc && me ? acc.doctors() : []).map((d) => ({ id: "acc:" + d.email, email: d.email, real: true,
      name: "หมอ " + d.name, short: "หมอ", color: "#4f8f8a", pic: "doctor" }));
    return docs.length ? docs.slice(0, 2) : [SAMPLE_DOCTOR];
  })();
  let chatData = load(CHAT_KEY, null) || (doctorView
    ? { p1: [{ from: "them", text: "สวัสดีค่ะคุณหมอ", t: Date.now() - 36e5 }],
        p2: [{ from: "them", text: "สวัสดีครับหมอ", t: Date.now() - 72e5 }] }
    : { d0: [{ from: "them", text: "สวัสดีค่ะ มีอะไรสอบถามคุณหมอได้เลยนะคะ", t: Date.now() - 36e5 }] });
  let chatWith = CONTACTS[0].id;

  // messages with one contact, as { from: "me" | "them", text, t }
  function messagesWith(c) {
    if (!c.real) return chatData[c.id] || [];
    const acc = window.MemoirAccount;
    const list = doctorView ? acc.messages(me.email, c.email) : acc.messages(c.email, me.email);
    return list.map((m) => ({ from: m.by === me.email ? "me" : "them", text: m.text, t: m.t }));
  }
  function avatarHTML(c) {
    return c.pic
      ? `<span class="rk-dot has-pic" style="background:${c.color}"><img src="assets/icons/web/${c.pic}.png" alt=""></span>`
      : `<span class="rk-dot" style="background:${c.color}">${c.short}</span>`;
  }

  function renderChat() {
    const p = page.chat;
    p.innerHTML = "";
    const box = place(el("div", "rk-card rk-chat"), BOX.chat);
    const heads = el("div", "rk-chat-heads");
    CONTACTS.forEach((c) => {
      const b = el("button", "rk-chat-head" + (c.id === chatWith ? " is-on" : ""),
        `${avatarHTML(c)}<span>${esc(c.name)}</span>`);
      b.type = "button";
      b.addEventListener("click", () => { chatWith = c.id; renderChat(); });
      heads.append(b);
    });
    const log = el("div", "rk-chat-log");
    log.setAttribute("aria-live", "polite");
    const cur = CONTACTS.find((c) => c.id === chatWith) || CONTACTS[0];
    const msgs = messagesWith(cur);
    if (!msgs.length) log.append(el("p", "rk-muted rk-center rk-chat-empty", `เริ่มคุยกับ ${esc(cur.name)} ได้เลย`));
    msgs.forEach((m) => log.append(bubble(m)));
    const form = el("form", "rk-chat-form",
      '<input type="text" maxlength="300" placeholder="พิมพ์ข้อความ..." aria-label="ข้อความ"><button type="submit">ส่ง</button>');
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(chatWith, text, log);
    });
    box.append(heads, log, form);
    p.append(box);
    log.scrollTop = log.scrollHeight;
  }
  function bubble(m) {
    const d = new Date(m.t);
    return el("div", "rk-bubble " + (m.from === "me" ? "me" : "them"), `${esc(m.text)}<time>${pad2(d.getHours())}:${pad2(d.getMinutes())}</time>`);
  }
  function send(id, text, log) {
    const c = CONTACTS.find((x) => x.id === id);
    log.querySelectorAll(".rk-chat-empty").forEach((n) => n.remove());
    if (c.real) {
      // a real account: saved where the other side reads it (they see it when they open the chat)
      const acc = window.MemoirAccount;
      if (doctorView) acc.postMessage(me.email, c.email, text); else acc.postMessage(c.email, me.email, text);
      log.append(bubble({ from: "me", text, t: Date.now() }));
      log.scrollTop = log.scrollHeight;
      return;
    }
    const list = chatData[id] = chatData[id] || [];
    const m = { from: "me", text, t: Date.now() };
    list.push(m);
    save(CHAT_KEY, chatData);
    log.append(bubble(m));
    log.scrollTop = log.scrollHeight;
    // sample contact: simulated reply
    const typing = el("div", "rk-bubble them rk-typing", "<i></i><i></i><i></i>");
    setTimeout(() => { if (log.isConnected) { log.append(typing); log.scrollTop = log.scrollHeight; } }, 500);
    setTimeout(() => {
      typing.remove();
      const r = { from: "them", text: c.replies[(list.filter((x) => x.from === "me").length - 1) % c.replies.length], t: Date.now() };
      list.push(r);
      save(CHAT_KEY, chatData);
      if (log.isConnected && chatWith === id) { log.append(bubble(r)); log.scrollTop = log.scrollHeight; }
    }, 1800);
  }

  // =====================================================================
  // Calendar: events saved in this browser
  //   { id, date: "YYYY-MM-DD", time: "HH:MM", title, text, color }
  // =====================================================================
  const CAL_KEY = "memoir.calendar.v1";
  const COLORS = ["#f6a5a5", "#f8c77a", "#f3e27a", "#a8d8a0", "#9fc9ee", "#c8a8e8"];
  let events = load(CAL_KEY, []);
  const eventsOn = (date) => events.filter((e) => e.date === date).sort((a, b) => a.time.localeCompare(b.time));
  let calMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

  function monthCells(month) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  function miniCalendarHTML() {
    const now = new Date(), today = ymd(now);
    const m = new Date(now.getFullYear(), now.getMonth(), 1);
    let h = `<h3>${THAI_MONTHS[m.getMonth()]} ${m.getFullYear() + 543}</h3><div class="rk-mini-grid">`;
    h += THAI_DAYS.map((d) => `<span class="dow">${d}</span>`).join("");
    monthCells(m).forEach((d) => {
      if (!d) { h += "<span></span>"; return; }
      const ev = eventsOn(ymd(d));
      const style = ev.length ? ` style="background:${ev[0].color}"` : "";
      h += `<span class="${ymd(d) === today ? "today" : ""}${ev.length ? " has" : ""}"${style}>${d.getDate()}</span>`;
    });
    return h + "</div>";
  }

  function openCalendar() {
    const card = openSheet("rk-cal");
    card.append(closeBtn());
    const head = el("div", "rk-cal-head");
    const prev = el("button", "rk-cal-nav", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "เดือนก่อน");
    const next = el("button", "rk-cal-nav", "›"); next.type = "button"; next.setAttribute("aria-label", "เดือนถัดไป");
    const title = el("h2");
    head.append(prev, title, next);
    const add = el("button", "rk-btn primary", "+ เพิ่มนัดหมาย");
    add.type = "button";
    const grid = el("div", "rk-cal-grid");
    card.append(head, grid, add);
    const today = ymd(new Date());
    function draw() {
      title.textContent = `${THAI_MONTHS[calMonth.getMonth()]} ${calMonth.getFullYear() + 543}`;
      grid.innerHTML = THAI_DAYS.map((d) => `<span class="dow">${d}</span>`).join("");
      monthCells(calMonth).forEach((d) => {
        if (!d) { grid.append(el("span", "blank")); return; }
        const key = ymd(d), ev = eventsOn(key);
        const c = el("button", "rk-day" + (key === today ? " today" : "") + (ev.length ? " has" : ""));
        c.type = "button";
        if (ev.length) c.style.background = ev[0].color;
        c.innerHTML = `<b>${d.getDate()}</b>` + ev.slice(0, 2).map((e) => `<small>${esc(e.title)}</small>`).join("") +
          (ev.length > 2 ? `<small class="more">+${ev.length - 2}</small>` : "");
        c.setAttribute("aria-label", `วันที่ ${d.getDate()}${ev.length ? ` มี ${ev.length} นัด` : ""}`);
        c.addEventListener("click", () => openDay(key));
        grid.append(c);
      });
    }
    prev.addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); draw(); });
    next.addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); draw(); });
    add.addEventListener("click", () => openForm({ date: today }));
    draw();
  }

  function dateLabel(key) {
    const [y, m, d] = key.split("-").map(Number);
    return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
  }

  // All appointments of one day
  function openDay(key) {
    const card = openSheet("rk-day-card");
    const back = el("button", "rk-btn", "‹ ปฏิทิน"); back.type = "button";
    back.addEventListener("click", openCalendar);
    card.append(closeBtn(), back, el("h2", null, dateLabel(key)));
    const ev = eventsOn(key);
    if (!ev.length) card.append(el("p", "rk-muted rk-center", "ยังไม่มีนัดในวันนี้"));
    ev.forEach((e) => {
      const item = el("div", "rk-event", `<span class="rk-event-color" style="background:${e.color}"></span>
        <div class="rk-event-body"><b>${esc(e.time)} · ${esc(e.title)}</b><p>${esc(e.text) || '<span class="rk-muted">ไม่มีรายละเอียด</span>'}</p></div>`);
      const actions = el("div", "rk-event-actions");
      const edit = el("button", "rk-btn small", "แก้ไข"); edit.type = "button";
      const del = el("button", "rk-btn small danger", "ลบ"); del.type = "button";
      edit.addEventListener("click", () => openForm(e));
      // first tap asks (the button turns into "ยืนยันลบ"), second tap deletes
      del.addEventListener("click", () => {
        if (!del.classList.contains("is-confirm")) {
          del.classList.add("is-confirm");
          del.textContent = "ยืนยันลบ";
          setTimeout(() => { if (del.isConnected) { del.classList.remove("is-confirm"); del.textContent = "ลบ"; } }, 4000);
          return;
        }
        events = events.filter((x) => x.id !== e.id);
        save(CAL_KEY, events);
        openDay(key);
      });
      actions.append(edit, del);
      item.append(actions);
      card.append(item);
    });
    const add = el("button", "rk-btn primary", "+ เพิ่มนัดวันนี้"); add.type = "button";
    add.addEventListener("click", () => openForm({ date: key }));
    card.append(add);
  }

  // Add / edit form: date, time, title, message, highlight colour
  function openForm(e) {
    const editing = !!e.id;
    const card = openSheet("rk-form-card");
    card.append(closeBtn(), el("h2", null, editing ? "แก้ไขนัดหมาย" : "เพิ่มนัดหมาย"));
    const form = el("form", "rk-form");
    let color = e.color || COLORS[0];
    form.innerHTML = `
      <label>วันที่<input name="date" type="date" required value="${esc(e.date || "")}"></label>
      <label>เวลา<input name="time" type="time" required value="${esc(e.time || "09:00")}"></label>
      <label>หัวข้อ<input name="title" type="text" maxlength="40" required placeholder="เช่น นัดตรวจ" value="${esc(e.title || "")}"></label>
      <label>ข้อความ<textarea name="text" rows="3" maxlength="300" placeholder="รายละเอียด">${esc(e.text || "")}</textarea></label>
      <fieldset><legend>สีไฮไลต์</legend><div class="rk-colors">${COLORS.map((c) =>
        `<button type="button" class="rk-color${c === color ? " is-on" : ""}" data-c="${c}" style="background:${c}" aria-label="สี"></button>`).join("")}</div></fieldset>
      <div class="rk-form-actions"><button type="button" class="rk-btn" data-act="cancel">ยกเลิก</button><button type="submit" class="rk-btn primary">ตกลง</button></div>`;
    form.querySelector(".rk-colors").addEventListener("click", (ev) => {
      const b = ev.target.closest(".rk-color");
      if (!b) return;
      color = b.dataset.c;
      form.querySelectorAll(".rk-color").forEach((x) => x.classList.toggle("is-on", x === b));
    });
    form.querySelector('[data-act="cancel"]').addEventListener("click", () => (editing ? openDay(e.date) : openCalendar()));
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = new FormData(form);
      const rec = {
        id: e.id || "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: f.get("date"), time: f.get("time"), title: String(f.get("title")).trim(), text: String(f.get("text")).trim(), color,
      };
      if (!rec.title) return;
      events = events.filter((x) => x.id !== rec.id).concat(rec);
      save(CAL_KEY, events);
      const [y, m] = rec.date.split("-").map(Number);
      calMonth = new Date(y, m - 1, 1);
      openCalendar();
    });
    card.append(form);
    form.querySelector('[name="title"]').focus();
  }

  render();
  window.Memoir.rank = { render, statsOf, PATIENTS };
})();

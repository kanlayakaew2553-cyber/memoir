/* Daily quests (ภารกิจประจำวัน).
 *
 *   - Every day 3 quests are picked from POOL (same 3 all day, new ones after midnight).
 *   - Progress comes from today's play history (window.Memoir.history).
 *   - A finished quest is claimed by tapping "รับรางวัล": 2 hearts or 20 coins.
 *   - The quest book (art: Drive "เควส") sits on the home screen under the heart bar,
 *     with a red badge when a reward is waiting.
 */
(() => {
  "use strict";

  const M = window.Memoir;
  const PER_DAY = 3;
  const REWARD = { hearts: { kind: "hearts", n: 2, label: "หัวใจ 2 ดวง", icon: "assets/hud/web/icon_heart.png" },
                   coins:  { kind: "coins",  n: 20, label: "20 เหรียญ",  icon: "assets/hud/web/icon_coin.png" } };
  // count(todayRecords) → progress. Add / change quests here.
  const POOL = [
    { id: "play3",   text: "เล่นเกมให้ครบ 3 ด่าน",           target: 3, count: (r) => r.length },
    { id: "win5",    text: "ผ่านด่านรวม 5 ด่าน",              target: 5, count: (r) => r.filter((x) => x.win).length },
    { id: "decor",   text: "ผ่านด่าน Memory Decor 1 ด่าน",    target: 1, count: (r) => r.filter((x) => x.win && x.g === "decor").length },
    { id: "melody",  text: "ผ่านด่าน Memory Melody 1 ด่าน",   target: 1, count: (r) => r.filter((x) => x.win && x.g === "melody").length },
    { id: "market",  text: "ผ่านด่าน Memory Market 1 ด่าน",   target: 1, count: (r) => r.filter((x) => x.win && x.g === "market").length },
    { id: "stars3",  text: "ได้ 3 ดาวในด่านใดก็ได้",          target: 1, count: (r) => r.filter((x) => x.stars >= 3).length },
    { id: "all3",    text: "เล่นให้ครบทั้ง 3 เกม",            target: 3, count: (r) => new Set(r.map((x) => x.g)).size },
  ];
  const KEY = "memoir.quests.v1";

  const pad2 = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage off */ } }

  // Same picks all day: shuffle the pool with a seed made from the date
  function picksFor(date) {
    let seed = 0;
    for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const order = POOL.map((q) => [rnd(), q]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return order.slice(0, PER_DAY).map((q, i) => ({ ...q, reward: (i + Math.floor(rnd() * 2)) % 2 ? REWARD.hearts : REWARD.coins }));
  }

  function state() {
    const d = today();
    let s = load();
    if (s.date !== d) { s = { date: d, claimed: [] }; save(s); }
    const recs = M.history.list.filter((r) => r.d === d);
    return {
      s,
      quests: picksFor(d).map((q) => {
        const p = Math.min(q.target, q.count(recs));
        return { ...q, progress: p, done: p >= q.target, claimed: s.claimed.includes(q.id) };
      }),
    };
  }

  // =====================================================================
  // Quest book on the home screen
  // =====================================================================
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "quest-btn";
  btn.setAttribute("aria-label", "ภารกิจประจำวัน");
  btn.innerHTML = '<img src="assets/hud/web/quest.png" alt="" draggable="false"><span class="quest-badge" hidden></span><span class="quest-label">ภารกิจ<br>ประจำวัน</span>';
  document.getElementById("screen-home").append(btn);
  const badge = btn.querySelector(".quest-badge");
  btn.addEventListener("click", () => open());

  function updateBadge() {
    const n = state().quests.filter((q) => q.done && !q.claimed).length;
    badge.hidden = !n;
    badge.textContent = n;
    btn.classList.toggle("has-reward", n > 0);
  }
  M.onShow("screen-home", updateBadge);

  // =====================================================================
  // Quest panel
  // =====================================================================
  const modal = document.createElement("div");
  modal.className = "modal quest-modal";
  modal.hidden = true;
  modal.innerHTML = '<div class="modal-card quest-card" role="dialog" aria-modal="true" aria-label="ภารกิจประจำวัน"></div>';
  document.getElementById("stage").append(modal);
  const card = modal.firstElementChild;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  function untilMidnight() {
    const now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const m = Math.ceil((end - now) / 60000);
    return `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
  }

  function render() {
    const { quests } = state();
    card.innerHTML = `<h2>ภารกิจประจำวัน</h2><p class="quest-reset">ภารกิจใหม่ในอีก ${untilMidnight()}</p><ul class="quest-list"></ul>
      <div class="modal-buttons"><button type="button" class="modal-btn" data-act="close">ปิด</button></div>`;
    const ul = card.querySelector(".quest-list");
    quests.forEach((q) => {
      const li = document.createElement("li");
      li.className = "quest-item" + (q.claimed ? " is-claimed" : q.done ? " is-done" : "");
      li.innerHTML = `
        <div class="quest-main">
          <b>${q.text}</b>
          <div class="quest-bar"><span style="width:${100 * q.progress / q.target}%"></span></div>
          <small>${q.progress} / ${q.target}</small>
        </div>
        <div class="quest-reward"><img src="${q.reward.icon}" alt=""><span>${q.reward.label}</span></div>`;
      const act = document.createElement("button");
      act.type = "button";
      act.className = "quest-claim";
      act.textContent = q.claimed ? "รับแล้ว ✓" : q.done ? "รับรางวัล" : "ยังไม่ครบ";
      act.disabled = q.claimed || !q.done;
      act.addEventListener("click", () => claim(q));
      li.append(act);
      ul.append(li);
    });
    card.querySelector('[data-act="close"]').addEventListener("click", close);
  }

  function claim(q) {
    const { s } = state();
    if (s.claimed.includes(q.id)) return;
    s.claimed.push(q.id);
    save(s);
    if (q.reward.kind === "hearts") {
      const got = M.wallet.addHearts(q.reward.n);
      M.toast(got ? `ได้หัวใจ ${got} ดวง` : "หัวใจเต็มแล้ว (สูงสุด 15 ดวง)");
    } else {
      M.wallet.addCoins(q.reward.n);
      M.toast(`ได้ ${q.reward.n} เหรียญ`);
    }
    render();
    updateBadge();
  }

  function open() { render(); modal.hidden = false; }
  function close() { modal.hidden = true; updateBadge(); }

  setInterval(updateBadge, 30000);
  updateBadge();
  M.quests = { state, open, POOL };
})();

/* Hearts and coins (saved on this device).
 *
 *   - A new player starts with 7 hearts and 0 coins.
 *   - Losing any level takes 1 heart. With 0 hearts a level cannot be started.
 *   - 1 heart comes back every hour, up to 15.
 *   - A heart can be bought for 90 coins. Coins are earned by winning levels.
 *
 * The heart / coin bar (art: assets/hud/web, Drive "แถบหัวใจดาว") sits at the top of the home screen.
 * Exposes window.Memoir.wallet.
 */
(() => {
  "use strict";

  const CONFIG = {
    startHearts: 7,
    maxHearts: 15,
    regenMs: 60 * 60 * 1000,   // +1 heart every hour
    heartPrice: 90,            // coins for 1 heart
  };
  const KEY = "memoir.wallet.v1";
  const M = window.Memoir;
  let popTimer = null;   // refreshes the open popup every second

  let w = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } })() ||
          { hearts: CONFIG.startHearts, coins: 0, regenFrom: Date.now() };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) { /* storage off */ } }

  // Give back the hearts earned since regenFrom
  function regen() {
    const now = Date.now();
    if (w.hearts >= CONFIG.maxHearts) { w.regenFrom = now; return; }
    const got = Math.floor((now - w.regenFrom) / CONFIG.regenMs);
    if (got > 0) {
      w.hearts = Math.min(CONFIG.maxHearts, w.hearts + got);
      w.regenFrom = w.hearts >= CONFIG.maxHearts ? now : w.regenFrom + got * CONFIG.regenMs;
      save();
    }
  }
  const nextHeartMs = () => (w.hearts >= CONFIG.maxHearts ? 0 : Math.max(0, w.regenFrom + CONFIG.regenMs - Date.now()));
  function fmt(ms) {
    const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  const wallet = {
    CONFIG,
    get hearts() { regen(); return w.hearts; },
    get coins() { return w.coins; },
    nextHeartMs() { regen(); return nextHeartMs(); },
    canPlay() { regen(); return w.hearts > 0; },
    loseHeart() {
      regen();
      if (w.hearts >= CONFIG.maxHearts) w.regenFrom = Date.now();   // the hourly timer starts now
      w.hearts = Math.max(0, w.hearts - 1);
      save(); update();
    },
    // reward hearts (never above the maximum); returns how many were really added
    addHearts(n) {
      regen();
      const before = w.hearts;
      w.hearts = Math.min(CONFIG.maxHearts, w.hearts + Math.max(0, n | 0));
      if (w.hearts >= CONFIG.maxHearts) w.regenFrom = Date.now();
      save(); update();
      return w.hearts - before;
    },
    addCoins(n) {
      n = Math.max(0, Math.round(n || 0));
      if (!n) return;
      w.coins += n;
      save(); update();
    },
    // buy n hearts at CONFIG.heartPrice each (not above the maximum)
    canBuy(n = 1) { regen(); return w.coins >= CONFIG.heartPrice * n && w.hearts + n <= CONFIG.maxHearts; },
    buyHeart(n = 1) {
      regen();
      if (!wallet.canBuy(n)) return false;
      w.coins -= CONFIG.heartPrice * n;
      if (w.hearts === 0 && nextHeartMs() <= 0) w.regenFrom = Date.now();
      w.hearts += n;
      if (w.hearts >= CONFIG.maxHearts) w.regenFrom = Date.now();
      save(); update();
      return true;
    },
    // Call before starting a level: true = go ahead; false = out of hearts (a popup is shown,
    // and onBought runs if the player buys a heart there)
    check(onBought) {
      if (wallet.canPlay()) return true;
      showOut(onBought);
      return false;
    },
  };


  // =====================================================================
  // Heart / coin bar on the home screen (tapping it opens the shop)
  // =====================================================================
  const HUD = "assets/hud/web/";
  const bar = document.createElement("div");
  bar.className = "wallet-bar";
  bar.innerHTML = `
    <button type="button" class="wallet-pill" data-k="hearts" aria-label="หัวใจ – เปิดร้านค้า">
      <img class="wallet-bg" src="${HUD}bar.png" alt="" draggable="false">
      <img class="wallet-icon heart" src="${HUD}icon_heart.png" alt="" draggable="false">
      <b class="wallet-num"></b><small class="wallet-timer"></small>
    </button>
    <button type="button" class="wallet-pill" data-k="coins" aria-label="เหรียญ – เปิดร้านค้า">
      <img class="wallet-bg" src="${HUD}bar.png" alt="" draggable="false">
      <img class="wallet-icon coin" src="${HUD}icon_coin.png" alt="" draggable="false">
      <b class="wallet-num"></b>
    </button>`;
  document.getElementById("screen-home").append(bar);
  const heartNum = bar.querySelector('[data-k="hearts"] .wallet-num');
  const heartTimer = bar.querySelector(".wallet-timer");
  const coinNum = bar.querySelector('[data-k="coins"] .wallet-num');
  bar.querySelector('[data-k="hearts"]').addEventListener("click", () => openShop());
  bar.querySelector('[data-k="coins"]').addEventListener("click", () => openShop());

  // Shop button on home, under the daily-missions book (art: Drive "SHOP")
  const shopBtn = document.createElement("button");
  shopBtn.type = "button";
  shopBtn.className = "shop-btn";
  shopBtn.setAttribute("aria-label", "ร้านค้า");
  shopBtn.innerHTML = `<img src="${HUD}shop.png" alt="" draggable="false"><span class="shop-label">ร้านค้า</span>`;
  shopBtn.addEventListener("click", () => openShop());
  document.getElementById("screen-home").append(shopBtn);

  function update() {
    regen();
    heartNum.textContent = w.hearts;
    coinNum.textContent = w.coins;
    const ms = nextHeartMs();
    heartTimer.textContent = w.hearts >= CONFIG.maxHearts ? "เต็ม" : `+1 ใน ${fmt(ms)}`;
    if (popTimer) popTimer();
  }
  setInterval(update, 1000);
  M.onShow("screen-home", update);
  update();

  // =====================================================================
  // Shop popup (shared, on top of any screen). Sells hearts for coins.
  // Also shown when the hearts run out, with the level starting after a purchase.
  // =====================================================================
  const OFFERS = [1, 3];   // hearts per offer; price = CONFIG.heartPrice each
  const modal = document.createElement("div");
  modal.className = "modal shop-modal";
  modal.hidden = true;
  modal.innerHTML = '<div class="shop-card" role="dialog" aria-modal="true" aria-label="ร้านค้า"></div>';
  document.getElementById("stage").append(modal);
  const card = modal.firstElementChild;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  function openShop(opts = {}) {
    const out = !!opts.out;
    card.innerHTML = `
      <button type="button" class="shop-x" aria-label="ปิด">✕</button>
      <img class="shop-sign" src="${HUD}shop.png" alt="ร้านค้า" draggable="false">
      ${out ? '<p class="shop-alert">หัวใจหมดแล้ว ซื้อหัวใจเพื่อเล่นต่อ หรือรอหัวใจเพิ่มเอง</p>' : ""}
      <div class="shop-have">
        <span><img src="${HUD}icon_heart.png" alt=""> <b data-v="h"></b> / ${CONFIG.maxHearts}</span>
        <span><img src="${HUD}icon_coin.png" alt=""> <b data-v="c"></b></span>
      </div>
      <p class="shop-next" data-v="t"></p>
      <ul class="shop-list">
        ${OFFERS.map((n) => `
          <li class="shop-item">
            <span class="shop-hearts">${Array.from({ length: n }, () => `<img src="${HUD}icon_heart.png" alt="">`).join("")}</span>
            <span class="shop-name">หัวใจ ${n} ดวง</span>
            <button type="button" class="shop-buy" data-n="${n}">
              <img src="${HUD}icon_coin.png" alt=""> ${CONFIG.heartPrice * n}
            </button>
          </li>`).join("")}
      </ul>`;
    popTimer = () => {
      card.querySelector('[data-v="h"]').textContent = w.hearts;
      card.querySelector('[data-v="c"]').textContent = w.coins;
      card.querySelector('[data-v="t"]').textContent = w.hearts >= CONFIG.maxHearts
        ? "หัวใจเต็มแล้ว"
        : `หัวใจดวงถัดไปจะมาเองใน ${fmt(nextHeartMs())} นาที`;
      card.querySelectorAll(".shop-buy").forEach((b) => {
        const n = Number(b.dataset.n);
        const full = w.hearts + n > CONFIG.maxHearts, poor = w.coins < CONFIG.heartPrice * n;
        b.disabled = full || poor;
        b.title = full ? "หัวใจจะเกิน 15 ดวง" : poor ? "เหรียญไม่พอ" : "";
        b.closest(".shop-item").dataset.why = full ? "หัวใจจะเกิน 15 ดวง" : poor ? "เหรียญไม่พอ" : "";
      });
    };
    card.querySelectorAll(".shop-buy").forEach((b) => b.addEventListener("click", () => {
      const n = Number(b.dataset.n);
      if (!wallet.buyHeart(n)) return;
      M.toast(`ได้หัวใจเพิ่ม ${n} ดวง`);
      if (opts.onBought) { close(); opts.onBought(); }
    }));
    card.querySelector(".shop-x").addEventListener("click", close);
    popTimer();
    modal.hidden = false;
  }
  function close() { modal.hidden = true; popTimer = null; }
  function showOut(onBought) { openShop({ out: true, onBought }); }
  wallet.openShop = openShop;

  M.wallet = wallet;
})();

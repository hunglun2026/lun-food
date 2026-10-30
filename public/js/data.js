/* 臺灣美食探險家：共用資料層。所有頁面都先載入這支，再各自畫畫面。
   負責：抓資料並快取、大類、縣市、圖片備援、小工具、年級、網址參數。 */
(function () {
  "use strict";

  // ---- 大類（要跟後端 src/cuisine.ts 的 GROUPS 一致）----
  const GROUPS = [
    { id: "snack", name: "台灣小吃", emoji: "🍜", color: "#e07a3f", hint: "夜市、小吃攤、台菜" },
    { id: "chinese", name: "中式港式", emoji: "🥟", color: "#c8341f", hint: "中餐八大菜系、港式飲茶" },
    { id: "asian", name: "日韓東南亞", emoji: "🍣", color: "#3a8fd9", hint: "日式、韓式、泰越南洋料理" },
    { id: "west", name: "西式異國", emoji: "🍝", color: "#8a5bb5", hint: "義式、美式、歐式與其他異國料理" },
    { id: "grill", name: "燒烤火鍋海鮮", emoji: "🍲", color: "#b0552f", hint: "燒烤、鐵板燒、火鍋、海鮮、牛排" },
    { id: "noodle", name: "麵粥便當", emoji: "🍱", color: "#d9a520", hint: "牛肉麵、粥品、便當自助餐、速食" },
    { id: "dessert", name: "甜點麵包", emoji: "🍰", color: "#d96a9a", hint: "冰品、甜點、麵包糕點" },
    { id: "drink", name: "咖啡茶飲", emoji: "☕", color: "#7a5a3c", hint: "咖啡、茶、飲料" },
    { id: "souvenir", name: "伴手禮特產", emoji: "🎁", color: "#2fb5a0", hint: "地方特產、伴手禮、禮盒（不是正餐）" },
    { id: "veg", name: "素食特殊飲食", emoji: "🥬", color: "#3f9c5a", hint: "素食、純素、清真、無麩質、健康飲食" },
    { id: "other", name: "其他", emoji: "🍴", color: "#8a8f98", hint: "資料裡沒有寫明類型的店" },
  ];
  const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

  // 資料裡實際有的縣市（20 個）。臺北市、金門縣目前沒有資料，不列
  const CITY_ORDER = ["基隆市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣",
    "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "連江縣"];
  const FEW = 60; // 低於這個店數，縣市頁提示「資料較少」

  // ---- 載入與快取 ----
  const KEY = "food-cache-v1";
  const FORMAT = 1; // 快取資料的格式代號：API 欄位或 enrich() 用到的欄位改了就加 1，舊快取就不會被新程式拿來用
  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || "null");
      return c && c.format === FORMAT && Array.isArray(c.shops) ? c : null;
    } catch (e) { return null; } // 無痕模式可能不能用
  }
  function saveCache(meta, shops) {
    try { localStorage.setItem(KEY, JSON.stringify({ format: FORMAT, modifiedDate: meta.modifiedDate, syncedAt: meta.syncedAt, version: meta.version, shops })); } catch (e) { /* 容量滿就不存 */ }
  }
  const getJson = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); });
  // 抓列表一定帶上「最後匯入時間」：伺服器依它分開快取，同步後才不會拿到舊資料卻當成新的存起來
  const getShops = (m) => getJson("/api/shops?m=" + encodeURIComponent(m.syncedAt || "")).then((d) => d.shops);

  function enrich(s) {
    s.group = GROUP_BY_ID[s.grp] || GROUP_BY_ID.other;
    s.place = s.city + s.town;
    s.hasMap = typeof s.lat === "number" && typeof s.lon === "number";
    return s;
  }

  // 有本機快取就馬上用它畫畫面，背景再問伺服器資料有沒有更新（有就存起來，下一頁生效）。
  // 教室網路斷了也照樣能用。第一次（沒快取）才等網路。
  async function load() {
    let meta, shops;
    const cached = readCache();
    if (cached) {
      shops = cached.shops;
      meta = { modifiedDate: cached.modifiedDate, syncedAt: cached.syncedAt, version: cached.version, count: shops.length };
      getJson("/api/meta").then((m) => {
        if (m.syncedAt !== cached.syncedAt || m.version !== cached.version) return getShops(m).then((list) => saveCache(m, list));
      }).catch(() => { /* 離線或伺服器忙：下次再檢查 */ });
    } else {
      meta = await getJson("/api/meta");
      shops = await getShops(meta);
      saveCache(meta, shops);
    }
    shops.forEach(enrich);
    return { shops, meta };
  }
  // 詳細資料（營業時間、電話、說明…）點進去才抓，列表不帶
  const loadShop = (id) => getJson("/api/shop?id=" + encodeURIComponent(id)).then((d) => (d.shop ? enrich(d.shop) : null));

  // ---- 圖片：先用資料集的照片，載入失敗換成類別示意圖 ----
  // 示意圖是 /img/group/<大類>.webp（AI 生成的寫實照，頁面上要標「示意圖」）；示意圖也沒有就退回表情符號色塊
  function placeholder(s, cls) {
    const d = document.createElement("div");
    d.className = "ph " + (cls || "");
    d.style.background = s.group.color + "22";
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", s.name + "（示意圖）");
    const img = new Image();
    img.src = "/img/group/" + s.group.id + ".webp?v=1";
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { img.remove(); d.insertAdjacentHTML("afterbegin", '<span aria-hidden="true">' + s.group.emoji + "</span>"); };
    d.appendChild(img);
    const tag = document.createElement("small");
    tag.className = "ph-tag";
    tag.textContent = "示意圖";
    d.appendChild(tag);
    return d;
  }
  // photo(s)：卡片、遊戲用的小圖；photo(s, i, cls)：詳細頁第 i 張。圖壞了（政府網站常改版）就換示意圖
  function photo(s, i, cls) {
    const url = i == null ? s.img : (s.images && s.images[i] && s.images[i].url);
    if (!url) return i > 0 ? document.createComment("") : placeholder(s, cls);
    const img = new Image();
    img.className = "photo " + (cls || "");
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.alt = (i != null && s.images[i].alt) || s.name;
    img.onerror = () => { if (i > 0) img.remove(); else img.replaceWith(placeholder(s, cls)); };
    img.src = url;
    return img;
  }

  // 遊戲開局前先確認照片真的載得進來：壞圖會換成類別示意圖，等於把答案告訴學生。
  // 從候選裡依序試載，湊滿 n 張就停；每張最多等 5 秒，載不到的丟掉（瀏覽器已快取，之後 photo() 不會再下載）
  function usablePhotos(cands, n) {
    return new Promise((resolve) => {
      const ok = [];
      let next = 0, pending = 0, done = false;
      const finish = () => { if (!done) { done = true; resolve(ok.slice(0, n)); } };
      const launch = () => {
        while (!done && pending < 8 && ok.length + pending < n && next < cands.length) {
          const s = cands[next++];
          const img = new Image();
          pending++;
          const t = setTimeout(() => settle(false), 5000);
          const settle = (good) => {
            if (img.dataset.d) return;
            img.dataset.d = "1";
            clearTimeout(t);
            pending--;
            if (good) ok.push(s);
            if (ok.length >= n || (next >= cands.length && pending === 0)) finish(); else launch();
          };
          img.referrerPolicy = "no-referrer";
          img.onload = () => settle(true);
          img.onerror = () => settle(false);
          img.src = s.img;
        }
        if (!pending && next >= cands.length) finish();
      };
      launch();
    });
  }

  // ---- 小工具 ----
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  // el(html)：HTML 字串轉成「單一」元素。多個頂層元素要自己包一層 <div>，否則後面的會被丟掉
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    if (t.content.children.length > 1) console.warn("Food.el：HTML 有多個頂層元素，只會用第一個", html.slice(0, 60));
    return t.content.firstElementChild;
  };
  // 安全的外部網址（只收 http／https），資料來源不是我們的，不信任
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  // Google 地圖：用店名＋地址搜尋，比只用座標更準（座標有些是縣市政府填的概略點）
  const mapLink = (s) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.name + " " + (s.city || "") + (s.town || "") + (s.street || ""));

  // 自製確認對話框（不用瀏覽器內建的 alert／confirm）
  function dialog(message, buttons) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = "zdlg";
      d.innerHTML = "<p>" + esc(message) + '</p><div class="row"></div>';
      (buttons || [{ label: "好", value: true, primary: true }]).forEach((b) => {
        const btn = document.createElement("button");
        btn.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
        btn.textContent = b.label;
        btn.onclick = () => { d.close(); d.remove(); resolve(b.value); };
        d.lastChild.appendChild(btn);
      });
      document.body.appendChild(d);
      d.showModal();
    });
  }

  // 年級（low／mid／high）：只影響呈現（注音、朗讀語速、預設難度），不擋內容。
  // 沒選過就沿用首頁引導問過的年級（food-guide），都沒有當中年級。切換時發 food-grade 事件，頁面不用重整
  const GRADES = { low: "低年級", mid: "中年級", high: "高年級" };
  function grade() {
    try {
      const g = localStorage.getItem("food-grade") || (JSON.parse(localStorage.getItem("food-guide") || "{}").lv);
      if (GRADES[g]) return g;
    } catch (e) { /* 無痕模式 */ }
    return "mid";
  }
  function setGrade(g) {
    if (!GRADES[g]) return;
    try { localStorage.setItem("food-grade", g); } catch (e) { /* 忽略 */ }
    document.documentElement.dataset.grade = g;
    document.dispatchEvent(new CustomEvent("food-grade", { detail: g }));
  }
  if (typeof document !== "undefined" && document.documentElement) document.documentElement.dataset.grade = grade(); // 單元測試沒有網頁

  // 網址 # 後面的 m=easy&grade=low（首頁推薦卡直達遊戲、老師的班級連結用）。
  // 不是 a=b 格式的（#店家編號、#guide）回空物件，不會跟原本的用法打架
  function hashParams() {
    const h = location.hash.slice(1);
    const out = {};
    if (h.includes("=")) new URLSearchParams(h).forEach((v, k) => { out[k] = v; });
    return out;
  }

  window.Food = { GROUPS, GROUP_BY_ID, CITY_ORDER, FEW, GRADES, enrich, load, loadShop, usablePhotos, photo, placeholder, esc, shuffle, pick, el, safeUrl, mapLink, dialog, grade, setGrade, hashParams };
})();

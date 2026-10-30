/* 猜縣市美食：看照片和店家簡介（地名遮起來），猜這間店在哪個縣市。入門 3 選 1、挑戰 6 選 1、60 秒挑戰。
   簡介來自 /api/clues（只有這個遊戲才載）。店數太少的縣市不出題，不然題庫會一直重複。 */
Food.boot(async function (shops) {
  const { esc, el, shuffle } = Food;
  const root = document.getElementById("root");
  const MIN_CITY = 20; // 每個縣市至少要有這麼多題才列入
  const stem = (n) => n.replace(/[縣市鄉鎮區]$/, "");
  const CITY_STEMS = Food.CITY_ORDER.map(stem);
  const fail = (msg) => root.replaceChildren(el('<p class="err">' + msg + '<br><button class="btn" onclick="location.reload()">重新整理</button></p>'));

  // 把簡介切成第一句，遮掉自己縣市與鄉鎮的名字；提到別的縣市就不用（會誤導）；太短就不用
  function makeClue(shop, text) {
    let t = (text || "").replace(/\s+/g, " ").trim();
    const m = t.match(/^[^。！？]{12,}[。！？]/);
    t = (m ? m[0] : t.slice(0, 60)).trim();
    const own = [shop.city, stem(shop.city), shop.town, stem(shop.town || "")].filter((x) => x && x.length >= 2);
    own.sort((a, b) => b.length - a.length).forEach((x) => { t = t.split(x).join("○○"); });
    if (CITY_STEMS.some((c) => c !== stem(shop.city) && t.includes(c))) return "";
    return t.replace(/(○○)+/g, "○○").length >= 12 ? t : "";
  }

  let pool = [];
  try {
    const m = await fetch("/api/meta").then((r) => r.json());
    const d = await fetch("/api/clues?m=" + encodeURIComponent(m.syncedAt || "")).then((r) => r.json());
    const byId = new Map(shops.map((s) => [s.id, s]));
    d.clues.forEach((c) => { const s = byId.get(c.id); if (s && s.img) { const t = makeClue(s, c.t); if (t) pool.push({ s, t }); } });
  } catch (e) { /* 下面會顯示載入失敗 */ }
  const count = {};
  pool.forEach((p) => { count[p.s.city] = (count[p.s.city] || 0) + 1; });
  const cities = Food.CITY_ORDER.filter((c) => (count[c] || 0) >= MIN_CITY);
  pool = pool.filter((p) => cities.includes(p.s.city));
  if (cities.length < 3) { fail("題目暫時載入不了，請稍後再試。"); return; }

  const MODES = { easy: { k: 3 }, hard: { k: 6 } };

  function menu() {
    root.replaceChildren(el(
      '<div class="panel"><p class="lead zy" style="margin-top:0">看照片和店家介紹，猜猜這間店在哪個縣市。介紹裡的地名被遮起來了。一共 10 題。</p>' +
      '<p><button class="btn primary big zy" data-m="easy">入門（三個縣市選一個）</button></p>' +
      '<p><button class="btn big zy" data-m="hard">挑戰（六個縣市選一個）</button></p>' +
      '<p><button class="btn big zy" data-m="easy" data-t="1">⏱️ 60 秒挑戰</button> <small>入門三選一，答越多越好</small></p>' +
      "<p><small>題目來自觀光署資料裡有照片和介紹的店，共 " + cities.length + " 個縣市。店家資料太少的縣市沒有出題。</small></p></div>"
    ));
    root.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => play(b.dataset.m, !!b.dataset.t)));
  }

  async function play(mode, timed) {
    root.replaceChildren(el('<div class="loading">正在挑照片…📷</div>'));
    const n = timed ? 40 : 10, k = MODES[mode].k;
    // 每個縣市限量抽，題目的縣市才會平均；候選多抽一些，壞圖的會被換掉
    const cap = Math.ceil((n * 2) / cities.length) + 1;
    const per = {};
    const picked = shuffle(pool).filter((p) => (per[p.s.city] = (per[p.s.city] || 0) + 1) <= cap);
    const ok = await Food.usablePhotos(picked.map((p) => p.s), n);
    const clueOf = new Map(picked.map((p) => [p.s.id, p.t]));
    if (ok.length < 3) { fail("照片暫時載入不了，請稍後再試。"); return; }
    const rounds = ok.map((s) => {
      const others = shuffle(cities.filter((c) => c !== s.city)).slice(0, k - 1);
      return {
        shop: s,
        prompt: "這間店在哪個縣市？<br><small>" + esc(clueOf.get(s.id)) + "</small>",
        options: shuffle([s.city].concat(others)).map((c) => ({ id: c, label: c })),
        answer: s.city,
        explain: esc(s.name) + "在" + esc(s.city + s.town) + "。",
      };
    });
    Quiz.run(root, { key: "guess-" + mode + (timed ? "-timed" : ""), title: timed ? "60 秒猜縣市" : "猜縣市美食", rounds, onAgain: menu, timed: timed ? 60 : 0, guide: "guess" });
  }
  const direct = Food.hashParams().m;
  if (direct === "timed") play("easy", true);
  else if (MODES[direct]) play(direct, false);
  else menu();
});

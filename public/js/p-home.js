/* 首頁：三個入口（旅客、學生、老師）、縣市與類型捷徑、隨機推薦。
   不放動畫：首頁要快，旅客是來找店的。 */
Food.boot(function (shops) {
  const { esc, el, pick } = Food;
  const root = document.getElementById("root");
  const cityCount = {};
  shops.forEach((s) => { cityCount[s.city] = (cityCount[s.city] || 0) + 1; });
  const withPic = shops.filter((s) => s.img);

  root.appendChild(el(
    '<div><section class="hero"><h1>🍜 臺灣美食探險家</h1>' +
    '<p class="lead zy">交通部觀光署公開的 <b data-count></b> 間餐飲店家，可以找、可以逛地圖，也可以玩遊戲學認識台灣各地的美食。</p>' +
    '<form id="hq" class="searchbar" role="search"><input id="hq-q" type="search" maxlength="40" placeholder="想吃什麼？例如：牛肉麵、肉圓、咖啡" aria-label="搜尋店名">' +
    '<button class="btn primary" type="submit">找美食</button></form></section>' +
    '<section><h2>你是？</h2><div class="cards">' +
    '<a class="tool" href="/explore"><div class="ico">🧳</div><h3>我是旅客</h3><p>依縣市和類型找店，看營業時間，一鍵導航。</p><span class="tag">找美食</span></a>' +
    '<a class="tool" href="/play"><div class="ico">🎒</div><h3 class="zy zy-always">我是學生</h3><p>看照片猜類型、猜縣市，邊玩邊認識台灣的美食。</p><span class="tag">闖關遊戲</span></a>' +
    '<a class="tool" href="/teacher"><div class="ico">🍎</div><h3>我是老師</h3><p>產生班級連結和 QR 碼，全班平板一掃就開始。</p><span class="tag">教師專區</span></a>' +
    "</div></section>" +
    '<section><h2>各縣市看看</h2><div class="chips" id="h-cities"></div><p><small>只列出觀光署資料裡有店的縣市；臺北市、金門縣目前沒有資料。</small></p></section>' +
    '<section><h2>想吃哪一類</h2><div class="chips" id="h-groups"></div></section>' +
    '<section><h2>隨機推薦</h2><div class="grid" id="h-pick"></div><p><button class="btn" id="h-again" type="button">🎲 換一批</button></p></section></div>'
  ));
  root.querySelector("[data-count]").textContent = shops.length; // boot 填 data-count 時這段還沒畫出來，要自己填
  root.querySelector("#hq").onsubmit = (e) => {
    e.preventDefault();
    const q = root.querySelector("#hq-q").value.trim();
    location.href = "/explore" + (q ? "#q=" + encodeURIComponent(q) : "");
  };
  root.querySelector("#h-cities").append(...Food.CITY_ORDER.filter((c) => cityCount[c]).map((c) =>
    el('<a class="chip" href="/explore#city=' + encodeURIComponent(c) + '">' + esc(c) + " " + cityCount[c] + "</a>")));
  root.querySelector("#h-groups").append(...Food.GROUPS.map((g) =>
    el('<a class="chip" href="/explore#g=' + g.id + '">' + esc(g.emoji + " " + g.name) + "</a>")));
  const box = root.querySelector("#h-pick");
  const draw = () => {
    box.replaceChildren(...pick(withPic, 6).map((s) => {
      const a = el('<a class="acard" href="/shop#' + encodeURIComponent(s.id) + '"><div class="pic"></div><div class="info"><b>' + esc(s.name) + "</b><br><small>" +
        esc(s.group.emoji + " " + s.group.name) + "<br>" + esc(s.place) + "</small></div></a>");
      a.querySelector(".pic").appendChild(Food.photo(s));
      return a;
    }));
  };
  root.querySelector("#h-again").onclick = draw;
  draw();
});

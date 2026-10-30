/* 找美食：縣市＋類型＋關鍵字＋有照片，網址 #city=…&g=…&q=… 可分享。一次畫 48 間，按「看更多」再加。 */
Food.boot(function (shops) {
  const { esc, el } = Food;
  const root = document.getElementById("root");
  const PAGE = 48;
  const st = { city: "", g: "", q: "", pic: false };
  // 從網址讀篩選條件（第一次進來、以及同一頁改網址或按上一頁時都要讀）
  function readHash() {
    const p0 = Food.hashParams();
    st.city = Food.CITY_ORDER.includes(p0.city) ? p0.city : "";
    st.g = Food.GROUP_BY_ID[p0.g] ? p0.g : "";
    st.q = (p0.q || "").slice(0, 40);
    st.pic = p0.pic === "1";
  }
  readHash();

  const cityCount = {};
  shops.forEach((s) => { cityCount[s.city] = (cityCount[s.city] || 0) + 1; });
  const cities = Food.CITY_ORDER.filter((c) => cityCount[c]);

  root.appendChild(el(
    '<div><div class="filters">' +
    '<div class="chips"><span class="lab">縣市</span><select id="f-city" aria-label="選縣市"><option value="">全部縣市（' + shops.length + " 間）</option>" +
    cities.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "（" + cityCount[c] + "）</option>").join("") + "</select></div>" +
    '<div class="chips" id="f-g"><span class="lab">類型</span></div>' +
    '<div class="chips"><span class="lab">找店名</span><input id="f-q" type="search" placeholder="例如：牛肉麵、老街、咖啡" maxlength="40" aria-label="找店名或地址">' +
    '<label style="margin-left:8px"><input type="checkbox" id="f-pic"> 只看有照片的</label></div></div>' +
    '<p id="f-info" class="lead" role="status" aria-live="polite"></p><div class="grid" id="list"></div><p id="more-box" style="text-align:center"></p></div>'
  ));
  const gbox = root.querySelector("#f-g");
  const chip = (id, label) => {
    const b = el('<button class="chip" type="button" aria-pressed="false">' + esc(label) + "</button>");
    b.dataset.id = id;
    b.onclick = () => { st.g = st.g === id ? "" : id; sync(); draw(true); };
    gbox.appendChild(b);
  };
  Food.GROUPS.forEach((g) => chip(g.id, g.emoji + " " + g.name));
  const $city = root.querySelector("#f-city"), $q = root.querySelector("#f-q"), $pic = root.querySelector("#f-pic");
  $city.value = st.city; $q.value = st.q; $pic.checked = st.pic;
  $city.onchange = () => { st.city = $city.value; sync(); draw(true); };
  let timer;
  $q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { st.q = $q.value.trim(); sync(); draw(true); }, 250); };
  $pic.onchange = () => { st.pic = $pic.checked; sync(); draw(true); };

  function sync() {
    gbox.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === st.g)));
    const p = new URLSearchParams();
    if (st.city) p.set("city", st.city);
    if (st.g) p.set("g", st.g);
    if (st.q) p.set("q", st.q);
    if (st.pic) p.set("pic", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "#" + p : ""));
  }

  let shown = 0, list = [];
  const $list = root.querySelector("#list"), $info = root.querySelector("#f-info"), $more = root.querySelector("#more-box");
  function card(s) {
    const a = el('<a class="acard" href="/shop#' + encodeURIComponent(s.id) + '"><div class="pic"></div><div class="info"><b>' + esc(s.name) + "</b><br><small>" +
      esc(s.group.emoji + " " + s.group.name) + "<br>" + esc(s.place) + "</small></div></a>");
    a.querySelector(".pic").appendChild(Food.photo(s));
    return a;
  }
  function more() {
    const frag = document.createDocumentFragment();
    list.slice(shown, shown + PAGE).forEach((s) => frag.appendChild(card(s)));
    shown = Math.min(list.length, shown + PAGE);
    $list.appendChild(frag);
    $more.replaceChildren();
    if (shown < list.length) {
      const b = el('<button class="btn big" type="button">看更多（還有 ' + (list.length - shown) + " 間）</button>");
      b.onclick = more;
      $more.appendChild(b);
    }
  }
  function draw() {
    const q = st.q.toLowerCase();
    list = shops.filter((s) => (!st.city || s.city === st.city) && (!st.g || s.grp === st.g) && (!st.pic || s.img) &&
      (!q || (s.name + s.city + s.town).toLowerCase().includes(q)));
    shown = 0;
    $list.replaceChildren();
    const few = st.city && cityCount[st.city] < Food.FEW ? "　※ " + st.city + "在觀光署的資料裡只有 " + cityCount[st.city] + " 間，不代表當地只有這些店。" : "";
    $info.textContent = list.length ? "找到 " + list.length + " 間店。" + few : "沒有找到，換個條件試試看。";
    more();
  }
  sync();
  draw();
  // 同一頁改網址（上一頁、貼新連結）：重讀條件。sync() 用 replaceState 改網址，不會觸發這個事件
  window.addEventListener("hashchange", () => {
    readHash();
    $city.value = st.city; $q.value = st.q; $pic.checked = st.pic;
    sync();
    draw();
  });
});

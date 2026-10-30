/* 美食地圖：Leaflet（本站自帶，js/vendor/leaflet）＋ OpenStreetMap 圖磚。
   店家用小圓點（canvas 畫，4500 個也不卡），顏色是類型；點圓點看店名與連結。
   「找我附近」要使用者按了才問定位，位置只在這個頁面算距離，不送出去也不存。 */
Food.boot(function (shops) {
  const { esc, el } = Food;
  const root = document.getElementById("root");
  const withPos = shops.filter((s) => s.hasMap);
  const cities = Food.CITY_ORDER.filter((c) => withPos.some((s) => s.city === c));
  const st = { city: "", g: "" };

  root.appendChild(el(
    '<div><div class="filters"><div class="chips"><span class="lab">縣市</span><select id="m-city" aria-label="選縣市"><option value="">全台灣</option>' +
    cities.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>").join("") + "</select>" +
    '<button class="btn" type="button" id="m-near">📍 找我附近</button></div><div class="chips" id="m-g"><span class="lab">類型</span></div></div>' +
    '<p id="m-info" class="lead" role="status" aria-live="polite"></p><div id="map" class="map" role="application" aria-label="美食地圖"></div>' +
    '<div id="m-near-list"></div><p><small>地圖：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 貢獻者。圓點位置由資料提供單位填寫，可能有偏差。</small></p></div>'
  ));

  const map = L.map("map", { preferCanvas: true, minZoom: 6 }).setView([23.7, 121], 8);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const $info = root.querySelector("#m-info");

  function draw(fit) {
    layer.clearLayers();
    const list = withPos.filter((s) => (!st.city || s.city === st.city) && (!st.g || s.grp === st.g));
    const pts = [];
    list.forEach((s) => {
      const m = L.circleMarker([s.lat, s.lon], { radius: 6, color: "#fff", weight: 1.5, fillColor: s.group.color, fillOpacity: 0.9 });
      m.bindPopup(() => '<b>' + esc(s.name) + "</b><br>" + esc(s.group.emoji + " " + s.group.name) + "<br>" + esc(s.place) +
        '<br><a href="/shop#' + encodeURIComponent(s.id) + '">看這間店 ➜</a>');
      m.addTo(layer);
      pts.push([s.lat, s.lon]);
    });
    $info.textContent = "地圖上有 " + list.length + " 間店。" + (shops.length > withPos.length ? "（有 " + (shops.length - withPos.length) + " 間沒有座標，不在地圖上）" : "");
    if (fit && pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
  }

  const gbox = root.querySelector("#m-g");
  Food.GROUPS.forEach((g) => {
    const b = el('<button class="chip" type="button" aria-pressed="false">' + esc(g.emoji + " " + g.name) + "</button>");
    b.onclick = () => {
      st.g = st.g === g.id ? "" : g.id;
      gbox.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b && st.g === g.id)));
      draw(false);
    };
    gbox.appendChild(b);
  });
  root.querySelector("#m-city").onchange = (e) => { st.city = e.target.value; draw(true); };

  // 找我附近：直線距離最近的 8 間（不是走路距離）
  const km = (a, b, c, d) => {
    const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
    const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  const $nl = root.querySelector("#m-near-list");
  root.querySelector("#m-near").onclick = () => {
    if (!navigator.geolocation) return Food.dialog("這個瀏覽器不能定位，請改用縣市篩選。");
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: la, longitude: lo } = pos.coords;
      const near = withPos.map((s) => ({ s, d: km(la, lo, s.lat, s.lon) })).sort((a, b) => a.d - b.d).slice(0, 8);
      map.setView([la, lo], 14);
      L.circleMarker([la, lo], { radius: 9, color: "#fff", weight: 3, fillColor: "#3a8fd9", fillOpacity: 1 }).addTo(map).bindPopup("你在這裡");
      $nl.replaceChildren(el('<div class="panel"><h3 style="margin-top:0">離你最近的 8 間</h3><ol>' + near.map((n) =>
        '<li><a href="/shop#' + encodeURIComponent(n.s.id) + '">' + esc(n.s.name) + "</a>　" + (n.d < 1 ? Math.round(n.d * 1000) + " 公尺" : n.d.toFixed(1) + " 公里") + "</li>").join("") +
        (near[0].d > 30 ? "</ol><p><small>最近的店也在 " + Math.round(near[0].d) + " 公里外，觀光署的資料在你附近可能沒有收錄。</small></p>" : "</ol>") + "</div>"));
    }, () => Food.dialog("沒有取得位置。請允許瀏覽器使用定位，或改用縣市篩選。"), { timeout: 10000 });
  };

  draw(false);
  // 從店家頁來：#shop=編號，直接飛到那間店並打開說明
  const target = Food.hashParams().shop;
  const t = target && withPos.find((s) => s.id === target);
  if (t) {
    map.setView([t.lat, t.lon], 16);
    L.popup().setLatLng([t.lat, t.lon]).setContent("<b>" + esc(t.name) + '</b><br><a href="/shop#' + encodeURIComponent(t.id) + '">看這間店 ➜</a>').openOn(map);
  }
});

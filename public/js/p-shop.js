/* 店家詳細頁：網址 /shop#店家編號。資料點進來才抓（列表不帶說明、營業時間）。
   欄位來源是縣市政府填的，常常是空的：有才顯示，不留空欄位。 */
Food.boot(async function (shops) {
  const { esc, el } = Food;
  const root = document.getElementById("root");
  const id = decodeURIComponent(location.hash.slice(1));
  window.addEventListener("hashchange", () => location.reload()); // 同一頁換成別間店（上一頁、貼新連結）就重畫
  const DAYS = { Monday: "一", Tuesday: "二", Wednesday: "三", Thursday: "四", Friday: "五", Saturday: "六", Sunday: "日" };
  const fail = (msg) => root.replaceChildren(el('<div class="panel"><p>' + msg + '</p><p><a class="btn primary" href="/explore">回找美食</a></p></div>'));
  if (!id) return fail("沒有指定要看哪一間店。");
  let s;
  try { s = await Food.loadShop(id); } catch (e) { return fail("店家資料載入失敗，請檢查網路後再試。"); }
  if (!s) return fail("找不到這間店，它可能已經不在資料裡了。");
  document.title = s.name + "｜臺灣美食探險家";
  Progress.seen(s.id);

  const rows = [];
  const row = (label, html) => { if (html) rows.push("<tr><th>" + label + "</th><td>" + html + "</td></tr>"); };
  row("地址", esc((s.zip ? s.zip + " " : "") + s.city + s.town + s.street));
  row("電話", s.tel ? '<a href="tel:' + esc(s.tel.replace(/[^\d+#]/g, "")) + '">' + esc(s.tel) + "</a>" : "");
  const times = (s.times || []).filter((t) => t.start && t.end).map((t) =>
    esc((t.name ? t.name + "　" : "") + (t.days.length === 7 ? "每天" : "週" + t.days.map((d) => DAYS[d] || "").join("、")) + " " + t.start + "～" + t.end));
  row("營業時間", times.length ? times.join("<br>") : esc(s.time_info));
  row("交通", esc(s.traffic));
  row("停車", esc(s.parking));
  const site = Food.safeUrl(s.website);
  row("官方網站", site ? '<a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">' + esc(site) + "</a>" : "");

  const page = el(
    '<div class="shop"><p><a href="/explore">← 回找美食</a></p><h2 style="margin:.2em 0">' + esc(s.name) + "</h2>" +
    '<p><span class="badge" style="background:' + s.group.color + '">' + esc(s.group.emoji + " " + s.group.name) + "</span> " + esc(s.place) + "</p>" +
    '<div class="gallery" id="gal"></div>' +
    (s.description ? '<p class="lead" style="white-space:pre-line">' + esc(s.description) + "</p>" : "") +
    (rows.length ? '<table class="info-table">' + rows.join("") + "</table>" : "") +
    '<p><a class="btn primary big" href="' + esc(Food.mapLink(s)) + '" target="_blank" rel="noopener noreferrer">在 Google 地圖開啟 / 導航</a> ' +
    (s.hasMap ? '<a class="btn big" href="/map#shop=' + encodeURIComponent(s.id) + '">看本站地圖</a>' : "") + "</p>" +
    '<p><small>資料來源：交通部觀光署，由縣市政府或業者提供，營業時間與電話可能已經變動，出門前建議先打電話確認。' +
    (s.images && s.images.length ? "照片由資料提供單位提供。" : "") + "資料有誤請向觀光署回報，見<a href=\"/about\">資料說明</a>。</small></p></div>"
  );
  const gal = page.querySelector("#gal");
  (s.images && s.images.length ? s.images : [null]).forEach((_, i) => gal.appendChild(Food.photo(s, i, "xl")));
  root.appendChild(page);
});

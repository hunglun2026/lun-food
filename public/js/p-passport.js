/* 美食護照：看過哪些店、各遊戲的星星、徽章。只存在這台裝置的 localStorage，不上傳。 */
Food.boot(async function (shops) {
  const { esc, el } = Food;
  const root = document.getElementById("root");
  const draw = () => {
    const p = Progress.get();
    const seen = shops.filter((s) => p.seen[s.id]).sort((a, b) => p.seen[b.id] - p.seen[a.id]);
    const badges = Progress.badges(shops);
    root.replaceChildren(el(
      '<div><section><h2>徽章（' + badges.filter((b) => b.got).length + " / " + badges.length + "）</h2><div class=\"cards\">" +
      badges.map((b) => '<div class="tool" style="' + (b.got ? "" : "opacity:.45") + '"><div class="ico">' + b.icon + "</div><h3>" + esc(b.name) + "</h3><p>" + esc(b.how) + "</p><span class=\"tag\">" + (b.got ? "已拿到" : "還沒拿到") + "</span></div>").join("") +
      "</div></section>" +
      '<section><h2>遊戲星星</h2><div class="panel"><ul class="plain">' +
      Progress.GAMES.map(([k, name]) => "<li>" + esc(name) + "：" + "⭐".repeat(p.stars[k] || 0) + "☆".repeat(3 - (p.stars[k] || 0)) + "</li>").join("") + "</ul></div></section>" +
      "<section><h2>看過的店（" + seen.length + "）</h2>" + (seen.length ? '<div class="grid" id="pp-seen"></div>' : '<p class="lead">還沒有。到<a href="/explore">找美食</a>點開一間店，就會蓋一個章。</p>') + "</section>" +
      '<p><button class="btn danger" id="pp-clear" type="button">清除這台裝置的紀錄</button></p></div>'
    ));
    const g = root.querySelector("#pp-seen");
    if (g) seen.slice(0, 60).forEach((s) => {
      const a = el('<a class="acard" href="/shop#' + encodeURIComponent(s.id) + '"><div class="pic"></div><div class="info"><b>' + esc(s.name) + "</b><br><small>" + esc(s.place) + "</small></div></a>");
      a.querySelector(".pic").appendChild(Food.photo(s));
      g.appendChild(a);
    });
    root.querySelector("#pp-clear").onclick = async () => {
      if (await Food.dialog("要清除護照嗎？看過的店、星星、徽章都會不見，不能復原。", [{ label: "清除", value: true, danger: true }, { label: "取消", value: false, primary: true }])) { Progress.clear(); draw(); }
    };
  };
  draw();
});

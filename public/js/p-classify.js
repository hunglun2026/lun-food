/* 分類小達人：看照片和店名，選出這間店是哪一類。入門 3 類、挑戰 6 類、60 秒挑戰。
   有真實照片的店集中在「台灣小吃」，所以每一類平均出題，不然題目會一直是小吃。 */
Food.boot(async function (shops) {
  const { esc, el, shuffle } = Food;
  const root = document.getElementById("root");
  const G = (id) => Food.GROUP_BY_ID[id];
  const MODES = {
    easy: { name: "入門（3 類）", groups: ["snack", "chinese", "west"] },
    hard: { name: "挑戰（6 類）", groups: ["snack", "chinese", "west", "dessert", "souvenir", "grill"] },
  };
  const pool = shops.filter((s) => s.img);

  function menu() {
    root.replaceChildren(el(
      '<div class="panel"><p class="lead zy" style="margin-top:0">看照片和店名，選出這間店是哪一類。一共 10 題。</p>' +
      '<p><button class="btn primary big zy" data-m="easy">入門（三類）</button> <small>台灣小吃、中式港式、西式異國</small></p>' +
      '<p><button class="btn big zy" data-m="hard">挑戰（六類）</button> <small>再加甜點麵包、伴手禮特產、燒烤火鍋海鮮</small></p>' +
      '<p><button class="btn big zy" data-m="easy" data-t="1">⏱️ 60 秒挑戰</button> <small>入門三類，答越多越好</small></p>' +
      "<details><summary>這些類型怎麼分？</summary><ul>" +
      MODES.hard.groups.map((id) => "<li>" + G(id).emoji + " <b>" + esc(G(id).name) + "</b>：" + esc(G(id).hint) + "</li>").join("") +
      "</ul><p><small>類型依觀光署資料裡的「餐飲類別代碼」，一間店可能有好幾種，這裡取最主要的一種。</small></p></details></div>"
    ));
    root.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => play(b.dataset.m, !!b.dataset.t)));
  }

  // timed：60 秒挑戰，多準備 40 題讓手快的學生答不完
  async function play(mode, timed) {
    root.replaceChildren(el('<div class="loading">正在挑照片…📷</div>'));
    const n = timed ? 40 : 10;
    const ids = MODES[mode].groups;
    // 每一類輪流抽，湊成 n 題；候選多抽一些，壞圖的會被換掉
    const lists = ids.map((id) => shuffle(pool.filter((s) => s.grp === id)));
    const cand = [];
    for (let k = 0; cand.length < n * 2 && lists.some((l) => k < l.length); k++) lists.forEach((l) => l[k] && cand.push(l[k]));
    const ok = await Food.usablePhotos(cand, n);
    if (ok.length < 3) { root.replaceChildren(el('<p class="err">照片暫時載入不了，請稍後再試。<br><button class="btn" onclick="location.reload()">重新整理</button></p>')); return; }
    const rounds = shuffle(ok).map((s) => ({
      shop: s,
      prompt: "<b>" + esc(s.name) + "</b> 是哪一類的店？",
      options: ids.map((id) => ({ id, label: G(id).emoji + " " + G(id).name })),
      answer: s.grp,
      explain: esc(s.name) + "是" + esc(s.group.name) + "：" + esc(s.group.hint) + "。",
    }));
    Quiz.run(root, { key: "classify-" + mode + (timed ? "-timed" : ""), title: timed ? "60 秒分類挑戰" : "分類小達人", rounds, onAgain: menu, timed: timed ? 60 : 0, guide: "classify" });
  }
  // 首頁推薦卡與老師的班級連結會帶 #m=easy／hard／timed，直接開局不經過選單
  const direct = Food.hashParams().m;
  if (direct === "timed") play("easy", true);
  else if (MODES[direct]) play(direct, false);
  else menu();
});

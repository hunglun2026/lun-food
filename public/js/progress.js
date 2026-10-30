/* 美食護照的紀錄：看過哪些店、各遊戲最好幾顆星、徽章。只存在這台裝置的 localStorage，不上傳、不蒐集個資。
   Progress.seen(id)、Progress.stars(key, n)、Progress.badges(shops)、Progress.get()、Progress.clear() */
window.Progress = (function () {
  "use strict";
  const KEY = "food-progress-v1";
  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.seen) return s;
    } catch (e) { /* 無痕模式 */ }
    return { seen: {}, stars: {} };
  }
  function update(fn) {
    const s = get();
    fn(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了，不影響遊戲 */ }
  }
  const seen = (id) => update((s) => { s.seen[id] = s.seen[id] || Date.now(); });
  const stars = (key, n) => update((s) => { s.stars[key] = Math.max(s.stars[key] || 0, n); });
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } };

  // 各遊戲在護照上顯示的名字（key 要跟各遊戲存星數用的一樣）
  const GAMES = [
    ["classify-easy", "分類小達人・入門"], ["classify-hard", "分類小達人・挑戰"], ["classify-easy-timed", "分類小達人・60 秒"],
    ["guess-easy", "猜縣市美食・入門"], ["guess-hard", "猜縣市美食・挑戰"], ["guess-easy-timed", "猜縣市美食・60 秒"],
  ];

  // 徽章：有沒有拿到全部從紀錄算出來，不另外存，規則改了舊紀錄也會跟著對
  function badges(shops) {
    const s = get();
    const seenS = shops.filter((a) => s.seen[a.id]);
    const st = (k) => s.stars[k] || 0;
    const cities = new Set(seenS.map((a) => a.city));
    const list = [
      ["👣", "第一口", "在「找美食」看第 1 間店", seenS.length >= 1],
      ["📖", "美食通", "看過 30 間店", seenS.length >= 30],
      ["🧩", "口味大雜燴", "七種以上的類型都至少看過一間", Food.GROUPS.filter((g) => seenS.some((a) => a.grp === g.id)).length >= 7],
      ["🚄", "環島美食客", "看過 5 個縣市的店", cities.size >= 5],
      ["🏆", "分類高手", "分類小達人挑戰拿到三顆星", st("classify-hard") >= 3],
      ["🗺️", "縣市達人", "猜縣市美食挑戰拿到三顆星", st("guess-hard") >= 3],
      ["⚡", "閃電快手", "任一個 60 秒挑戰拿到三顆星", st("classify-easy-timed") >= 3 || st("guess-easy-timed") >= 3],
    ];
    return list.map(([icon, name, how, got]) => ({ icon, name, how, got }));
  }
  return { get, seen, stars, clear, badges, GAMES };
})();

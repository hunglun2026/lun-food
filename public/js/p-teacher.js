/* 教師專區：目前只有「班級連結」（選遊戲與年級，產生網址與 QR 碼）。
   搶答計分板、學習單等等主線穩了再加，不先做。 */
Food.boot(function () {
  const root = document.getElementById("root");
  ClassLink.init(root);
});

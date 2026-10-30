/* 新手提示：小手指著下一步要按的地方，等學生自己按。
   只指路，不替學生按、不碰計分與護照；看過的記在這台裝置（food-guide-seen），之後不再出現。
   畫面上兩樣東西：目標上的橘框＋小手（跟著目標走），和頁首下方一條文字提示（不蓋到遊戲內容）。
   Guide.tour(key)：看過了或被關掉回 null，否則回 { say(元素, 提示字), end(元素, 提示字), done(), stop() }
     say：指向某個元素；學生碰螢幕就讓開，下一步由遊戲再呼叫 say。end：最後一句，顯示後記成看過。
     done：學生照提示做完了，記成看過並收起來。stop：只收起來，不記（離開畫面、換遊戲用）。
   Guide.reset()：清掉看過的（老師的班級連結 fresh=1、換班用）；Guide.setOff(true)：整個關掉（班級連結 guide=off） */
window.Guide = (function () {
  "use strict";
  const SEEN = "food-guide-seen", OFF = "food-guide-off";
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 無痕模式存不了就算了，提示下次再出現，不影響遊戲
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 忽略 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } },
  };
  const seenMap = () => { try { return JSON.parse(store.get(SEEN) || "{}") || {}; } catch (e) { return {}; } };
  const isOff = () => store.get(OFF) === "1";
  const seen = (key) => isOff() || !!seenMap()[key];
  const mark = (key) => { const m = seenMap(); m[key] = 1; store.set(SEEN, JSON.stringify(m)); };
  const reset = () => store.del(SEEN);
  const setOff = (on) => (on ? store.set(OFF, "1") : store.del(OFF));

  let active = null; // 同一時間只有一個提示在跑

  function tour(key) {
    if (seen(key)) return null;
    if (active) active.stop();
    let box = null, hand = null, bar = null, target = null, raf = 0, dead = false, timer = 0;

    function hide() {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onTap, true);
      if (target) target.classList.remove("g-on");
      if (box) box.remove();
      box = hand = bar = target = null;
    }
    // 學生自己動手了：提示讓開（點到「略過」另外處理）。pointerdown 比 click 早，遊戲在 click 裡再呼叫 say 就會出現下一步
    function onTap(e) { if (!(e.target.closest && e.target.closest(".guide"))) hide(); }

    // 每一格畫面跟著目標元素的位置走（捲動、換版面、圖片載入後位移都跟得上）；目標被遊戲換掉就收起來
    function place() {
      if (!box) return;
      if (!target || !target.isConnected) { hide(); return; }
      const r = target.getBoundingClientRect();
      const below = r.bottom + 60 < innerHeight; // 下面放得下就指向目標下緣，否則從上方指下來
      hand.textContent = below ? "👆" : "👇";
      hand.classList.toggle("up", !below);
      // 小目標（一張牌、一顆按鈕）：小手指在下緣中間。大目標（一整組選項）：放在右下角的空白處，不壓到選項的字
      const big = r.height > 120;
      const x = big ? r.right - 40 : r.left + r.width / 2;
      const inset = big ? 56 : 20;
      hand.style.left = Math.min(Math.max(x, 30), innerWidth - 30) + "px";
      hand.style.top = (below ? r.bottom - inset : r.top + inset) + "px";
      // 文字條固定在頁首下面；頁首捲走了就貼在最上面
      const head = document.querySelector("header.top");
      bar.style.top = Math.max(head ? head.getBoundingClientRect().bottom + 8 : 8, 8) + "px";
      raf = requestAnimationFrame(place);
    }

    function show(el, text) {
      hide();
      if (!el || !el.isConnected) return;
      target = el;
      el.classList.add("g-on");
      box = document.createElement("div");
      box.className = "guide noprint";
      box.setAttribute("role", "status");
      box.innerHTML = '<span class="g-hand" aria-hidden="true"></span><div class="g-bar"><span class="g-tip zy"></span><button type="button" class="g-skip">略過</button></div>';
      hand = box.querySelector(".g-hand");
      bar = box.querySelector(".g-bar");
      box.querySelector(".g-tip").textContent = text;
      box.querySelector(".g-skip").onclick = () => { mark(key); api.stop(); };
      document.body.appendChild(box);
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      document.addEventListener("pointerdown", onTap, true);
      raf = requestAnimationFrame(place);
    }

    const api = {
      say(el, text) { if (!dead) show(el, text); },
      end(el, text) {
        if (dead) return;
        dead = true;
        mark(key);
        show(el, text);
        timer = setTimeout(hide, 2200);
      },
      // 學生照著提示做完了（例如按了「下一題」）：記成看過並收起來
      done() { if (!dead) mark(key); api.stop(); },
      stop() { dead = true; hide(); if (active === api) active = null; },
    };
    active = api;
    return api;
  }

  // 老師的班級連結：#grade=low&fresh=1&guide=off（可再帶 m=easy 直接開遊戲）。
  // grade 只收 low／mid／high，其他值一律忽略；fresh=1 清掉看過的提示（換班）；guide=off／on 關掉／打開提示。
  // 套用完把這三個參數從網址拿掉：重新整理不會又清一次，學生把網址收藏起來帶回家，也不會一直套用課堂的設定
  function applyClassLink() {
    if (!window.Food || !Food.hashParams) return;
    const p = Food.hashParams();
    if (!("grade" in p || "fresh" in p || "guide" in p)) return;
    if (["low", "mid", "high"].includes(p.grade)) Food.setGrade(p.grade);
    if (p.fresh === "1") reset();
    if (p.guide === "off") setOff(true);
    else if (p.guide === "on") setOff(false);
    const rest = new URLSearchParams(location.hash.slice(1));
    ["grade", "fresh", "guide"].forEach((k) => rest.delete(k));
    history.replaceState(null, "", location.pathname + location.search + (rest.toString() ? "#" + rest : ""));
  }
  applyClassLink();

  return { tour, seen, mark, reset, setOff };
})();

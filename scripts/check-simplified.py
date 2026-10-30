"""掃簡體字：網站程式與頁面（來源資料只回報）。有問題離場碼 1。
判斷方式：用 zhconv 逐字轉成繁體，跟原字不同就是簡體字（不手寫字表，避免誤列兩岸共用字）。
「一簡對多繁」但繁體本來合法的字放白名單。需要：pip install zhconv"""
import sys
from pathlib import Path

from zhconv import convert

ROOT = Path(__file__).resolve().parent.parent
ALWAYS_OK = set("准划占栗虱郁台里后干范")  # 核准、划算、占用、苗栗、虱目魚、濃郁、台、里、后、干、范


def in_big5(ch: str) -> bool:
    try:
        ch.encode("cp950")
        return True
    except UnicodeEncodeError:
        return False


def bad_chars(text: str) -> dict:
    """zhconv 說不同、而且不在台灣用的 Big5 字集裡，才算簡體字。
    只靠 zhconv 會把岩、游、泄、祕、污、凶、苧…這些繁體本來就合法的一簡對多繁字誤報。"""
    out = {}
    for ch in set(text):
        if ord(ch) > 0x2E80 and ch not in ALWAYS_OK and convert(ch, "zh-tw") != ch and not in_big5(ch):
            out[ch] = convert(ch, "zh-tw")
    return out


def main() -> int:
    """網站自己的檔案有簡體字就失敗；觀光署原始資料裡的簡體字只回報（那是來源的原文，店名多是專有名詞，不能擅自改）。"""
    bad = 0
    for p in (ROOT / "public").rglob("*"):
        if p.suffix in (".html", ".js", ".css", ".ts") and "vendor" not in p.parts:
            b = bad_chars(p.read_text(encoding="utf-8"))
            if b:
                bad += 1
                print(f"[簡體] {p.relative_to(ROOT)}: {b}")
    for p in (ROOT / "src").glob("*.ts"):
        b = bad_chars(p.read_text(encoding="utf-8"))
        if b:
            bad += 1
            print(f"[簡體] {p.relative_to(ROOT)}: {b}")
    # 來源資料：只回報，不算失敗
    import json
    import zipfile
    fx = ROOT / "scripts" / "fixtures" / "Restaurant-json.zip"
    if fx.exists():
        with zipfile.ZipFile(fx) as z:
            shops = json.loads(z.read("RestaurantList.json").decode("utf-8-sig"))["Restaurants"]
        hit = [r["RestaurantName"] for r in shops if bad_chars(json.dumps(r, ensure_ascii=False))]
        print(f"（來源資料有 {len(hit)} 間店含簡體字，照原文顯示，不算錯誤。例：{hit[:3]}）")
    print("網站檔案沒有發現簡體字" if not bad else f"共 {bad} 個檔案需要看")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

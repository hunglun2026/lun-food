"""把 Gemini 生的類型示意圖（寫實美食照）轉成網站用的 public/img/group/<大類>.webp。

做什麼：裁掉底部 90 像素（去浮水印後可能留下修補殘影，zoo 也是這樣處理）、縮成寬 800、轉 webp。
來源資料夾：D:\\steve0904\\logo專區\\lun-food\\<大類>.png（圖片一律放 logo專區，不進專案）。
用法：python scripts/build-group-images.py [來源資料夾]
換圖後要升 data.js 裡 /img/group/…?v=N 的 N（圖會被快取一年）。
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "img" / "group"
IDS = ["snack", "chinese", "asian", "west", "grill", "noodle", "dessert", "drink", "souvenir", "veg", "other"]
CROP_BOTTOM = 90
WIDTH = 800


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\steve0904\logo專區\lun-food")
    OUT.mkdir(parents=True, exist_ok=True)
    miss = []
    for gid in IDS:
        f = src / f"{gid}.png"
        if not f.exists():
            miss.append(gid)
            continue
        im = Image.open(f).convert("RGB")
        im = im.crop((0, 0, im.width, im.height - CROP_BOTTOM))
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        im.save(OUT / f"{gid}.webp", "WEBP", quality=82, method=6)
        print(f"{gid}: {im.width}x{im.height}, {(OUT / f'{gid}.webp').stat().st_size // 1024} KB")
    if miss:
        print("缺圖：", " ".join(miss))
    return 1 if miss else 0


if __name__ == "__main__":
    sys.exit(main())

"""做縮圖：動物園原照片很大（271 種第一張加總 325 MB），卡片和遊戲改用本站的小縮圖。
每種動物依序試原照片第 1～4 張，都失效就用 img-fallback.json 的補圖；縮成寬 480px 的 webp。
輸出 public/img/thumbs/<id>.webp 與 public/js/thumbs.json（有縮圖的 id 清單）。
用法：python scripts/build-thumbs.py [--api 網址] [--force]
已存在的縮圖預設跳過、下架動物的縮圖會刪掉；資料更新後重跑一次即可。需要：pip install pillow"""
import argparse
import concurrent.futures as cf
import io
import json
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
OUT = PUB / "img" / "thumbs"
WIDTH, QUALITY = 480, 70
# 動物園網站的憑證缺中繼憑證，瀏覽器會自動補、Python 不會；只下載公開照片，略過驗證
CTX = ssl._create_unverified_context()


def fetch(url: str) -> bytes:
    u = urllib.parse.quote(url.replace("http://", "https://").strip(), safe=":/%?=&")
    last = None
    for wait in (0, 2, 4):  # 動物園主機偶爾逾時，退避重試
        time.sleep(wait)
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (zoo-thumbs)"})
            with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
                if "image" not in r.headers.get("Content-Type", ""):
                    raise ValueError("不是圖片")
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            if getattr(e, "code", 0) in (403, 404):
                break
    raise last


def shrink(raw: bytes, dest: Path) -> None:
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    if im.width > WIDTH:
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    im.save(dest, "WEBP", quality=QUALITY, method=6)


def one(a: dict, fallback: dict, force: bool) -> tuple[str, str]:
    dest = OUT / (a["id"] + ".webp")
    if dest.exists() and not force:
        return a["id"], "已存在"
    for i, p in enumerate(a["pics"]):
        try:
            shrink(fetch(p["url"]), dest)
            return a["id"], f"原照片第 {i + 1} 張"
        except Exception:  # noqa: BLE001
            continue
    fb = fallback.get(a["id"])
    if fb:
        shrink((PUB / fb["src"].lstrip("/")).read_bytes(), dest)
        return a["id"], "補圖"
    return a["id"], "失敗"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="https://zoo.hunglun.com/api/animals")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    animals = json.loads(fetch_api(args.api))["animals"]
    fallback = json.loads((PUB / "js" / "img-fallback.json").read_text(encoding="utf-8"))
    with cf.ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda a: one(a, fallback, args.force), animals))
    bad = [i for i, s in res if s == "失敗"]
    for s in ("已存在", "原照片第 1 張", "原照片第 2 張", "原照片第 3 張", "原照片第 4 張", "補圖", "失敗"):
        n = sum(1 for _, x in res if x == s)
        if n:
            print(f"{s}：{n}")
    if bad:
        print("[WARN] 沒有縮圖：", ", ".join(bad))
    # 資料更新後下架或合併掉的動物（例：食蛇龜兩個學名合併）縮圖要清掉，不然清單會多出不存在的 id
    alive = {a["id"] for a in animals}
    for p in OUT.glob("*.webp"):
        if p.stem not in alive:
            p.unlink()
            print("刪掉已下架動物的縮圖：", p.name)
    ids = sorted(p.stem for p in OUT.glob("*.webp"))
    (PUB / "js" / "thumbs.json").write_text(json.dumps(ids, ensure_ascii=False), encoding="utf-8")
    total = sum(p.stat().st_size for p in OUT.glob("*.webp"))
    print(f"縮圖 {len(ids)} 張，共 {total / 2**20:.1f} MB")


def fetch_api(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "zoo-thumbs"}), timeout=60) as r:
        return r.read()


if __name__ == "__main__":
    main()

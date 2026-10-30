"""把 Worker food-explorer 的執行期密鑰（ADMIN_TOKEN、NTFY_TOPIC）寫進 Cloudflare（hunglun2026 帳號）。
要等第一次部署成功（Worker 存在）後才能跑。不印出任何值。

- ADMIN_TOKEN：第一次跑會產生一組隨機值存進 .prod.secrets（已 gitignore，備份進 ClaudeOnly）；之後重跑沿用。
- NTFY_TOPIC：沿用 lun-zoo 的主題，同一支手機訂閱就能收到美食站的失敗通知（通知標題不同）。
用法：python -X utf8 scripts/put-worker-secrets.py
"""
import json
import secrets
import urllib.request
from pathlib import Path

ST = "D:/ClaudeOnly/steve0802/"
ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / ".prod.secrets"
ZOO = ROOT.parent / "lun-zoo" / ".prod.secrets"
WORKER = "food-explorer"


def kv(fn, key):
    for l in open(ST + fn, encoding="utf-8"):
        if l.startswith(key + "="):
            return l.split("=", 1)[1].strip()
    raise SystemExit(f"{fn} 找不到 {key}")


def acc_id():
    for l in open(ST + "cf-account-ids.txt", encoding="utf-8"):
        if "hunglun2026" in l.lower() and not l.startswith("#"):
            return l.replace(":", "=").split("=")[-1].strip()
    raise SystemExit("找不到 hunglun2026 的 account id")


sec = json.loads(FILE.read_text(encoding="utf-8")) if FILE.exists() else {}
sec.setdefault("D1_ID", "b279f15d-0372-46f8-b968-ca3002471de0")
sec.setdefault("ADMIN_TOKEN", secrets.token_urlsafe(32))
if "NTFY_TOPIC" not in sec:
    sec["NTFY_TOPIC"] = json.loads(ZOO.read_text(encoding="utf-8"))["NTFY_TOPIC"]
FILE.write_text(json.dumps(sec, ensure_ascii=False, indent=1), encoding="utf-8")

cf, acc = kv("cf-tokens.txt", "hunglun2026"), acc_id()
for name in ("ADMIN_TOKEN", "NTFY_TOPIC"):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{acc}/workers/scripts/{WORKER}/secrets", method="PUT",
        headers={"Authorization": "Bearer " + cf, "Content-Type": "application/json"},
        data=json.dumps({"name": name, "text": sec[name], "type": "secret_text"}).encode())
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(name, "HTTP", r.status)
    except urllib.error.HTTPError as e:
        print(name, "失敗 HTTP", e.code, e.read()[:200].decode("utf-8", "ignore"))

"""把 CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID 加密後設成 hunglun2026/lun-food 的 Actions secrets。
憑證只在程序內，不印出值。"""
import base64
import json
import urllib.request
from pathlib import Path

from nacl import encoding, public

ROOT = r"D:/ClaudeOnly/steve0802/"


def kv(fn, key):
    for l in Path(ROOT + fn).read_text(encoding="utf-8").splitlines():
        if l.startswith(key + "="):
            return l.split("=", 1)[1].strip()
    raise SystemExit(f"{fn} 找不到 {key}")


def acc_id():
    for l in Path(ROOT + "cf-account-ids.txt").read_text(encoding="utf-8").splitlines():
        if "hunglun2026" in l.lower() and not l.startswith("#"):
            return l.replace(":", "=").split("=")[-1].strip()
    raise SystemExit("找不到 hunglun2026 的 account id")


gh = kv("gh-tokens.txt", "hunglun2026-workflow")
H = {"Authorization": "Bearer " + gh, "Accept": "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "lun-food-setup"}
API = "https://api.github.com/repos/hunglun2026/lun-food/actions/secrets"


def call(url, method="GET", body=None):
    req = urllib.request.Request(url, method=method, headers=H, data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read()
        return r.status, (json.loads(t) if t else {})


_, key = call(API + "/public-key")
pk = public.PublicKey(key["key"].encode(), encoding.Base64Encoder())
box = public.SealedBox(pk)
for name, value in (("CLOUDFLARE_API_TOKEN", kv("cf-tokens.txt", "hunglun2026")), ("CLOUDFLARE_ACCOUNT_ID", acc_id())):
    enc = base64.b64encode(box.encrypt(value.encode())).decode()
    status, _ = call(f"{API}/{name}", "PUT", {"encrypted_value": enc, "key_id": key["key_id"]})
    print(name, "HTTP", status, "(長度", len(value), ")")
_, lst = call(API)
print("目前 secrets：", [s["name"] for s in lst["secrets"]])

import type { Env } from "./env";
import { toRestaurants, type Restaurant } from "./restaurants";
import { unzip } from "./zip";
import { notifyError } from "./notify";

const META_URL = (id: string) => `https://data.gov.tw/api/v2/rest/dataset/${id}`;
const MIN_ROWS = 1000; // 低於這個筆數視為來源異常，保留舊資料（正常約 4600）
const CHUNK = 400;     // D1 一個 batch 不要塞太多句，分段匯入
// 來源伺服器卡住時不要無限等：逾時就當失敗，走 ntfy 通知
const get = (url: string) =>
  fetch(url, { headers: { "User-Agent": "Mozilla/5.0 food-explorer" }, signal: AbortSignal.timeout(30000) });

export interface SyncResult { status: "ok" | "skipped" | "error"; message: string; modified?: string; shops?: number }

async function log(env: Env, r: SyncResult, rows: number | null) {
  await env.DB.prepare(
    "INSERT INTO sync_log (ran_at, modified_date, status, row_count, shop_count, message) VALUES (?,?,?,?,?,?)",
  ).bind(new Date().toISOString(), r.modified ?? null, r.status, rows, r.shops ?? null, r.message).run();
}

const json = (bytes: Uint8Array) => JSON.parse(new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, ""));

// force=true：不管日期有沒有變都重匯入（手動補跑用）
export async function runSync(env: Env, force = false): Promise<SyncResult> {
  let rows: number | null = null;
  let res: SyncResult;
  try {
    const meta: any = await (await get(META_URL(env.DATASET_ID))).json();
    const r = meta.result ?? meta;
    const modified: string = r.modifiedDate;
    if (!modified) throw new Error("中繼資料沒有 modifiedDate，來源格式可能改版");
    const zipUrl: string | undefined = (r.distribution ?? []).find((d: any) => /json/i.test(d.resourceDownloadUrl ?? ""))?.resourceDownloadUrl;
    if (!zipUrl) throw new Error("中繼資料找不到 JSON 壓縮檔下載網址");

    const last = await env.DB.prepare("SELECT modified_date FROM sync_log WHERE status='ok' ORDER BY id DESC LIMIT 1").first<{ modified_date: string }>();
    if (!force && last?.modified_date === modified) {
      res = { status: "skipped", message: "資料沒有更新", modified };
      await log(env, res, null);
      return res;
    }

    const resp = await get(zipUrl);
    if (!resp.ok) throw new Error(`下載壓縮檔失敗：HTTP ${resp.status}`);
    const files = await unzip(await resp.arrayBuffer());
    const listBytes = files.get("RestaurantList.json");
    if (!listBytes) throw new Error("壓縮檔裡沒有 RestaurantList.json，來源可能改版");
    const list = json(listBytes).Restaurants;
    if (!Array.isArray(list)) throw new Error("RestaurantList.json 沒有 Restaurants 陣列，欄位可能改版");
    rows = list.length;
    if (rows < MIN_ROWS) throw new Error(`來源只有 ${rows} 筆（少於 ${MIN_ROWS}），疑似來源異常，已保留舊資料`);
    if (!("RestaurantName" in list[0]) || !("PositionLat" in list[0])) throw new Error("缺少 RestaurantName／PositionLat 欄位，欄位可能改版");

    // 營運時間是另一個檔，缺了不影響主流程
    const times = new Map<string, string>();
    const stBytes = files.get("RestaurantServiceTimeList.json");
    if (stBytes) {
      for (const t of json(stBytes).RestaurantServiceTimes ?? []) {
        times.set(t.RestaurantID, JSON.stringify((t.ServiceTimes ?? []).map((s: any) => ({
          name: s.Name ?? "", days: s.ServiceDays ?? [], start: (s.StartTime ?? "").slice(0, 5), end: (s.EndTime ?? "").slice(0, 5),
        }))));
      }
    }

    const shops = toRestaurants(list);
    await importShops(env, shops, times);
    res = { status: "ok", message: `匯入 ${shops.length} 間（來源 ${rows} 筆）`, modified, shops: shops.length };
    await log(env, res, rows);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res = { status: "error", message: msg };
    try { await log(env, res, rows); } catch { /* log 寫不進去也要繼續通知 */ }
    await notifyError(env, "臺灣美食探險家：資料同步失敗", msg);
    return res;
  }
}

const COLS = [
  "id", "name", "description", "lat", "lon", "cuisine", "grp", "city", "town", "zip", "street", "tel",
  "images", "time_info", "times", "traffic", "parking", "website", "features",
] as const;

// 分段 upsert，最後一段才把「這次沒出現」的店下架。
// 中途失敗只會留下一部分新資料，不會下架任何店，下次同步會補齊。
async function importShops(env: Env, shops: Restaurant[], times: Map<string, string>) {
  const now = new Date().toISOString();
  const sql =
    `INSERT INTO restaurants (${COLS.join(",")}, active, synced_at) VALUES (${COLS.map(() => "?").join(",")}, 1, ?) ` +
    `ON CONFLICT(id) DO UPDATE SET ${COLS.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",")}, active=1, synced_at=excluded.synced_at`;
  const bind = (s: Restaurant) => [
    s.id, s.name, s.description, s.lat, s.lon, JSON.stringify(s.cuisine), s.grp, s.city, s.town, s.zip, s.street, s.tel,
    JSON.stringify(s.images), s.time_info, times.get(s.id) ?? null, s.traffic, s.parking, s.website, JSON.stringify(s.features), now,
  ];
  for (let i = 0; i < shops.length; i += CHUNK) {
    await env.DB.batch(shops.slice(i, i + CHUNK).map((s) => env.DB.prepare(sql).bind(...bind(s))));
  }
  await env.DB.prepare("UPDATE restaurants SET active=0 WHERE synced_at <> ?").bind(now).run();
}

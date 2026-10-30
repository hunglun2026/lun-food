import type { Env } from "./env";

const json = (data: unknown, cache: string) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

// 邊緣快取：同一個機房的請求直接回存好的結果，不查 D1（D1 查一次要 0.3～1 秒）。
// 快取鍵帶 APP_VERSION（部署新版自動換新）與前端傳的 m（meta 的 syncedAt＝最後一次成功匯入時間），
// 同步（含手動強制同步）後前端拿到新的 syncedAt，抓資料時就是新的鍵，不會拿到舊資料卻當成新的存起來。
async function edge(url: URL, env: Env, ctx: ExecutionContext, cache: string, build: () => Promise<unknown>) {
  const key = new Request(`${url.origin}${url.pathname}?app=${encodeURIComponent(env.APP_VERSION)}&m=${encodeURIComponent(url.searchParams.get("m") ?? "")}&id=${encodeURIComponent(url.searchParams.get("id") ?? "")}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const res = json(await build(), cache);
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

export async function handleApi(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (url.pathname === "/api/meta") {
    // 瀏覽器 60 秒、機房 5 分鐘：同步完最晚 5 分鐘大家就會看到新日期
    return edge(url, env, ctx, "public, max-age=60, s-maxage=300", async () => {
      const last = await env.DB.prepare("SELECT modified_date, ran_at, shop_count FROM sync_log WHERE status='ok' ORDER BY id DESC LIMIT 1").first();
      const n = await env.DB.prepare("SELECT count(*) AS n FROM restaurants WHERE active=1").first<{ n: number }>();
      return { version: env.APP_VERSION, modifiedDate: last?.modified_date ?? null, syncedAt: last?.ran_at ?? null, count: n?.n ?? 0 };
    });
  }
  if (url.pathname === "/api/shops") {
    // 列表與地圖用的精簡版（約 4500 間，只放篩選、排序、畫地圖要用的欄位），詳細資料點進去再用 /api/shop 拿
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const { results } = await env.DB.prepare(
        "SELECT id, name, city, town, grp, lat, lon, images FROM restaurants WHERE active=1 ORDER BY city, town, name",
      ).all();
      return { shops: results.map((r: any) => { const img = JSON.parse(r.images || "[]")[0]; const { images, ...rest } = r; return img ? { ...rest, img: img.url } : rest; }) };
    });
  }
  if (url.pathname === "/api/clues") {
    // 猜縣市遊戲用：有簡介的店，只取前 90 字（前端再切到第一句並遮掉地名），其他頁面不載
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const { results } = await env.DB.prepare(
        "SELECT id, substr(description,1,90) AS t FROM restaurants WHERE active=1 AND length(description) >= 20 AND images <> '[]'",
      ).all();
      return { clues: results };
    });
  }
  if (url.pathname === "/api/shop") {
    const id = url.searchParams.get("id") ?? "";
    if (!/^[\w.-]{1,80}$/.test(id)) return json({ error: "bad id" }, "no-store");
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const r: any = await env.DB.prepare("SELECT * FROM restaurants WHERE id=? AND active=1").bind(id).first();
      if (!r) return { error: "not found" };
      for (const k of ["cuisine", "images", "times", "features"]) r[k] = JSON.parse(r[k] || "[]");
      return { shop: r };
    });
  }
  return json({ error: "not found" }, "no-store");
}

// 用本機存的觀光署壓縮檔驗證解析（不連網）。執行：npm test
import { readFileSync } from "node:fs";
import { unzip } from "../src/zip.ts";
import { toRestaurants, inTaiwan } from "../src/restaurants.ts";
import { groupOf, GROUPS } from "../src/cuisine.ts";

const fail: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) fail.push(msg); };

const buf = readFileSync("scripts/fixtures/Restaurant-json.zip");
const files = await unzip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
check(files.has("RestaurantList.json") && files.has("RestaurantServiceTimeList.json"), "壓縮檔缺少預期檔案：" + [...files.keys()]);
const raw = JSON.parse(new TextDecoder().decode(files.get("RestaurantList.json")!).replace(/^﻿/, "")).Restaurants;
const shops = toRestaurants(raw);

check(raw.length === 4674, `來源應為 4674 筆，實際 ${raw.length}`);
check(shops.length === 4562, `排除已停業後應為 4562 間，實際 ${shops.length}`);
check(new Set(shops.map((s) => s.id)).size === shops.length, "id 有重複");
check(shops.every((s) => s.lat === null || inTaiwan(s.lat, s.lon!)), "有座標跑出台灣範圍");
check(!shops.some((s) => s.images.some((i) => i.url.startsWith("http://"))), "圖片網址還有 http://");
check(shops.every((s) => GROUPS.some((g) => g.code === s.grp)), "有店的大類不在 GROUPS 裡");
const withImg = shops.filter((s) => s.images.length).length;
check(withImg > 2000, `有圖的店應超過 2000，實際 ${withImg}`);

// 類別規則：素食優先於其他；伴手禮不算餐廳；沒代碼歸其他
check(groupOf([1, 201]) === "veg", "素食要優先");
check(groupOf([116]) === "souvenir", "116 應為伴手禮");
check(groupOf([]) === "other" && groupOf([254]) === "other", "沒代碼或 254 應為其他");
check(groupOf([4]) === "asian" && groupOf([106]) === "grill", "日式與火鍋大類錯誤");

const byGrp: Record<string, number> = {};
for (const s of shops) byGrp[s.grp] = (byGrp[s.grp] ?? 0) + 1;
console.log("大類分布：", byGrp, "有圖：", withImg, "無座標：", shops.filter((s) => s.lat === null).length);
console.log(fail.length ? "FAIL\n" + fail.join("\n") : "PASS");
process.exit(fail.length ? 1 : 0);

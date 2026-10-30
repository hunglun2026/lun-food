import { groupOf } from "./cuisine.ts";

// 來源 RestaurantList.json 的一筆（只列我們用到的欄位）
interface RawRestaurant {
  RestaurantID: string;
  RestaurantName: string;
  Description?: string;
  PositionLat?: number | null;
  PositionLon?: number | null;
  CuisineClasses?: number[];
  PostalAddress?: { City?: string; Town?: string; ZipCode?: string; StreetAddress?: string };
  Telephones?: Array<{ Tel?: string }>;
  Images?: Array<{ Name?: string; Description?: string; URL?: string }>;
  ServiceTimeInfo?: string;
  TrafficInfo?: string;
  ParkingInfo?: string;
  ServiceStatus?: number;
  WebsiteURL?: string;
  SocialMediaURLs?: Array<{ URL?: string }>;
  RestaurantFeatures?: number[];
  Remarks?: string;
}

export interface Restaurant {
  id: string; name: string; description: string; lat: number | null; lon: number | null;
  cuisine: number[]; grp: string; city: string; town: string; zip: string; street: string;
  tel: string; images: Array<{ url: string; alt: string }>; time_info: string; traffic: string;
  parking: string; website: string; features: number[];
}

// 台灣（含澎湖、金門、馬祖）的經緯度範圍；外面的座標一律當錯誤，不上地圖
export const inTaiwan = (lat: number, lon: number) => lat >= 21.5 && lat <= 26.6 && lon >= 118 && lon <= 123;

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const https = (u: string) => (u.startsWith("http://") ? "https://" + u.slice(7) : u);

export function toRestaurants(list: RawRestaurant[]): Restaurant[] {
  const seen = new Set<string>();
  const out: Restaurant[] = [];
  for (const r of list) {
    if (!r.RestaurantID || !r.RestaurantName || seen.has(r.RestaurantID)) continue;
    if (r.ServiceStatus === 0) continue; // 已停止營業
    seen.add(r.RestaurantID);
    const ok = typeof r.PositionLat === "number" && typeof r.PositionLon === "number" && inTaiwan(r.PositionLat, r.PositionLon);
    const a = r.PostalAddress ?? {};
    const cuisine = r.CuisineClasses ?? [];
    out.push({
      id: r.RestaurantID,
      name: clean(r.RestaurantName),
      description: clean(r.Description),
      lat: ok ? r.PositionLat! : null,
      lon: ok ? r.PositionLon! : null,
      cuisine,
      grp: groupOf(cuisine),
      city: clean(a.City), town: clean(a.Town), zip: clean(a.ZipCode), street: clean(a.StreetAddress),
      tel: clean(r.Telephones?.[0]?.Tel),
      images: (r.Images ?? []).filter((i) => i.URL && /^https?:\/\//.test(i.URL)).slice(0, 3)
        .map((i) => ({ url: https(i.URL!), alt: clean(i.Name) })),
      time_info: clean(r.ServiceTimeInfo), traffic: clean(r.TrafficInfo), parking: clean(r.ParkingInfo),
      website: /^https?:\/\//.test(r.WebsiteURL ?? "") ? https(r.WebsiteURL!) : "",
      features: r.RestaurantFeatures ?? [],
    });
  }
  return out;
}

-- restaurants：只放「觀光署原始資料」，每次同步都會被覆寫
CREATE TABLE restaurants (
  id          TEXT PRIMARY KEY,      -- 來源的 RestaurantID
  name        TEXT NOT NULL,
  description TEXT,
  lat         REAL,                  -- 座標不在台灣範圍時為 NULL，不上地圖
  lon         REAL,
  cuisine     TEXT,                  -- JSON：原始料理類型代碼 [1,254]
  grp         TEXT NOT NULL,         -- 網站大類（snack、chinese…），見 src/cuisine.ts
  city        TEXT,
  town        TEXT,
  zip         TEXT,
  street      TEXT,
  tel         TEXT,
  images      TEXT,                  -- JSON：[{url,alt}]，網址已改 https
  time_info   TEXT,                  -- 營運時間文字
  times       TEXT,                  -- JSON：結構化營運時間 [{name,days,start,end}]
  traffic     TEXT,
  parking     TEXT,
  website     TEXT,
  features    TEXT,                  -- JSON：特色代碼
  active      INTEGER NOT NULL DEFAULT 1,  -- 這次資料沒出現就設 0，不刪
  synced_at   TEXT
);
CREATE INDEX idx_rest_active ON restaurants(active);
CREATE INDEX idx_rest_city ON restaurants(city, grp);

-- sync_log：每次檢查一列，出問題時回頭查
CREATE TABLE sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at        TEXT NOT NULL,
  modified_date TEXT,   -- data.gov.tw 回報的 modifiedDate
  status        TEXT NOT NULL,   -- ok / skipped / error
  row_count     INTEGER,         -- 來源筆數
  shop_count    INTEGER,         -- 匯入後上架的店數
  message       TEXT
);

// 餐飲料理類型代碼（觀光資料標準 V2.1，CuisineClassEnum，PDF 第 135 頁）
// 一間店可有多個代碼；網站用「大類」篩選，一間店取第一個對得上的大類。

export interface Group { code: string; name: string; emoji: string }

export const GROUPS: Group[] = [
  { code: "snack", name: "台灣小吃", emoji: "🍜" },
  { code: "chinese", name: "中式港式", emoji: "🥟" },
  { code: "asian", name: "日韓東南亞", emoji: "🍣" },
  { code: "west", name: "西式異國", emoji: "🍝" },
  { code: "grill", name: "燒烤火鍋海鮮", emoji: "🍲" },
  { code: "noodle", name: "麵粥便當", emoji: "🍱" },
  { code: "dessert", name: "甜點麵包", emoji: "🍰" },
  { code: "drink", name: "咖啡茶飲", emoji: "☕" },
  { code: "souvenir", name: "伴手禮特產", emoji: "🎁" },
  { code: "veg", name: "素食特殊飲食", emoji: "🥬" },
  { code: "other", name: "其他", emoji: "🍴" },
];

// 代碼 → 大類。順序有意義：先對到先贏，所以「比較具體」的放前面。
const RULES: Array<[test: (c: number) => boolean, group: string]> = [
  [(c) => c >= 200 && c <= 204, "veg"],
  [(c) => c === 115 || c === 116, "souvenir"],
  [(c) => c === 101 || c === 102, "dessert"],
  [(c) => c === 103 || c === 104, "drink"],
  [(c) => c >= 105 && c <= 108, "grill"],
  [(c) => c === 113 || c === 114 || (c >= 109 && c <= 112), "noodle"],
  [(c) => c === 4 || c === 5 || c === 96 || c === 97, "asian"],
  [(c) => c === 98 || c === 99, "west"],
  [(c) => c === 2 || c === 3, "chinese"],
  [(c) => c === 1 || c === 100, "snack"],
];

export function groupOf(codes: number[]): string {
  for (const [test, group] of RULES) if (codes.some(test)) return group;
  return "other";
}

/**
 * engine.test.js — 推薦引擎單元測試
 * 這個測試不需要 DB 或任何外部服務
 */

const { recommend, buildTagWeights, scoreMenu, parseTags, decayWeight } = require("../src/middleware/engine");

// ── parseTags ────────────────────────────────────────────────
describe("parseTags", () => {
  test("解析 JSON 字串陣列", () => {
    expect(parseTags('["chicken","spicy"]')).toEqual(["chicken", "spicy"]);
  });
  test("直接傳陣列也能用", () => {
    expect(parseTags(["chicken", "spicy"])).toEqual(["chicken", "spicy"]);
  });
  test("null 回傳空陣列", () => {
    expect(parseTags(null)).toEqual([]);
  });
  test("格式錯誤回傳空陣列", () => {
    expect(parseTags("not-json")).toEqual([]);
  });
});

// ── decayWeight ───────────────────────────────────────────────
describe("decayWeight", () => {
  test("今天的訂單權重接近 1", () => {
    const w = decayWeight(new Date().toISOString());
    expect(w).toBeGreaterThan(0.95);
  });
  test("7天前的訂單權重接近 0.5", () => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const w = decayWeight(d.toISOString());
    expect(w).toBeGreaterThan(0.45);
    expect(w).toBeLessThan(0.55);
  });
  test("20天前的訂單權重明顯低於今天", () => {
    const d = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const w = decayWeight(d.toISOString());
    expect(w).toBeLessThan(0.25);
  });
});

// ── buildTagWeights ───────────────────────────────────────────
describe("buildTagWeights", () => {
  const today = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  test("常點的 tag 權重更高", () => {
    const orders = [
      { order_date: today,   menu_tags: '["chicken","spicy"]' },
      { order_date: today,   menu_tags: '["chicken","fried"]' },
      { order_date: today,   menu_tags: '["salad"]' },
    ];
    const weights = buildTagWeights(orders);
    expect(weights.get("chicken")).toBeGreaterThan(weights.get("salad"));
  });

  test("最近的訂單比舊的影響更大", () => {
    const orders = [
      { order_date: today,   menu_tags: '["newFood"]' },
      { order_date: weekAgo, menu_tags: '["oldFood"]' },
    ];
    const weights = buildTagWeights(orders);
    expect(weights.get("newfood")).toBeGreaterThan(weights.get("oldfood"));
  });

  test("空訂單回傳空 Map", () => {
    const weights = buildTagWeights([]);
    expect(weights.size).toBe(0);
  });

  test("最高權重正規化為 1.0", () => {
    const orders = [
      { order_date: today, menu_tags: '["top","other"]' },
      { order_date: today, menu_tags: '["top"]' },
    ];
    const weights = buildTagWeights(orders);
    expect(weights.get("top")).toBe(1.0);
  });
});

// ── recommend ─────────────────────────────────────────────────
describe("recommend", () => {
  const today = new Date().toISOString();

  const orders = [
    { order_date: today, menu_tags: '["chicken","spicy","fried"]' },
    { order_date: today, menu_tags: '["chicken","rice"]' },
    { order_date: today, menu_tags: '["spicy","noodle"]' },
  ];

  const menus = [
    { id: 1, vendor_id: 1, name: "辣雞排", tags: '["chicken","spicy","fried"]' },
    { id: 2, vendor_id: 1, name: "白飯套餐", tags: '["rice","light"]' },
    { id: 3, vendor_id: 2, name: "辣麵", tags: '["spicy","noodle"]' },
    { id: 4, vendor_id: 2, name: "沙拉", tags: '["salad","light","healthy"]' },
    { id: 5, vendor_id: 3, name: "雞肉飯", tags: '["chicken","rice"]' },
    { id: 6, vendor_id: 3, name: "炸物拼盤", tags: '["fried","heavy"]' },
  ];

  test("回傳非空陣列", () => {
    const { recommendations } = recommend(orders, menus);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  test("高 tag 命中的菜排在前面", () => {
    const { recommendations } = recommend(orders, menus);
    // 辣雞排符合 chicken+spicy+fried，應該排最前
    expect(recommendations[0].id).toBe(1);
  });

  test("每道菜都有 score 欄位", () => {
    const { recommendations } = recommend(orders, menus);
    for (const r of recommendations) {
      expect(typeof r.score).toBe("number");
    }
  });

  test("debug 包含 top_tags 和統計資訊", () => {
    const { debug } = recommend(orders, menus);
    expect(debug.order_count).toBe(3);
    expect(debug.menu_count).toBe(6);
    expect(Array.isArray(debug.top_tags)).toBe(true);
    expect(debug.top_tags[0]).toHaveProperty("tag");
    expect(debug.top_tags[0]).toHaveProperty("weight");
  });

  test("沒有訂單歷史時仍能推薦（熱門推薦退化）", () => {
    const { recommendations } = recommend([], menus);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  test("菜單為空時回傳空陣列", () => {
    const { recommendations } = recommend(orders, []);
    expect(recommendations).toEqual([]);
  });

  test("多樣性保護：多個 vendor 時同一 vendor 不超過 40%", () => {
    // 6 個 vendor，每個 vendor 10 道菜，共 60 道
    const multiVendor = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      vendor_id: (i % 6) + 1,
      name: `菜${i}`,
      tags: '["chicken","spicy"]',
    }));
    const { recommendations } = recommend(orders, multiVendor);
    // 每個 vendor 最多佔 40%
    for (let v = 1; v <= 6; v++) {
      const count = recommendations.filter((r) => r.vendor_id === v).length;
      expect(count / recommendations.length).toBeLessThanOrEqual(0.41);
    }
  });

  test("多樣性保護：只有一個 vendor 時全部都推（沒有其他選擇）", () => {
    const allSameVendor = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, vendor_id: 1, name: `菜${i}`, tags: '["chicken","spicy"]',
    }));
    const { recommendations } = recommend(orders, allSameVendor);
    // 只有一個 vendor，全部都是 vendor 1 是正確行為
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((r) => r.vendor_id === 1)).toBe(true);
  });

  test("推薦數量在 5~10 之間", () => {
    const bigMenus = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1, vendor_id: (i % 5) + 1, name: `菜${i}`,
      tags: i % 2 === 0 ? '["chicken","spicy"]' : '["salad","light"]',
    }));
    const { recommendations } = recommend(orders, bigMenus);
    expect(recommendations.length).toBeGreaterThanOrEqual(5);
    expect(recommendations.length).toBeLessThanOrEqual(10);
  });
});

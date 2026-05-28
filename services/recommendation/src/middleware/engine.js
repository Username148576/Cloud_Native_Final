/**
 * engine.js — 推薦演算法核心
 *
 * 演算法流程：
 *  1. 分析最近 20 天的訂單，統計 tag 偏好（加入時間衰減）
 *  2. 對今日菜單打分（tag 命中率 × 衰減權重總和）
 *  3. 多樣性保護：同一 vendor 最多佔推薦的 40%
 *  4. 回傳分數最高的前 5~10 筆
 */

const DECAY_HALF_LIFE_DAYS = 7;   // 7天前的訂單權重剩一半
const MAX_VENDOR_RATIO    = 0.4;  // 同一 vendor 最多佔 40%
const TOP_N_MIN           = 5;
const TOP_N_MAX           = 10;

/**
 * 把 tag 字串 ["chicken","spicy"] 解析成陣列
 * 支援 JSON 陣列字串 或 已經是陣列 的情況
 */
const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try { return JSON.parse(tags); } catch { return []; }
};

/**
 * 時間衰減係數
 * f(days_ago) = 0.5 ^ (days_ago / HALF_LIFE)
 * → 7天前的訂單剩 0.5，14天前剩 0.25，20天前剩 ~0.18
 */
const decayWeight = (orderDate) => {
  const daysAgo = (Date.now() - new Date(orderDate).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, daysAgo / DECAY_HALF_LIFE_DAYS);
};

/**
 * Step 1：從訂單歷史建立 tag 偏好權重表
 *
 * @param {Array} orders  [{ order_date, menu_tags }, ...]
 * @returns {Map<string, number>}  tag → 加權分數
 */
const buildTagWeights = (orders) => {
  const weights = new Map();

  for (const order of orders) {
    const tags = parseTags(order.menu_tags);
    const w = decayWeight(order.order_date);

    for (const tag of tags) {
      const t = tag.toLowerCase().trim();
      weights.set(t, (weights.get(t) || 0) + w);
    }
  }

  // 正規化：最高的 tag 設為 1.0，其他按比例縮放
  const maxWeight = Math.max(...weights.values(), 1);
  for (const [tag, val] of weights) {
    weights.set(tag, val / maxWeight);
  }

  return weights;
};

/**
 * Step 2：對菜單打分
 *
 * 分數 = Σ(命中的 tag 權重) / 菜單 tag 總數（避免 tag 多的菜佔便宜）
 * 若員工完全沒有偏好資料，改用 tag 數量作為基礎分（確保還是能推薦）
 *
 * @param {Object} menu        { id, vendor_id, name, tags, ... }
 * @param {Map}    tagWeights
 * @returns {number}
 */
const scoreMenu = (menu, tagWeights) => {
  const tags = parseTags(menu.tags);
  if (tags.length === 0) return 0;

  const hasPreference = tagWeights.size > 0;

  if (!hasPreference) {
    // 沒有歷史資料：用 tag 豐富度當分數
    return tags.length * 0.1;
  }

  let score = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase().trim();
    score += tagWeights.get(t) || 0;
  }

  // 平均分 + 覆蓋率加成
  const avgScore = score / tags.length;
  const coverageBonus = Math.min(score / tagWeights.size, 0.3); // 最多加 0.3
  return avgScore + coverageBonus;
};

/**
 * Step 3：多樣性保護
 * 同一個 vendor 的菜最多佔最終推薦的 MAX_VENDOR_RATIO
 *
 * @param {Array}  ranked   已排序的菜單（高分在前）
 * @param {number} topN     目標推薦數
 * @returns {Array}
 */
const applyDiversityFilter = (ranked, topN) => {
  const result = [];
  const vendorCount = new Map();
  const maxPerVendor = Math.max(1, Math.ceil(topN * MAX_VENDOR_RATIO));

  for (const item of ranked) {
    if (result.length >= topN) break;
    const count = vendorCount.get(item.vendor_id) || 0;
    if (count >= maxPerVendor) continue;
    result.push(item);
    vendorCount.set(item.vendor_id, count + 1);
  }

  // 如果多樣性過濾後不夠數，用剩下的補滿
  if (result.length < TOP_N_MIN) {
    for (const item of ranked) {
      if (result.length >= TOP_N_MIN) break;
      if (!result.find((r) => r.id === item.id)) result.push(item);
    }
  }

  return result;
};

/**
 * 主函式：輸入訂單歷史 + 今日菜單 → 輸出推薦清單
 *
 * @param {Array} orders   最近 20 天的訂單
 * @param {Array} menus    今日可用菜單
 * @returns {{ recommendations: Array, tagWeights: Object, debug: Object }}
 */
const recommend = (orders, menus) => {
  // Step 1：建立偏好權重
  const tagWeights = buildTagWeights(orders);

  // Step 2：對每道菜打分
  const scored = menus.map((menu) => ({
    ...menu,
    _score: scoreMenu(menu, tagWeights),
  }));

  // Step 3：排序
  scored.sort((a, b) => b._score - a._score);

  // Step 4：決定推薦數量（5~10，依菜單多寡調整）
  const topN = Math.min(TOP_N_MAX, Math.max(TOP_N_MIN, Math.floor(menus.length * 0.15)));

  // Step 5：多樣性保護
  const recommendations = applyDiversityFilter(scored, topN);

  // 整理輸出（移除內部用的 _score key 並附上給前端看的 score）
  const result = recommendations.map(({ _score, ...menu }) => ({
    ...menu,
    score: Math.round(_score * 1000) / 1000,
  }));

  // debug 資訊：回傳 top 10 tag 權重，方便前端或 admin 了解推薦原因
  const topTags = [...tagWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, weight]) => ({ tag, weight: Math.round(weight * 1000) / 1000 }));

  return {
    recommendations: result,
    debug: {
      order_count: orders.length,
      menu_count: menus.length,
      top_tags: topTags,
    },
  };
};

module.exports = { recommend, buildTagWeights, scoreMenu, parseTags, decayWeight };

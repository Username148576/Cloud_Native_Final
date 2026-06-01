/**
 * orderService.js
 * 向 Order service 拿員工最近 N 天的訂單（含 menu tag）
 */

/**
 * 取得員工最近 days 天的訂單
 * 預期 Order service 回傳格式：
 * [{ id, menu_id, order_date, menu_tags: ["chicken","spicy"] }, ...]
 *
 * @param {number} employeeId
 * @param {number} days  預設 20
 * @returns {Promise<Array>}
 */
const getRecentOrdersByEmployee = async (employeeId, days = 20) => {
  const url = new URL(`${process.env.ORDER_SERVICE_URL}/orders/employee/${employeeId}`);
  const today = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  url.searchParams.set("from", fromDate);
  url.searchParams.set("to", today);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Order service error ${res.status}: ${err.error || "unknown"}`);
  }
  return res.json();
};

module.exports = { getRecentOrdersByEmployee };

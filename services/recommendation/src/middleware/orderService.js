/**
 * 取得員工最近 days 天的訂單
 * 預期 Order service 回傳格式：
 * [{ id, menu_id, order_date, menu_tags: ["chicken","spicy"] }, ...]
 *
 * @param {Object} headers
 * @param {number} employeeId
 * @param {number} days  預設 20
 * @returns {Promise<Array>}
 */
const getRecentOrdersByEmployee = async (headers, employeeId, days = 20) => {
  const url = new URL(`${process.env.ORDER_SERVICE_URL}/orders/employee/${employeeId}`);
  const today = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  url.searchParams.set("from", fromDate);
  url.searchParams.set("to", today);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      'X-User-ID': headers['x-user-id'],
      'X-User-Role': headers['x-user-role'],
      'X-User-Email': headers['x-user-email']
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Order service error ${res.status}: ${err.error || "unknown"}`);
  }
  return res.json();
};

module.exports = { getRecentOrdersByEmployee };

/**
 * orderService.js
 * 向 Order service 拿員工最近 N 天的訂單（含 menu tag）
 */

let cachedToken = null;
let tokenExpiry = 0;

const getAdminToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry - 5 * 60 * 1000) return cachedToken;

  const res = await fetch(`${process.env.IAM_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.INTERNAL_ADMIN_EMAIL,
      password: process.env.INTERNAL_ADMIN_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error("Failed to get internal admin token");
  const data = await res.json();
  cachedToken = data.token;
  tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
  return cachedToken;
};

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
  const token = await getAdminToken();
  const url = new URL(`${process.env.ORDER_SERVICE_URL}/orders/employee/${employeeId}`);
  const today = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  url.searchParams.set("from", fromDate);
  url.searchParams.set("to", today);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Order service error ${res.status}: ${err.error || "unknown"}`);
  }
  return res.json();
};

module.exports = { getRecentOrdersByEmployee };

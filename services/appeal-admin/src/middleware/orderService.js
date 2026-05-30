/**
 * orderService.js
 * 向 Order service 查單一訂單資料，取得 employee_id 與 vendor_id
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
 * 取得單一訂單資料
 * GET /orders/:orderId
 * @param {number} orderId
 * @returns {Promise<{ employee_id: number, vendor_id: number, ...}>}
 */
const getOrderById = async (orderId) => {
  const token = await getAdminToken();
  const res = await fetch(`${process.env.ORDER_SERVICE_URL}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) throw new Error(`Order ${orderId} not found`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Order service error ${res.status}: ${err.error || "unknown"}`);
  }

  return res.json();
};

module.exports = { getOrderById };
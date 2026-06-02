/**
 * orderService.js
 * 向 Order service 查單一訂單資料，取得 employee_id 與 vendor_id
 */
/**
 * 取得單一訂單資料
 * GET /orders/:orderId
 * @param {string} orderId
 * @returns {Promise<{ employee_id: number, vendor_id: number, ...}>}
 */
const getOrderById = async (req, orderId) => {
  const token = await getAdminToken();
  const res = await fetch(`${process.env.ORDER_SERVICE_URL}/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      'X-User-ID': req.headers['x-user-id'],
      'X-User-Role': req.headers['x-user-role'],
      'X-User-Email': req.headers['x-user-email']
    }
  });

  if (res.status === 404) throw new Error(`Order ${orderId} not found`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Order service error ${res.status}: ${err.error || "unknown"}`);
  }

  return res.json();
};

module.exports = { getOrderById };
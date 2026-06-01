/**
 * orderService.js
 * 以 admin 身份向 Order Service 取得資料的 helper
 *
 * 使用方式：在啟動時用環境變數 INTERNAL_ADMIN_TOKEN 帶入一個
 * 由 IAM service 簽發、role=admin 的長期 token（或在啟動腳本登入取得）
 */
/**
 * 取得特定 vendor 的訂單清單
 * @param {string} vendorId
 * @param {string} period  e.g. "2024-01"
 * @returns {Promise<Array>}
 */
const getOrdersByVendor = async (req, vendorId, period) => {
  const url = new URL(`${process.env.ORDER_SERVICE_URL}/vendor/orders/vendor/${vendorId}`);
  if (period) {
    const [year, month] = period.split("-");
    url.searchParams.set("from", `${year}-${month}-01`);
    // 注意不同月份的天數
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    url.searchParams.set("to", `${year}-${month}-${daysInMonth}`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      'X-User-ID': req.headers['x-user-id'],
      'X-User-Role': req.headers['x-user-role'],
      'X-User-Email': req.headers['x-user-email']
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Order service error ${response.status}: ${err.error || "unknown"}`);
  }

  return response.json();
};

module.exports = { getOrdersByVendor };

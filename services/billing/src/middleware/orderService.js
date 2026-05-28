/**
 * orderService.js
 * 以 admin 身份向 Order Service 取得資料的 helper
 *
 * 使用方式：在啟動時用環境變數 INTERNAL_ADMIN_TOKEN 帶入一個
 * 由 IAM service 簽發、role=admin 的長期 token（或在啟動腳本登入取得）
 */

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://localhost:3006";
const INTERNAL_ADMIN_TOKEN = process.env.INTERNAL_ADMIN_TOKEN || "";

/**
 * 取得特定 vendor 的訂單清單
 * @param {number} vendorId
 * @param {string} period  e.g. "2024-01"
 * @returns {Promise<Array>}
 */
const getOrdersByVendor = async (vendorId, period) => {
  const url = new URL(`${ORDER_SERVICE_URL}/vendor/orders/vendor/${vendorId}`);
  if (period) {
    const [year, month] = period.split("-");
    url.searchParams.set("from", `${year}-${month}-01`);
    url.searchParams.set("to", `${year}-${month}-31`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${INTERNAL_ADMIN_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Order service error ${response.status}: ${err.error || "unknown"}`);
  }

  return response.json();
};

module.exports = { getOrdersByVendor };

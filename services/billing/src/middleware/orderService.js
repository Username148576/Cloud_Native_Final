/**
 * orderService.js
 * 以 admin 身份向 Order Service 取得資料的 helper
 *
 * 使用方式：在啟動時用環境變數 INTERNAL_ADMIN_TOKEN 帶入一個
 * 由 IAM service 簽發、role=admin 的長期 token（或在啟動腳本登入取得）
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
 * 取得特定 vendor 的訂單清單
 * @param {string} vendorId
 * @param {string} period  e.g. "2024-01"
 * @returns {Promise<Array>}
 */
const getOrdersByVendor = async (vendorId, period) => {
  const token = await getAdminToken();
  const url = new URL(`${process.env.ORDER_SERVICE_URL}/vendor/orders/vendor/${vendorId}`);
  if (period) {
    const [year, month] = period.split("-");
    url.searchParams.set("from", `${year}-${month}-01`);
    url.searchParams.set("to", `${year}-${month}-31`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
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

/**
 * menuService.js
 * 向 Vendor/Menu service 拿今日可用菜單
 */

// 共用同一個 token cache（跟 orderService 分開 import 沒關係，各自維護）
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
 * 取得今日所有可用菜單
 * 預期 Menu service 回傳格式：
 * [{
 *   id, vendor_id, name, price,
 *   tags: ["chicken","spicy","fried"],
 *   daily_limit, is_available
 * }, ...]
 *
 * @returns {Promise<Array>}
 */
const getTodayMenus = async (factoryZone) => {
  const token = await getAdminToken();
  const url = new URL(`${process.env.MENU_SERVICE_URL}/api/v1/menus`);
  url.searchParams.set("factoryZone", factoryZone);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Menu service error ${res.status}: ${err.error || "unknown"}`);
  }
  return res.json();
};

module.exports = { getTodayMenus };

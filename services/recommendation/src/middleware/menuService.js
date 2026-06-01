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
const getTodayMenus = async (req, factoryZone) => {
  const url = new URL(`${process.env.MENU_SERVICE_URL}/api/v1/menus`);
  url.searchParams.set("factoryZone", factoryZone);
  console.log(url.toString());
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      'X-User-ID': req.headers['x-user-id'],
      'X-User-Role': req.headers['x-user-role'],
      'X-User-Email': req.headers['x-user-email']
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Menu service error ${res.status}: ${err.error || "unknown"}`);
  }
  return res.json();
};

module.exports = { getTodayMenus };

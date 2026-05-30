/**
 * vendorService.js
 * 向 Vendor service (EC2-B) 呼叫商家相關 API
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
 * 商家違規點數 +1
 * POST /api/v1/vendors/:id/violation-points
 * @param {number} vendorId
 */
const addViolationPoint = async (vendorId) => {
  const token = await getAdminToken();
  const url = `${process.env.MENU_SERVICE_URL}/api/v1/vendors/${vendorId}/violation-points`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vendor service error ${res.status}: ${err.error || "unknown"}`);
  }

  return res.json().catch(() => ({}));
};

module.exports = { addViolationPoint };
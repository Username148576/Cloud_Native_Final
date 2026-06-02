/**
 * vendorService.js
 * 向 Vendor service (EC2-B) 呼叫商家相關 API
 */
/**
 * 商家違規點數 +1
 * POST /api/v1/vendors/:id/violation-points
 * @param {number} vendorId
 */
const addViolationPoint = async (req, vendorId) => {
  const token = await getAdminToken();
  const url = `${process.env.MENU_SERVICE_URL}/api/v1/vendors/${vendorId}/violation-points`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'X-User-ID': req.headers['x-user-id'],
      'X-User-Role': req.headers['x-user-role'],
      'X-User-Email': req.headers['x-user-email']
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vendor service error ${res.status}: ${err.error || "unknown"}`);
  }

  return res.json().catch(() => ({}));
};

module.exports = { addViolationPoint };
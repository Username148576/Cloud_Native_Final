const getfactoryZoneByEmployeeId = async (req, employeeId) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const userEmail = req.headers['x-user-email'];
  const url = new URL(`http://127.0.0.1:3001/employees/user/${employeeId}`);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      'X-User-ID': userId,
      'X-User-Role': userRole,
      'X-User-Email': userEmail
    }
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`IAM service error ${res.status}: ${data.error || "unknown"}`);
  }
  const data = await res.json();
  return data.factory_zone;
};

module.exports = { getfactoryZoneByEmployeeId };
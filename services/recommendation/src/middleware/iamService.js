const getfactoryZoneByEmployeeId = async (headers, employeeId) => {
  const userId = headers['x-user-id'];
  const userRole = headers['x-user-role'];
  const userEmail = headers['x-user-email'];
  const url = new URL(`127.0.0.1:3001/employees/user/${employeeId}`);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-User-ID': userId,
      'X-User-Role': userRole,
      'X-User-Email': userEmail
    }
  });
  const data = await res.json();
  return data.factory_zone;
};

module.exports = { getfactoryZoneByEmployeeId };
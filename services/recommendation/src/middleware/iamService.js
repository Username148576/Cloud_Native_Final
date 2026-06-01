const getfactoryZoneByEmployeeId = async (employeeId) => {
  const url = new URL(`127.0.0.1:3001/employees/user/${employeeId}`);
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.factory_zone;
};

module.exports = { getfactoryZoneByEmployeeId };
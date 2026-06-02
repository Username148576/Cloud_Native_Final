const services = [
  { name: "iam", port: 3001 },
  { name: "notification", port: 3002 },
  { name: "recommendation", port: 3003 },
  { name: "billing", port: 3004 },
  { name: "appeal-admin", port: 3005 },
];

const readJson = async (url) => {
  const res = await fetch(url);
  const body = await res.json();
  return { res, body };
};

const readText = async (url) => {
  const res = await fetch(url);
  const body = await res.text();
  return { res, body };
};

const checkService = async ({ name, port }) => {
  const baseUrl = `http://localhost:${port}`;
  const ready = await readJson(`${baseUrl}/ready`);
  const metrics = await readText(`${baseUrl}/metrics`);

  if (!ready.res.ok || ready.body.status !== "ready") {
    throw new Error(`${name} readiness failed: ${JSON.stringify(ready.body)}`);
  }

  if (
    !metrics.res.ok ||
    !metrics.body.includes(`ordering_service_info{service="${name}"}`) ||
    !metrics.body.includes("http_requests_total") ||
    !metrics.body.includes("http_request_duration_seconds")
  ) {
    throw new Error(`${name} metrics endpoint failed`);
  }

  console.log(`${name} ready and metrics available`);
};

const main = async () => {
  const failures = [];

  for (const service of services) {
    try {
      await checkService(service);
    } catch (err) {
      failures.push(err.message);
      console.error(err.message);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("All service smoke checks passed");
};

main();

process.env.DB_NAME = process.env.DB_NAME || "appeal_admin_test_db";

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db/pool");

afterAll(async () => {
  await pool.end();
});

describe("platform endpoints", () => {
  test("GET /health returns liveness and preserves request id", async () => {
    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", "appeal-health-test");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe("appeal-health-test");
    expect(res.body.service).toBe("appeal-admin");
    expect(res.body.status).toBe("ok");
  });

  test("GET /ready verifies database connectivity", async () => {
    const res = await request(app).get("/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.checks.database).toBe("ok");
  });

  test("GET /metrics exposes Prometheus-style service metrics", async () => {
    await request(app).get("/health");
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.text).toContain('ordering_service_info{service="appeal-admin"} 1');
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("http_request_duration_seconds");
  });

  test("unknown routes include a request id for troubleshooting", async () => {
    const res = await request(app)
      .get("/missing")
      .set("X-Request-Id", "appeal-missing-test");

    expect(res.status).toBe(404);
    expect(res.body.requestId).toBe("appeal-missing-test");
  });
});

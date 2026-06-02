process.env.DB_NAME = process.env.DB_NAME || "recommendation_test_db";

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
      .set("X-Request-Id", "recommendation-health-test");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe("recommendation-health-test");
    expect(res.body.service).toBe("recommendation");
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
    expect(res.text).toContain('ordering_service_info{service="recommendation"} 1');
    expect(res.text).toContain("ordering_http_requests_total");
  });

  test("unknown routes include a request id for troubleshooting", async () => {
    const res = await request(app)
      .get("/missing")
      .set("X-Request-Id", "recommendation-missing-test");

    expect(res.status).toBe(404);
    expect(res.body.requestId).toBe("recommendation-missing-test");
  });
});

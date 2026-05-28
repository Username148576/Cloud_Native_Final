/**
 * Billing Service Tests
 * billing_statements 的 create 需要打 Order service，
 * 所以這裡用 jest.mock 把 orderService mock 掉
 * 執行: npm test
 */

process.env.DB_NAME = "billing_test_db";
process.env.JWT_SECRET = "test_secret";
process.env.PORT = "3099";

// Mock orderService 避免真的打 Order service
jest.mock("../src/middleware/orderService", () => ({
  getOrdersByVendor: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");
const { getOrdersByVendor } = require("../src/middleware/orderService");

const makeToken = (userId, role) =>
  jwt.sign({ userId, role, email: `${role}@test.com` }, "test_secret");

const adminToken = makeToken(1, "admin");
const vendorToken = makeToken(2, "vendor");

let createdStatementId = null;
let createdIncidentId = null;

beforeAll(async () => {
  await pool.query("TRUNCATE billing_statements, vendor_incidents RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// billing_statements
// ════════════════════════════════════════════════════════════
describe("POST /billing/statements", () => {
  test("admin 可以建立帳單（自動從 Order service 拉資料）", async () => {
    // mock Order service 回傳假訂單
    getOrdersByVendor.mockResolvedValue([
      { total_price: 300 },
      { total_price: 450 },
      { total_price: 200 },
    ]);

    const res = await request(app)
      .post("/billing/statements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ vendor_id: 2, statement_period: "2024-01" });

    expect(res.status).toBe(201);
    expect(res.body.total_amount).toBe(950); // 300+450+200
    expect(res.body.order_count).toBe(3);
    expect(res.body.vendor_id).toBe(2);
    createdStatementId = res.body.id;
  });

  test("Order service 失敗時回傳 502", async () => {
    getOrdersByVendor.mockRejectedValue(
      new Error("Order service error 503: service unavailable")
    );

    const res = await request(app)
      .post("/billing/statements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ vendor_id: 2, statement_period: "2024-02" });

    expect(res.status).toBe(502);
  });

  test("缺少 vendor_id 回傳 400", async () => {
    const res = await request(app)
      .post("/billing/statements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ statement_period: "2024-01" });
    expect(res.status).toBe(400);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .post("/billing/statements")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ vendor_id: 2, statement_period: "2024-01" });
    expect(res.status).toBe(403);
  });
});

describe("GET /billing/statements", () => {
  test("admin 可以取得所有帳單", async () => {
    const res = await request(app)
      .get("/billing/statements")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .get("/billing/statements")
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /billing/statements/user/:userId", () => {
  test("vendor 可以取得自己的帳單", async () => {
    const res = await request(app)
      .get("/billing/statements/user/2")
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("非本人回傳 403", async () => {
    const otherToken = makeToken(99, "vendor");
    const res = await request(app)
      .get("/billing/statements/user/2")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /billing/statements/:id", () => {
  test("admin 可以刪除帳單", async () => {
    const res = await request(app)
      .delete(`/billing/statements/${createdStatementId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("刪除不存在的回傳 404", async () => {
    const res = await request(app)
      .delete("/billing/statements/9999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════
// vendor_incidents
// ════════════════════════════════════════════════════════════
describe("POST /billing/incidents", () => {
  test("admin 可以建立違規記錄", async () => {
    const res = await request(app)
      .post("/billing/incidents")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ vendor_id: 2, description: "食物品質問題", deducted_points: 10 });
    expect(res.status).toBe(201);
    expect(res.body.deducted_points).toBe(10);
    createdIncidentId = res.body.id;
  });

  test("缺少必要欄位回傳 400", async () => {
    const res = await request(app)
      .post("/billing/incidents")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ vendor_id: 2 });
    expect(res.status).toBe(400);
  });
});

describe("GET /billing/incidents", () => {
  test("admin 可以取得所有違規記錄", async () => {
    const res = await request(app)
      .get("/billing/incidents")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /billing/incidents/user/:userId", () => {
  test("vendor 可以取得自己的違規記錄", async () => {
    const res = await request(app)
      .get("/billing/incidents/user/2")
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /billing/incidents/:id", () => {
  test("admin 可以更新違規記錄", async () => {
    const res = await request(app)
      .patch(`/billing/incidents/${createdIncidentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ deducted_points: 20, description: "更新說明" });
    expect(res.status).toBe(200);
    expect(res.body.deducted_points).toBe(20);
  });

  test("不存在的記錄回傳 404", async () => {
    const res = await request(app)
      .patch("/billing/incidents/9999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ description: "test" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /billing/incidents/:id", () => {
  test("admin 可以刪除違規記錄", async () => {
    const res = await request(app)
      .delete(`/billing/incidents/${createdIncidentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

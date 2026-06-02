/**
 * Billing Service Tests
 * billing_statements 的 create 需要打 Order service，
 * 所以這裡用 jest.mock 把 orderService mock 掉
 * 執行: npm test
 */

process.env.DB_NAME = "billing_test_db";
process.env.PORT = "3099";

// Mock orderService 避免真的打 Order service
jest.mock("../src/middleware/orderService", () => ({
  getOrdersByVendor: jest.fn(),
}));

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db/pool");
const { getOrdersByVendor } = require("../src/middleware/orderService");

const adminAuth = {
  "X-User-Id": "1",
  "X-User-Role": "admin",
  "X-User-Email": "admin@test.com"
};

const vendorAuth = {
  "X-User-Id": "2",
  "X-User-Role": "vendor",
  "X-User-Email": "vendor@test.com"
};

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
    getOrdersByVendor.mockResolvedValue({ orders: [
      { total_price: 300, status: "completed" },
      { total_price: 450, status: "cancelled" },
      { total_price: 200, status: "completed" },
    ] });

    const res = await request(app)
      .post("/billing/statements")
      .set(adminAuth)
      .send({ vendor_id: 2, statement_period: "2024-01" });

    expect(res.status).toBe(201);
    expect(res.body.total_amount).toBe(500); // 300+200
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
      .set(adminAuth)
      .send({ vendor_id: 2, statement_period: "2024-02" });

    expect(res.status).toBe(502);
  });

  test("缺少 vendor_id 回傳 400", async () => {
    const res = await request(app)
      .post("/billing/statements")
      .set(adminAuth)
      .send({ statement_period: "2024-01" });
    expect(res.status).toBe(400);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .post("/billing/statements")
      .set(vendorAuth)
      .send({ vendor_id: 2, statement_period: "2024-01" });
    expect(res.status).toBe(403);
  });
});

describe("GET /billing/statements", () => {
  test("admin 可以取得所有帳單", async () => {
    const res = await request(app)
      .get("/billing/statements")
      .set(adminAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .get("/billing/statements")
      .set(vendorAuth);
    expect(res.status).toBe(403);
  });
});

describe("GET /billing/statements/user/:userId", () => {
  test("vendor 可以取得自己的帳單", async () => {
    const res = await request(app)
      .get("/billing/statements/user/2")
      .set(vendorAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("非本人回傳 403", async () => {
    const otherAuth = {
      "X-User-Id": "99",
      "X-User-Role": "vendor",
      "X-User-Email": "other@test.com"
    };
    const res = await request(app)
      .get("/billing/statements/user/2")
      .set(otherAuth);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /billing/statements/:id", () => {
  test("admin 可以刪除帳單", async () => {
    const res = await request(app)
      .delete(`/billing/statements/${createdStatementId}`)
      .set(adminAuth);
    expect(res.status).toBe(200);
  });

  test("刪除不存在的回傳 404", async () => {
    const res = await request(app)
      .delete("/billing/statements/9999")
      .set(adminAuth);
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
      .set(adminAuth)
      .send({ vendor_id: 2, description: "食物品質問題", deducted_points: 10 });
    expect(res.status).toBe(201);
    expect(res.body.deducted_points).toBe(10);
    createdIncidentId = res.body.id;
  });

  test("缺少必要欄位回傳 400", async () => {
    const res = await request(app)
      .post("/billing/incidents")
      .set(adminAuth)
      .send({ vendor_id: 2 });
    expect(res.status).toBe(400);
  });
});

describe("GET /billing/incidents", () => {
  test("admin 可以取得所有違規記錄", async () => {
    const res = await request(app)
      .get("/billing/incidents")
      .set(adminAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /billing/incidents/user/:userId", () => {
  test("vendor 可以取得自己的違規記錄", async () => {
    const res = await request(app)
      .get("/billing/incidents/user/2")
      .set(vendorAuth);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /billing/incidents/:id", () => {
  test("admin 可以更新違規記錄", async () => {
    const res = await request(app)
      .patch(`/billing/incidents/${createdIncidentId}`)
      .set(adminAuth)
      .send({ deducted_points: 20, description: "更新說明" });
    expect(res.status).toBe(200);
    expect(res.body.deducted_points).toBe(20);
  });

  test("不存在的記錄回傳 404", async () => {
    const res = await request(app)
      .patch("/billing/incidents/9999")
      .set(adminAuth)
      .send({ description: "test" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /billing/incidents/:id", () => {
  test("admin 可以刪除違規記錄", async () => {
    const res = await request(app)
      .delete(`/billing/incidents/${createdIncidentId}`)
      .set(adminAuth);
    expect(res.status).toBe(200);
  });
});

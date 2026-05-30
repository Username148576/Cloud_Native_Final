/**
 * Appeal-Admin Service Tests
 * 執行: npm test
 */

process.env.DB_NAME               = "appeal_admin_test_db";
process.env.JWT_SECRET            = "test_secret";
process.env.PORT                  = "3099";
process.env.IAM_SERVICE_URL       = "http://localhost:3001";
process.env.ORDER_SERVICE_URL     = "http://localhost:3006";
process.env.VENDOR_SERVICE_URL    = "http://localhost:3008";
process.env.INTERNAL_ADMIN_EMAIL  = "admin@test.com";
process.env.INTERNAL_ADMIN_PASSWORD = "admin123";

const request = require("supertest");
const jwt     = require("jsonwebtoken");
const app     = require("../src/app");
const pool    = require("../src/db/pool");

// ── Mock 外部服務 ────────────────────────────────────────────
// Order service：GET /orders/:id
jest.mock("../src/middleware/orderService", () => ({
  getOrderById: jest.fn(),
}));

// Vendor service：POST /api/v1/vendors/:id/violation-points
jest.mock("../src/middleware/vendorService", () => ({
  addViolationPoint: jest.fn(),
}));

const { getOrderById }      = require("../src/middleware/orderService");
const { addViolationPoint } = require("../src/middleware/vendorService");

// ── Token helpers ────────────────────────────────────────────
const makeToken = (userId, role) =>
  jwt.sign({ iss: "ordering-system", userId, role, email: `${role}@test.com` }, "test_secret");

const adminToken  = makeToken(1, "admin");
const empToken    = makeToken(2, "employee");
const vendorToken = makeToken(3, "vendor");

// ── 假訂單資料 ───────────────────────────────────────────────
const fakeOrder = { id: 1, employee_id: 2, vendor_id: 10 };

let createdId     = null;
let noVendorId    = null;

beforeAll(async () => {
  await pool.query("TRUNCATE appeals RESTART IDENTITY CASCADE");
});

beforeEach(() => {
  jest.clearAllMocks();
  // 預設：Order service 正常回傳
  getOrderById.mockResolvedValue(fakeOrder);
  // 預設：Vendor service 正常
  addViolationPoint.mockResolvedValue({});
});

afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// POST /appeals
// ════════════════════════════════════════════════════════════
describe("POST /appeals", () => {
  test("admin 可以建立 appeal，employee_id 和 vendor_id 從 Order service 自動帶入", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1, reason: "餐點有問題" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.order_id).toBe(1);
    expect(res.body.employee_id).toBe(fakeOrder.employee_id);
    expect(res.body.vendor_id).toBe(fakeOrder.vendor_id);
    expect(getOrderById).toHaveBeenCalledWith(1);
    createdId = res.body.id;
  });

  test("employee 可以對自己的訂單申訴", async () => {
    // order 的 employee_id 是 2，empToken 的 userId 也是 2
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ order_id: 1, reason: "我要申訴" });

    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(2);
  });

  test("employee 不能對別人的訂單申訴，回傳 403", async () => {
    // order 的 employee_id 是 2，但 token 是 userId 99
    getOrderById.mockResolvedValue({ id: 1, employee_id: 2, vendor_id: 10 });
    const otherEmpToken = makeToken(99, "employee");

    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${otherEmpToken}`)
      .send({ order_id: 1, reason: "試圖申訴別人的單" });

    expect(res.status).toBe(403);
  });

  test("vendor 無法建立 appeal，回傳 403", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ order_id: 1, reason: "vendor 申訴" });

    expect(res.status).toBe(403);
  });

  test("缺少 reason 回傳 400，不會呼叫 Order service", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1 });

    expect(res.status).toBe(400);
    expect(getOrderById).not.toHaveBeenCalled();
  });

  test("缺少 order_id 回傳 400", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "沒有 order_id" });

    expect(res.status).toBe(400);
  });

  test("Order service 回傳 404，回傳 404", async () => {
    getOrderById.mockRejectedValue(new Error("Order 99 not found"));

    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 99, reason: "找不到的單" });

    expect(res.status).toBe(404);
  });

  test("Order service 掛掉，回傳 502", async () => {
    getOrderById.mockRejectedValue(new Error("Order service error 503: unknown"));

    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1, reason: "order service 掛了" });

    expect(res.status).toBe(502);
  });

  test("order 沒有 vendor_id 時，vendor_id 存 null", async () => {
    getOrderById.mockResolvedValue({ id: 5, employee_id: 2, vendor_id: null });

    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 5, reason: "沒有廠商的單" });

    expect(res.status).toBe(201);
    expect(res.body.vendor_id).toBeNull();
    noVendorId = res.body.id;
  });
});

// ════════════════════════════════════════════════════════════
// GET /appeals
// ════════════════════════════════════════════════════════════
describe("GET /appeals", () => {
  test("admin 可以取得所有 appeals", async () => {
    const res = await request(app)
      .get("/appeals")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .get("/appeals")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// GET /appeals/user/:userId
// ════════════════════════════════════════════════════════════
describe("GET /appeals/user/:userId", () => {
  test("本人可以取得自己的 appeals", async () => {
    const res = await request(app)
      .get("/appeals/user/2")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("admin 可以取得任何人的 appeals", async () => {
    const res = await request(app)
      .get("/appeals/user/2")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test("非本人回傳 403", async () => {
    const otherToken = makeToken(99, "employee");
    const res = await request(app)
      .get("/appeals/user/2")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// PATCH /appeals/:id
// ════════════════════════════════════════════════════════════
describe("PATCH /appeals/:id", () => {
  test("admin 可以審核 appeal（approved），同時呼叫 violation-points", async () => {
    const res = await request(app)
      .patch(`/appeals/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved", refund_amount: 150, admin_notes: "確認退款" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.refund_amount).toBe(150);
    expect(addViolationPoint).toHaveBeenCalledWith(fakeOrder.vendor_id);
  });

  test("approved 但 vendor_id 為 null，不呼叫 violation-points", async () => {
    const res = await request(app)
      .patch(`/appeals/${noVendorId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(addViolationPoint).not.toHaveBeenCalled();
  });

  test("rejected 不呼叫 violation-points", async () => {
    // 先建一筆新的
    const created = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1, reason: "要被拒絕的" });

    const res = await request(app)
      .patch(`/appeals/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "rejected" });

    expect(res.status).toBe(200);
    expect(addViolationPoint).not.toHaveBeenCalled();
  });

  test("violation-points 失敗不影響審核結果，仍回傳 200", async () => {
    addViolationPoint.mockRejectedValue(new Error("Vendor service down"));

    const created = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1, reason: "violation 會失敗的" });

    const res = await request(app)
      .patch(`/appeals/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });

  test("status 不合法回傳 400", async () => {
    const res = await request(app)
      .patch(`/appeals/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "invalid_status" });

    expect(res.status).toBe(400);
  });

  test("非 admin 無法審核，回傳 403", async () => {
    const res = await request(app)
      .patch(`/appeals/${createdId}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ status: "approved" });

    expect(res.status).toBe(403);
  });

  test("不存在的 appeal 回傳 404", async () => {
    const res = await request(app)
      .patch("/appeals/9999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "rejected" });

    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════
// DELETE /appeals/:id
// ════════════════════════════════════════════════════════════
describe("DELETE /appeals/:id", () => {
  test("admin 可以刪除 appeal", async () => {
    const res = await request(app)
      .delete(`/appeals/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test("刪除不存在的回傳 404", async () => {
    const res = await request(app)
      .delete("/appeals/9999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test("非 admin 無法刪除，回傳 403", async () => {
    const created = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1, reason: "要被刪的" });

    const res = await request(app)
      .delete(`/appeals/${created.body.id}`)
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(403);
  });
});
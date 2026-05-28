/**
 * Appeal-Admin Service Tests
 * 執行: npm test
 */

process.env.DB_NAME = "appeal_admin_test_db";
process.env.JWT_SECRET = "test_secret";
process.env.PORT = "3099";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const pool = require("../src/db/pool");

const makeToken = (userId, role) =>
  jwt.sign({ userId, role, email: `${role}@test.com` }, "test_secret");

const adminToken = makeToken(1, "admin");
const empToken = makeToken(2, "employee");
const vendorToken = makeToken(3, "vendor");

let createdId = null;

beforeAll(async () => {
  await pool.query("TRUNCATE appeals RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// Create
// ════════════════════════════════════════════════════════════
describe("POST /appeals", () => {
  test("admin 可以建立 appeal", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1, employee_id: 2, reason: "餐點有問題" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    createdId = res.body.id;
  });

  test("employee 可以建立自己的 appeal", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ order_id: 2, employee_id: 2, reason: "我要申訴" });
    expect(res.status).toBe(201);
  });

  test("employee 不能用別人的 employee_id，回傳 403", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ order_id: 3, employee_id: 99, reason: "假冒他人" });
    expect(res.status).toBe(403);
  });

  test("vendor 無法建立 appeal，回傳 403", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ order_id: 4, reason: "vendor 申訴" });
    expect(res.status).toBe(403);
  });

  test("缺少 order_id 或 reason 回傳 400", async () => {
    const res = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 1 });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════
// GetAll
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
// GetByUser
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
// Update (審核)
// ════════════════════════════════════════════════════════════
describe("PATCH /appeals/:id", () => {
  test("admin 可以審核 appeal", async () => {
    const res = await request(app)
      .patch(`/appeals/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved", refund_amount: 150, admin_notes: "確認退款" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.refund_amount).toBe(150);
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
// Delete
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
    const n = await request(app)
      .post("/appeals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ order_id: 5, reason: "要被刪的" });

    const res = await request(app)
      .delete(`/appeals/${n.body.id}`)
      .set("Authorization", `Bearer ${empToken}`);
    expect(res.status).toBe(403);
  });
});

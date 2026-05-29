/**
 * Notification Service Tests
 * 執行: npm test
 */

process.env.DB_NAME = "notification_test_db";
process.env.PORT = "3099";

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db/pool");

const adminAuth = {
  "X-User-Id": "1",
  "X-User-Role": "admin",
  "X-User-Email": "admin@test.com"
};

const employeeAuth = {
  "X-User-Id": "2",
  "X-User-Role": "employee",
  "X-User-Email": "employee@test.com"
};
let createdId = null;

beforeAll(async () => {
  await pool.query("TRUNCATE notifications RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// Create
// ════════════════════════════════════════════════════════════
describe("POST /notifications", () => {
  test("admin 可以建立通知", async () => {
    const res = await request(app)
      .post("/notifications")
      .set(adminAuth)
      .send({ user_id: 2, title: "測試通知", content: "內容" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("測試通知");
    expect(res.body.is_read).toBe(false);
    createdId = res.body.id;
  });

  test("employee 可以建立通知", async () => {
    const res = await request(app)
      .post("/notifications")
      .set(employeeAuth)
      .send({ user_id: 2, title: "員工通知", content: "內容" });
    expect(res.status).toBe(201);
  });

  test("缺少 title 回傳 400", async () => {
    const res = await request(app)
      .post("/notifications")
      .set(adminAuth)
      .send({ user_id: 2 });
    expect(res.status).toBe(400);
  });

  test("沒有 token 回傳 401", async () => {
    const res = await request(app)
      .post("/notifications")
      .send({ user_id: 2, title: "test" });
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// GetAll
// ════════════════════════════════════════════════════════════
describe("GET /notifications", () => {
  test("admin 可以取得所有通知", async () => {
    const res = await request(app)
      .get("/notifications")
      .set(adminAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .get("/notifications")
      .set(employeeAuth);
    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// GetByUser
// ════════════════════════════════════════════════════════════
describe("GET /notifications/user/:userId", () => {
  test("本人可以取得自己的通知", async () => {
    const res = await request(app)
      .get("/notifications/user/2")
      .set(employeeAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("admin 可以取得任何人的通知", async () => {
    const res = await request(app)
      .get("/notifications/user/2")
      .set(adminAuth);
    expect(res.status).toBe(200);
  });

  test("非本人回傳 403", async () => {
    const otherAuth = {
      "X-User-Id": "3",
      "X-User-Role": "employee",
      "X-User-Email": "other@test.com"
    };
    const res = await request(app)
      .get("/notifications/user/2")
      .set(otherAuth);
    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
// UpdateIsRead
// ════════════════════════════════════════════════════════════
describe("PATCH /notifications/user/:userId/read", () => {
  test("本人可以標記全部為已讀", async () => {
    const res = await request(app)
      .patch("/notifications/user/2/read")
      .set(employeeAuth)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThan(0);
  });

  test("本人可以標記指定 id 為已讀", async () => {
    // 先建一筆
    const n = await request(app)
      .post("/notifications")
      .set(adminAuth)
      .send({ user_id: 2, title: "新通知" });

    const res = await request(app)
      .patch("/notifications/user/2/read")
      .set(employeeAuth)
      .send({ ids: [n.body.id] });
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════
// Delete
// ════════════════════════════════════════════════════════════
describe("DELETE /notifications/:id", () => {
  test("admin 可以刪除通知", async () => {
    const res = await request(app)
      .delete(`/notifications/${createdId}`)
      .set(adminAuth);
    expect(res.status).toBe(200);
  });

  test("刪除不存在的通知回傳 404", async () => {
    const res = await request(app)
      .delete("/notifications/9999")
      .set(adminAuth);
    expect(res.status).toBe(404);
  });

  test("非 admin 無法刪除，回傳 403", async () => {
    const n = await request(app)
      .post("/notifications")
      .set(adminAuth)
      .send({ user_id: 2, title: "要被刪的" });

    const res = await request(app)
      .delete(`/notifications/${n.body.id}`)
      .set(employeeAuth);
    expect(res.status).toBe(403);
  });
});

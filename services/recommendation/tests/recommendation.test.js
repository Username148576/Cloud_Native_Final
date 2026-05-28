/**
 * Recommendation Service Tests
 * 執行: npm test
 */

process.env.DB_NAME = "recommendation_test_db";
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

beforeAll(async () => {
  await pool.query("TRUNCATE user_preferences, recommendation_cache RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// user_preferences
// ════════════════════════════════════════════════════════════
describe("POST /recommendations/preferences", () => {
  test("admin 可以建立偏好", async () => {
    const res = await request(app)
      .post("/recommendations/preferences")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employee_id: 2, preference_tags: ["素食", "低卡"] });
    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(2);
    expect(res.body.preference_tags).toEqual(["素食", "低卡"]);
  });

  test("重複建立同一 employee 會 upsert", async () => {
    const res = await request(app)
      .post("/recommendations/preferences")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employee_id: 2, preference_tags: ["辣"] });
    expect(res.status).toBe(201);
    expect(res.body.preference_tags).toEqual(["辣"]);
  });

  test("非 admin 回傳 403", async () => {
    const res = await request(app)
      .post("/recommendations/preferences")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ employee_id: 2, preference_tags: [] });
    expect(res.status).toBe(403);
  });

  test("缺少 employee_id 回傳 400", async () => {
    const res = await request(app)
      .post("/recommendations/preferences")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ preference_tags: ["素食"] });
    expect(res.status).toBe(400);
  });
});

describe("GET /recommendations/preferences/user/:userId", () => {
  test("本人可以取得自己的偏好", async () => {
    const res = await request(app)
      .get("/recommendations/preferences/user/2")
      .set("Authorization", `Bearer ${empToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_id).toBe(2);
  });

  test("admin 可以取得任何人的偏好", async () => {
    const res = await request(app)
      .get("/recommendations/preferences/user/2")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("非本人回傳 403", async () => {
    const otherToken = makeToken(99, "employee");
    const res = await request(app)
      .get("/recommendations/preferences/user/2")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /recommendations/preferences/:employeeId", () => {
  test("admin 可以更新偏好", async () => {
    const res = await request(app)
      .patch("/recommendations/preferences/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ preference_tags: ["海鮮", "清淡"] });
    expect(res.status).toBe(200);
    expect(res.body.preference_tags).toEqual(["海鮮", "清淡"]);
  });

  test("不存在的 employeeId 回傳 404", async () => {
    const res = await request(app)
      .patch("/recommendations/preferences/9999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ preference_tags: [] });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /recommendations/preferences/:employeeId", () => {
  test("admin 可以刪除偏好", async () => {
    const res = await request(app)
      .delete("/recommendations/preferences/2")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("刪除不存在的回傳 404", async () => {
    const res = await request(app)
      .delete("/recommendations/preferences/9999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════
// recommendation_cache
// ════════════════════════════════════════════════════════════
describe("POST /recommendations/cache", () => {
  test("admin 可以建立 cache", async () => {
    const res = await request(app)
      .post("/recommendations/cache")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ employee_id: 2, recommended_menu_ids: [3, 7, 12], expired_at: "2026-12-31T00:00:00Z" });
    expect(res.status).toBe(201);
    expect(res.body.recommended_menu_ids).toEqual([3, 7, 12]);
  });
});

describe("GET /recommendations/cache/user/:userId", () => {
  test("本人可以取得自己的 cache", async () => {
    const res = await request(app)
      .get("/recommendations/cache/user/2")
      .set("Authorization", `Bearer ${empToken}`);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /recommendations/cache/:employeeId", () => {
  test("admin 可以更新 cache", async () => {
    const res = await request(app)
      .patch("/recommendations/cache/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ recommended_menu_ids: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.body.recommended_menu_ids).toEqual([1, 2]);
  });
});

describe("DELETE /recommendations/cache/:employeeId", () => {
  test("admin 可以刪除 cache", async () => {
    const res = await request(app)
      .delete("/recommendations/cache/2")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

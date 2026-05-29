/**
 * IAM Service Tests
 * 所有設定從環境變數讀取，不寫死任何 key 或密碼
 * 本機：在 .env 設定
 * CI：在 GitHub Actions workflow 的 env 區塊設定
 */

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db/pool");

// 💡 移除 token 變數，改用「模擬 Kong 注入的 Header」
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

let createdUserId = null;
let createdEmployeeId = null;

beforeAll(async () => {
  await pool.query("TRUNCATE users, employees RESTART IDENTITY CASCADE");

  const ADMIN_HASH    = "$2b$10$vt/DjInOx8FViufe9BGAUe/kxzqXeLLlx2VYbQ6/hTnu5LYpRxddy";
  const EMPLOYEE_HASH = "$2b$10$GllIQ94mfRXZceDU5D5uieoB1qvr93HfQpxvEscRLLR5A056/BA4.";

  await pool.query(`
    INSERT INTO users (email, password_hash, role) VALUES
    ('admin@test.com',    $1, 'admin'),
    ('employee@test.com', $2, 'employee')
  `, [ADMIN_HASH, EMPLOYEE_HASH]);

  await pool.query(`
    INSERT INTO employees (user_id, full_name, factory_zone, phone_number)
    VALUES (2, '測試員工', 'A區', '0912345678')
  `);
});

afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// Auth (這部分不用動，因為登入本來就是發放 Token 的邏輯)
// ════════════════════════════════════════════════════════════
describe("POST /auth/login", () => {
  test("admin 登入成功，回傳 token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.com", password: "admin123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined(); // 確保依然有產出 Token 給前端
    expect(res.body.role).toBe("admin");
  });

  test("employee 登入成功", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "employee@test.com", password: "employee123" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("employee");
  });

  test("密碼錯誤回傳 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.com", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  test("email 不存在回傳 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@test.com", password: "admin123" });
    expect(res.status).toBe(401);
  });

  test("缺少欄位回傳 400", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.com" });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════
// Users
// ════════════════════════════════════════════════════════════
describe("POST /users", () => {
  test("admin 可以建立新 user", async () => {
    const res = await request(app)
      .post("/users")
      .set(adminAuth) // 💡 直接塞入 mock headers
      .send({ email: "newuser@test.com", password: "pass123", role: "vendor" });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("newuser@test.com");
    createdUserId = res.body.id;
  });

  test("重複 email 回傳 409", async () => {
    const res = await request(app)
      .post("/users")
      .set(adminAuth)
      .send({ email: "newuser@test.com", password: "pass123", role: "vendor" });
    expect(res.status).toBe(409);
  });

  test("role 不合法回傳 400", async () => {
    const res = await request(app)
      .post("/users")
      .set(adminAuth)
      .send({ email: "x@test.com", password: "pass123", role: "superuser" });
    expect(res.status).toBe(400);
  });

  test("沒有 Gateway Headers 回傳 401", async () => {
    const res = await request(app)
      .post("/users")
      // 💡 不 .set(adminAuth) 來模擬繞過 Gateway 的情況
      .send({ email: "x@test.com", password: "pass123", role: "vendor" });
    expect(res.status).toBe(401);
  });

  test("employee 無法建立 user，回傳 403", async () => {
    const res = await request(app)
      .post("/users")
      .set(employeeAuth) // 💡 換成 employee 的 headers
      .send({ email: "x@test.com", password: "pass123", role: "vendor" });
    expect(res.status).toBe(403);
  });
});

describe("GET /users", () => {
  test("admin 可以取得所有 user", async () => {
    const res = await request(app)
      .get("/users")
      .set(adminAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("employee 無法取得所有 user，回傳 403", async () => {
    const res = await request(app)
      .get("/users")
      .set(employeeAuth);
    expect(res.status).toBe(403);
  });
});

describe("GET /users/:userId", () => {
  test("employee 可以取得自己的資料", async () => {
    const res = await request(app)
      .get("/users/2")
      .set(employeeAuth);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(2);
  });

  test("employee 無法取得別人的資料，回傳 403", async () => {
    const res = await request(app)
      .get("/users/1")
      .set(employeeAuth);
    expect(res.status).toBe(403);
  });

  test("不存在的 userId 回傳 404", async () => {
    const res = await request(app)
      .get("/users/9999")
      .set(adminAuth);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /users/:userId/password", () => {
  test("本人可以修改密碼", async () => {
    const res = await request(app)
      .patch("/users/2/password")
      .set(employeeAuth)
      .send({ oldPassword: "employee123", newPassword: "newpass456" });
    expect(res.status).toBe(200);
  });

  test("舊密碼錯誤回傳 401", async () => {
    const res = await request(app)
      .patch("/users/2/password")
      .set(employeeAuth)
      .send({ oldPassword: "wrongold", newPassword: "newpass456" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /users/:userId", () => {
  test("admin 可以刪除 user", async () => {
    const res = await request(app)
      .delete(`/users/${createdUserId}`)
      .set(adminAuth);
    expect(res.status).toBe(200);
  });

  test("刪除不存在的 user 回傳 404", async () => {
    const res = await request(app)
      .delete("/users/9999")
      .set(adminAuth);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════
// Employees
// ════════════════════════════════════════════════════════════
describe("POST /employees", () => {
  test("admin 可以建立 employee", async () => {
    const userRes = await request(app)
      .post("/users")
      .set(adminAuth)
      .send({ email: "emp2@test.com", password: "pass123", role: "employee" });

    const res = await request(app)
      .post("/employees")
      .set(adminAuth)
      .send({ user_id: userRes.body.id, full_name: "李小華", factory_zone: "B區", phone_number: "0923456789" });
    expect(res.status).toBe(201);
    createdEmployeeId = res.body.id;
  });
});

describe("GET /employees", () => {
  test("admin 可以取得所有 employee", async () => {
    const res = await request(app)
      .get("/employees")
      .set(adminAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /employees/user/:userId", () => {
  test("employee 可以取得自己的資料", async () => {
    const res = await request(app)
      .get("/employees/user/2")
      .set(employeeAuth);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(2);
  });
});

describe("PATCH /employees/user/:userId/phone", () => {
  test("employee 可以更新自己的電話", async () => {
    const res = await request(app)
      .patch("/employees/user/2/phone")
      .set(employeeAuth)
      .send({ phone_number: "0999888777" });
    expect(res.status).toBe(200);
    expect(res.body.phone_number).toBe("0999888777");
  });
});

describe("PATCH /employees/:id", () => {
  test("admin 可以更新 employee 資料", async () => {
    const res = await request(app)
      .patch("/employees/1")
      .set(adminAuth)
      .send({ full_name: "更新名字", factory_zone: "C區" });
    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe("更新名字");
  });
});

describe("DELETE /employees/:id", () => {
  test("admin 可以刪除 employee", async () => {
    const res = await request(app)
      .delete(`/employees/${createdEmployeeId}`)
      .set(adminAuth);
    expect(res.status).toBe(200);
  });
});
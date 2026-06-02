# 企業訂餐系統 — 微服務後端

## 整體架構
 
```
                   +-------------------------------+
                   |       Browser / Client        |
                   |      http://EC2-D:8080        |
                   +---------------+---------------+
                                   |
                        HTTP EC2-A:8000 (all APIs)
                                   |
                                   v
+-----------------------------------------------------------------+
|                        EC2-A  (Public IP)                       |
|                                                                 |
|  +-----------------------------------------------------------+  |
|  |                Kong API Gateway  :8000                    |  |
|  |                                                           |  |
|  |  JWT verify         Rate limit 60/min/IP                  |  |
|  |  CORS preflight     X-User-* header inject                |  |
|  +--------+---------------------------+----------------------+  |
|           |                           |                         |
|   /iam  /notification          /order  /vendor-menu             |
|   /recommendation              /register                        |
|   /billing  /appeal-admin                                       |
|           |                           |                         |
|           v                           v                         |
|  +---------------------+    +----------------------+            |
|  |  Microservices (PM2)|    |  VPC internal forward|            |
|  |                     |    |  via Private IP      |            |
|  |  IAM          :3001 |    +----------+-----------+            |
|  |  Notification :3002 |               |                        |
|  |  Recommendation:3003|               |                        |
|  |  Billing      :3004 |               |                        |
|  |  Appeal-Admin :3005 |               |                        |
|  +----------+----------+               |                        |
|             |                          |                        |
|             | SSL                      |  VPC Private Network   |
|             v                          |                        |
|  +---------------------+               |                        |
|  |   RDS PostgreSQL    |               |                        |
|  |   (Private Subnet)  |               |                        |
|  |                     |               |                        |
|  |  iam_db             |               |                        |
|  |  notification_db    |               |                        |
|  |  recommendation_db  |               |                        |
|  |  billing_db         |               |                        |
|  |  appeal_admin_db    |               |                        |
|  +---------------------+               |                        |
|                                        |                        |
+----------------------------------------+------------------------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    v                                         v
     +--------------------------+             +--------------------------+
     |  EC2-B  (Private IP)     |             |  EC2-C  (Private IP)     |
     |                          |             |                          |
     |  Vendor-Menu  :3007      |             |  Order Service  :3006    |
     |  Register     :3008      |             |                          |
     |                          |             +--------------------------+
     |  +--------------------+  |
     |  |     AWS S3         |  |
     |  |  menu images       |  |
     |  |  vendor docs       |  |
     |  +--------------------+  |
     +--------------------------+
```

## 服務一覽

| 服務 | Port | 資料庫 | 說明 |
|------|------|--------|------|
| IAM | 3001 | iam_db | 使用者、員工、登入、JWT 簽發 |
| Notification | 3002 | notification_db | 通知管理 |
| Recommendation | 3003 | recommendation_db | 推薦偏好與快取 |
| Billing | 3004 | billing_db | 帳單、廠商違規 |
| Appeal-Admin | 3005 | appeal_admin_db | 申訴管理 |

---

## 專案結構

```
.
├── .github/
│   └── workflows/
│       └── ci.yml              ← CI/CD Pipeline（自動測試 + 部署）
└── services/
    ├── shared/
    │   └── http/                ← 共用 request id、health/readiness、metrics、Gateway auth
    ├── monitoring/
    │   └── prometheus.yml       ← Prometheus scrape 設定
    ├── kong/
    |   └── kong.yml            ← API Gateway (Header轉換 + Rate Limit)
    ├── docker-compose.yml      ← 本機開發用：一鍵啟動所有服務 + DB
    ├── ecosystem.config.js     ← PM2 設定（生產環境用）
    ├── .env.example            ← 環境變數範本
    ├── scripts/
    │   ├── deploy.sh           ← EC2 部署腳本（CI 呼叫）
    │   └── init-db.sh          ← 首次部署時初始化 DB
    ├── iam/
    │   ├── Dockerfile
    │   ├── schema.sql
    │   ├── seed.sql            ← 測試用初始資料
    │   ├── package.json
    │   ├── index.js
    │   ├── src/
    │   │   ├── app.js
    │   │   ├── controllers/
    │   │   ├── middleware/     ← auth.js, mailer.js
    │   │   ├── routes/
    │   │   └── db/pool.js
    │   └── tests/
    │       └── iam.test.js
    ├── notification/           （同上結構）
    ├── recommendation/         （同上結構，多 middleware/engine.js、orderService.js、menuService.js）
    ├── billing/                （同上結構，多 middleware/orderService.js）
    └── appeal-admin/           （同上結構，多 middleware/orderService.js、menuService.js）
```

---

## 平台可靠性與可觀測性

五個微服務共用 `services/shared/http` 平台層，避免每個服務重複維護同一套 Gateway 驗證、錯誤處理與健康檢查邏輯。之後若要新增「評價系統」等新服務，只要複製既有服務結構並接上共用平台層，就能直接具備相同的基本能力。

| Endpoint | 用途 | 說明 |
|----------|------|------|
| `GET /health` | Liveness | 確認服務 process 存活，回傳服務名稱、版本、啟動時間與 uptime |
| `GET /ready` | Readiness | 執行 `SELECT 1` 檢查資料庫連線，部署與容器 healthcheck 使用此端點 |
| `GET /metrics` | Monitoring | 輸出 Prometheus 格式 metrics，包含 request count 與平均延遲 |

其他可靠性設計：

- 每個請求都會產生或沿用 `X-Request-Id`，錯誤回應也會帶回 request id，方便從 API Gateway、PM2 log 追查問題。
- Docker Compose 與 Dockerfile 都使用 `/ready` 作為 healthcheck，避免資料庫斷線時仍被判定為健康。
- `monitoring/prometheus.yml` 可讓 Prometheus 定期抓取五個服務的 `/metrics`。
- 部署腳本最後會逐一檢查五個服務的 `/ready`，任一服務未 ready 就讓部署流程失敗。

---

## 評分標準對照

| 評分項目 | 專案落地做法 |
|----------|--------------|
| 程式碼品質 | 共用 `shared/http` 平台層統一 Gateway auth、request id、錯誤處理、健康檢查與 metrics；各服務使用 lockfile 與 `npm ci` 建置，依賴版本可重現 |
| 架構設計與可擴展性 | 每個服務獨立資料庫 schema、獨立 controller/routes/db 分層，Kong 統一路由與驗證；新增服務可沿用共用平台層與既有資料夾結構 |
| 系統測試與驗證 | Jest + Supertest 覆蓋各服務 CRUD、權限、跨服務 mock、推薦引擎，並新增平台端點契約測試；CI 會在 PostgreSQL container 中自動建表與測試 |
| 運維與可靠性 | EC2 + PM2 zero-downtime reload、RDS SSL、Kong rate limit/CORS/JWT、`/ready` 深度健康檢查、Prometheus `/metrics`、部署後 smoke check |

---

## CI/CD 流程

Push 到 `main` 或開 PR 時，GitHub Actions 自動執行兩個 Job：

```
push / PR to main
    │
    ▼
┌─────────────────┐
│   Job 1: Test   │  在 ubuntu-latest runner 上
│                 │  為每個服務起一個臨時 PostgreSQL container
│  IAM            │  自動建表（schema.sql）→ 跑 Jest
│  Notification   │  所有服務測試通過才進下一步
│  Recommendation │
│  Billing        │
│  Appeal-Admin   │
└────────┬────────┘
         │ (僅 push to main)
         ▼
┌──────────────────┐
│  Job 2: Deploy   │  SSH 進 EC2
│                  │  1. 把 GitHub Secrets 寫成 ~/.config/ordering/.env
│                  │  2. git pull origin main
│                  │  3. 首次：bash scripts/deploy.sh --init（初始化 RDS）
│                  │     之後：bash scripts/deploy.sh（更新重啟）
│                  │  4. pm2 reload（zero-downtime）
│                  │  5. Readiness 檢查 /ready
└──────────────────┘
```

> PR 只跑測試，不部署。部署只在測試全過後才觸發。

### GitHub Secrets 必填清單

| Secret | 說明 |
|--------|------|
| `JWT_SECRET` | 所有服務共用的 JWT 簽名金鑰 |
| `EC2_HOST` | EC2 公網 IP 或域名 |
| `EC2_SSH_KEY` | EC2 的 SSH 私鑰（PEM 格式） |
| `DB_PASSWORD` | DB 密碼 |
| `RDS_HOST` | RDS PostgreSQL endpoint |
| `RDS_PASS` | RDS 密碼 |
| `SMTP_USER` | Gmail 帳號 |
| `SMTP_PASS` | Gmail App Password |
| `EMAIL_FROM` | 寄件者地址 |
| `INTERNAL_ADMIN_PASSWORD` | 跨服務呼叫用 admin 密碼 |
| `ORDER_SERVICE_URL` | 其他組的 Order service URL |
| `MENU_SERVICE_URL` | 其他組的 Menu service URL |

---

## 本機開發

### 方式一：Docker Compose（推薦）

所有服務 + 所有 DB 一次啟動，不需要手動建資料庫。

```bash
cd services/

# 複製並填入環境變數
cp .env.example .env

# 啟動所有服務
docker compose up --build

# 背景執行
docker compose up --build -d

# 查看特定服務 log
docker compose logs -f iam

# Prometheus 監控頁面
# http://localhost:9090

# 停止
docker compose down

# 停止並清除 DB 資料
docker compose down -v
```

### 方式二：本機直接跑

**Step 1：建立資料庫**

```sql
CREATE DATABASE iam_db;
CREATE DATABASE notification_db;
CREATE DATABASE recommendation_db;
CREATE DATABASE billing_db;
CREATE DATABASE appeal_admin_db;
```

**Step 2：建立資料表**

```bash
psql -U myuser -d iam_db            -f services/iam/schema.sql
psql -U myuser -d notification_db   -f services/notification/schema.sql
psql -U myuser -d recommendation_db -f services/recommendation/schema.sql
psql -U myuser -d billing_db        -f services/billing/schema.sql
psql -U myuser -d appeal_admin_db   -f services/appeal-admin/schema.sql
```

**Step 3：建立初始資料**

```bash
psql -U myuser -d iam_db -f services/iam/seed.sql
```

seed.sql 建立的帳號：

| email | 密碼 | role |
|-------|------|------|
| admin1@test.com | admin123 | admin |

**Step 4：設定環境變數**

每個服務資料夾都有 `.env.example`，複製後填入：

```bash
cp services/iam/.env.example services/iam/.env
# ... 其他服務同理
```

> **重要：** 所有服務的 `JWT_SECRET` 必須設定為同一個值。

**Step 5：啟動服務**

```bash
cd services/iam && npm install && npm run dev
cd services/notification && npm install && npm run dev
cd services/recommendation && npm install && npm run dev
cd services/billing && npm install && npm run dev
cd services/appeal-admin && npm install && npm run dev
```

---

## 生產環境架構（AWS）

```
Internet
    ↓
EC2 t3.micro (Ubuntu)
    ├── PM2 管理所有微服務（zero-downtime reload）
    ├── Elastic IP（固定公網 IP）
    └── ~/.config/ordering/.env（由 CI 每次部署時注入）
         ↓ SSL 連線
RDS PostgreSQL db.t4g.micro
（每個服務獨立的 DB，共用同一個 RDS instance）
```

各服務在 EC2 上以 PM2 Fork Mode 運行，log 寫到 `~/services/logs/`。

**PM2 常用指令（在 EC2 上）：**

```bash
pm2 status                        # 看所有服務狀態
pm2 logs                          # 看所有 log
pm2 logs iam                      # 看特定服務 log
pm2 logs iam --lines 100          # 看最近 100 行
pm2 reload ecosystem.config.js    # zero-downtime 重啟（更新後用）
pm2 restart iam                   # 重啟單一服務
```

**EC2 Security Group 需開放的 Port：**

| Port | 用途 |
|------|------|
| 22 | SSH |
| 3001 | IAM |
| 3002 | Notification |
| 3003 | Recommendation |
| 3004 | Billing |
| 3005 | Appeal-Admin |

> EC2 內部服務互相呼叫請用 `localhost`（同一台機器），連 RDS 用 Private IP / RDS endpoint。

---

## JWT 驗證流程

```
前端 → POST /auth/login → IAM Service → 回傳 JWT token
前端 → 之後所有請求帶 Header: Authorization: Bearer <token>
各服務 → 用相同 JWT_SECRET 驗證 token（不需查 DB，不需連 IAM）
```

JWT payload 結構：

```json
{ "userId": 1, "email": "user@example.com", "role": "admin" }
```

### Auth Middleware 使用方式

每個服務的 `src/middleware/auth.js` 提供三個函式：

```js
// 只驗登入（任何 role 都能過）
router.get("/", authenticate, handler)

// 限定角色
router.post("/", authenticate, authorize("admin"), handler)
router.post("/", authenticate, authorize("admin", "employee"), handler)

// 本人或 admin（比對 req.params.userId）
router.get("/user/:userId", authenticate, requireSelf, handler)
```

---

## 跨服務呼叫

### Billing ↔ Order Service

Billing service 建立帳單時，自動以 admin 身份呼叫 Order service 拉訂單資料：

```
POST /billing/statements
  → orderService.getOrdersByVendor(vendor_id, period)
  → 自動向 IAM 登入取得 admin token（token 過期前自動更新）
  → GET {ORDER_SERVICE_URL}/orders/vendor/:vendorId?period=2024-01
  → 計算 total_amount → 寫入 billing_statements
```

### Recommendation ↔ Order / Menu Service

Recommendation service 產生推薦時會呼叫 Order service 取得歷史訂單，以及 Menu service 取得菜單資料。

`.env` 相關設定：

```dotenv
IAM_SERVICE_URL=http://localhost:3001
ORDER_SERVICE_URL=http://localhost:3006    # 跟其他組對齊後填入
MENU_SERVICE_URL=http://localhost:3007    # 跟其他組對齊後填入
INTERNAL_ADMIN_EMAIL=admin1@test.com
INTERNAL_ADMIN_PASSWORD=admin123
```

---

## 測試

每個服務有獨立的測試，使用 **Jest + Supertest**。

CI 會在隔離的 PostgreSQL container 中自動跑測試，本機執行需先準備測試 DB：

```sql
CREATE DATABASE iam_test_db;
CREATE DATABASE notification_test_db;
CREATE DATABASE recommendation_test_db;
CREATE DATABASE billing_test_db;
CREATE DATABASE appeal_admin_test_db;

-- 執行各自的 schema.sql
psql -U myuser -d iam_test_db -f services/iam/schema.sql
-- ... 其他同理
```

**執行測試：**

```bash
# 一次執行全部服務測試
cd services && npm test

# 單一服務
cd services/iam && npm test

# 其他服務
cd services/notification && npm test
cd services/recommendation && npm test
cd services/billing && npm test
cd services/appeal-admin && npm test

# 部署後 smoke check：檢查每個服務的 /ready 與 /metrics
cd services && npm run smoke:health
```

**測試覆蓋範圍：**

| 服務 | 測試項目 |
|------|---------|
| IAM | 登入、建立/取得/更新/刪除 user、建立/取得/更新/刪除 employee、權限驗證、平台端點 |
| Notification | CRUD、已讀標記、角色權限、平台端點 |
| Recommendation | user_preferences CRUD、recommendation_cache CRUD、角色權限、推薦引擎、平台端點 |
| Billing | 帳單建立（含 mock Order service）、CRUD、502 錯誤處理、平台端點 |
| Appeal-Admin | CRUD、審核流程、employee 只能申訴自己的訂單、平台端點 |

> Billing 測試使用 `jest.mock` 把 Order service 的 HTTP call mock 掉，不需要真的啟動 Order service 就能跑。

平台端點測試會驗證 `/health`、`/ready`、`/metrics` 與 request id，確保運維與監控能力不是只停留在文件描述。

---

## API 端點總覽

### IAM (port 3001)

```
POST   /auth/login
GET    /auth/verify-email?token=xxx        ← 驗證 email 變更

POST   /users                              (admin)
GET    /users                              (admin)
GET    /users/:userId                      (self / admin)
PATCH  /users/:userId/password             (self)
PATCH  /users/:userId/email                (self，寄驗證信，通過才改)
DELETE /users/:userId                      (admin)

POST   /employees                          (admin)
GET    /employees                          (admin)
GET    /employees/user/:userId             (self / admin)
PATCH  /employees/:id                      (admin)
PATCH  /employees/user/:userId/phone       (self employee)
DELETE /employees/:id                      (admin)
```

### Notification (port 3002)

```
POST   /notifications                      (admin / employee / vendor)
GET    /notifications                      (admin)
GET    /notifications/user/:userId         (self / admin)
PATCH  /notifications/user/:userId/read    (self) — body: { ids: [1,2] } 或空 {} 全部已讀
DELETE /notifications/:id                  (admin)
```

### Recommendation (port 3003)

```
GET   /recommendations/for/:id             (admin / self)
```

### Billing (port 3004)

```
POST   /billing/statements                 (admin) — 自動從 Order service 拉資料
GET    /billing/statements                 (admin)
GET    /billing/statements/user/:userId    (self vendor / admin)
DELETE /billing/statements/:id             (admin)

POST   /billing/incidents                  (admin)
GET    /billing/incidents                  (admin)
GET    /billing/incidents/user/:userId     (self vendor / admin)
PATCH  /billing/incidents/:id              (admin)
DELETE /billing/incidents/:id              (admin)
```

### Appeal-Admin (port 3005)

```
POST   /appeals                            (admin / employee)
GET    /appeals                            (admin)
GET    /appeals/user/:userId               (self / admin)
PATCH  /appeals/:id                        (admin) — 審核，可帶 status / refund_amount / admin_notes
DELETE /appeals/:id                        (admin)
```

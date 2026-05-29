/**
 * auth.js — JWT 驗證 middleware
 *
 * 用法：
 *   authenticate          → 只驗證登入狀態
 *   authorize("admin")    → 只允許 admin
 *   authorize("admin", "employee") → 允許多種 role
 *   requireSelf           → userId 必須等於 token 裡的 userId（或 admin 可過）
 *
 * 所有微服務複製這個檔案就能用，只需要有相同的 JWT_SECRET。
 */

const authenticate = (req, res, next) => {
  // 從 Kong 的 post-function 注入的 Header 中讀取資訊
  // Express/Node 會將 header key 轉成小寫，因此要用不區分大小寫的方式讀取
  console.log("=== 收到請求的 Headers ===", req.headers);
  const userId = req.get("X-User-Id");
  const role = req.get("X-User-Role");
  const email = req.get("X-User-Email");

  // 安全檢查：如果沒有這些 Header，代表請求可能繞過了 Gateway 直連後端
  if (!userId || !role) {
    return res.status(401).json({ error: "Missing identity headers from Gateway" });
  }

  // 將資料掛載到 req.user，讓後續的 authorize 和 requireSelf 繼續運作
  req.user = {
    userId: parseInt(userId, 10), // 注意：Header 傳過來的是字串，記得轉型
    role: role,
    email: email
  };
  
  next();
};

// ── 2. 角色授權 ───────────────────────────────────────────────
// 用法: authorize("admin") 或 authorize("admin", "employee")
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  }
  next();
};

// ── 3. 本人或 admin ───────────────────────────────────────────
// 比對 req.params.userId 與 token 裡的 userId
// admin 可以存取任何人
const requireSelf = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const paramId = parseInt(req.params.userId, 10);
  if (req.user.role === "admin" || req.user.userId === paramId) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden: not your resource" });
};

module.exports = { authenticate, authorize, requireSelf };

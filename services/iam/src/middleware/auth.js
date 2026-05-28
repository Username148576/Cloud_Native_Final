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

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// ── 1. 驗證 token 是否有效 ────────────────────────────────────
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
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

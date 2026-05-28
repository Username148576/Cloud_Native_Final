// 與 IAM service 的 auth.js 完全相同
// 複製到每個微服務，只需共享 JWT_SECRET 環境變數

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing or invalid token" });

  try {
    req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  next();
};

const requireSelf = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const paramId = parseInt(req.params.userId, 10);
  if (req.user.role === "admin" || req.user.userId === paramId) return next();
  return res.status(403).json({ error: "Forbidden: not your resource" });
};

module.exports = { authenticate, authorize, requireSelf };

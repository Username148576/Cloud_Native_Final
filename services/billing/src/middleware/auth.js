const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const authenticate = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  const email = req.headers["x-user-email"];
  if (!userId || !role) {
    return res.status(401).json({ error: "Missing identity headers from Gateway" });
  }
  req.user = {
    userId: parseInt(userId, 10), // 注意：Header 傳過來的是字串，記得轉型
    role: role,
    email: email
  };
  next();
};
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden: insufficient role" });
  next();
};
const requireSelf = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = parseInt(req.params.userId, 10);
  if (req.user.role === "admin" || req.user.userId === id) return next();
  return res.status(403).json({ error: "Forbidden: not your resource" });
};
module.exports = { authenticate, authorize, requireSelf };

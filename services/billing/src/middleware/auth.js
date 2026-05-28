const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const authenticate = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Missing or invalid token" });
  try { req.user = jwt.verify(h.split(" ")[1], JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Token expired or invalid" }); }
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

const readGatewayIdentity = (req) => {
  const userId = req.get("X-User-Id");
  const role = req.get("X-User-Role");
  const email = req.get("X-User-Email");
  const parsedUserId = Number.parseInt(userId, 10);

  if (!userId || !role || !Number.isFinite(parsedUserId)) {
    return null;
  }

  return {
    userId: parsedUserId,
    role,
    email,
  };
};

const authenticate = (req, res, next) => {
  const identity = readGatewayIdentity(req);

  if (!identity) {
    return res.status(401).json({ error: "Missing identity headers from Gateway" });
  }

  req.user = identity;
  return next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: insufficient role" });
  }

  return next();
};

const requireSelf = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const paramId = Number.parseInt(req.params.userId, 10);
  if (req.user.role === "admin" || req.user.userId === paramId) {
    return next();
  }

  return res.status(403).json({ error: "Forbidden: not your resource" });
};

module.exports = {
  authenticate,
  authorize,
  requireSelf,
};

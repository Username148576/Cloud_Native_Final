const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// POST /auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });

  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, role FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ token, role: user.role, userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
};

// GET /auth/verify-email?token=xxx
const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    const result = await pool.query(
      `SELECT id, pending_email FROM users
       WHERE email_verify_token = $1 AND email_verify_expires > NOW()`,
      [token]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ error: "Token invalid or expired" });

    const { id, pending_email } = result.rows[0];
    await pool.query(
      `UPDATE users
       SET email = $1, pending_email = NULL,
           email_verify_token = NULL, email_verify_expires = NULL
       WHERE id = $2`,
      [pending_email, id]
    );

    res.json({ message: "Email updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
};

module.exports = { login, verifyEmail };

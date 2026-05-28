const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../db/pool");
const { sendEmailVerification } = require("../middleware/mailer");

// POST /users  (admin)
const createUser = async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role)
    return res.status(400).json({ error: "email, password, role required" });
  if (!["admin", "employee", "vendor"].includes(role))
    return res.status(400).json({ error: "Invalid role" });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at",
      [email, hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already exists" });
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
};

// GET /users  (admin)
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, last_login_at, created_at FROM users ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// GET /users/:userId  (self or admin)
const getUserById = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT id, email, role, last_login_at, created_at FROM users WHERE id = $1",
      [userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// PATCH /users/:userId/password  (self)
const updatePassword = async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return res.status(400).json({ error: "oldPassword and newPassword required" });

  try {
    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Incorrect current password" });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update password" });
  }
};

// PATCH /users/:userId/email  (self) — 寄驗證信，通過後才改
const requestEmailUpdate = async (req, res) => {
  const { userId } = req.params;
  const { newEmail } = req.body;
  if (!newEmail) return res.status(400).json({ error: "newEmail required" });

  try {
    // 確認新 email 沒人用
    const conflict = await pool.query("SELECT id FROM users WHERE email = $1", [newEmail]);
    if (conflict.rows.length > 0)
      return res.status(409).json({ error: "Email already in use" });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `UPDATE users
       SET pending_email = $1, email_verify_token = $2, email_verify_expires = $3
       WHERE id = $4`,
      [newEmail, token, expires, userId]
    );

    await sendEmailVerification(newEmail, token);
    res.json({ message: "Verification email sent. Please check your inbox." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send verification email" });
  }
};

// DELETE /users/:userId  (admin)
const deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

module.exports = { createUser, getAllUsers, getUserById, updatePassword, requestEmailUpdate, deleteUser };

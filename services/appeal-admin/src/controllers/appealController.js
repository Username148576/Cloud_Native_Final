const pool = require("../db/pool");

// POST /appeals  (admin, employee)
const createAppeal = async (req, res) => {
  const { order_id, vendor_id, employee_id, reason } = req.body;
  if (!order_id || !reason)
    return res.status(400).json({ error: "order_id and reason required" });

  // employee 只能建立自己的 appeal
  if (req.user.role === "employee") {
    const bodyEmployeeId = parseInt(employee_id, 10);
    if (!bodyEmployeeId || bodyEmployeeId !== req.user.userId) {
      return res.status(403).json({ error: "employee_id must match your own userId" });
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO appeals (order_id, vendor_id, employee_id, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [order_id, vendor_id || null, employee_id || null, reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create appeal" });
  }
};

// GET /appeals  (admin)
const getAllAppeals = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM appeals ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appeals" });
  }
};

// GET /appeals/user/:userId  (self or admin)
// 回傳該 user 相關的申訴（employee_id 或 vendor_id 符合）
const getAppealsByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM appeals
       WHERE employee_id = $1 OR vendor_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appeals" });
  }
};

// PATCH /appeals/:id  (admin) — 審核結果
const updateAppeal = async (req, res) => {
  const { id } = req.params;
  const { status, refund_amount, admin_notes } = req.body;

  if (status && !["pending", "approved", "rejected"].includes(status))
    return res.status(400).json({ error: "Invalid status" });

  try {
    const result = await pool.query(
      `UPDATE appeals
       SET status        = COALESCE($1, status),
           refund_amount = COALESCE($2, refund_amount),
           admin_notes   = COALESCE($3, admin_notes)
       WHERE id = $4 RETURNING *`,
      [status, refund_amount, admin_notes, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Appeal not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update appeal" });
  }
};

// DELETE /appeals/:id  (admin)
const deleteAppeal = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM appeals WHERE id = $1 RETURNING id",
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Appeal not found" });
    res.json({ message: "Appeal deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete appeal" });
  }
};

module.exports = { createAppeal, getAllAppeals, getAppealsByUser, updateAppeal, deleteAppeal };

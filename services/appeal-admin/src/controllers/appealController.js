const pool = require("../db/pool");
const { addViolationPoint } = require("../middleware/vendorService");
const { getOrderById } = require("../middleware/orderService");

// POST /appeals  (admin, employee)
// Body: { order_id, reason }
// employee_id 和 vendor_id 自動從 Order service 查取
const createAppeal = async (req, res) => {
  const { order_id, reason } = req.body;
  if (!order_id || !reason)
    return res.status(400).json({ error: "order_id and reason required" });

  // 從 Order service 取訂單資料
  let order;
  try {
    order = await getOrderById(req, order_id);
  } catch (err) {
    if (err.message.includes("not found"))
      return res.status(404).json({ error: `Order ${order_id} not found` });
    console.error("[createAppeal] order service error:", err.message);
    return res.status(502).json({ error: "Failed to fetch order from Order service" });
  }

  const employee_id = order.employee_id || null;
  const vendor_id   = order.vendor_user_id   || null;

  // employee 只能對自己的訂單申訴
  if (req.user.role === "employee") {
    if (!employee_id || employee_id !== req.user.userId) {
      return res.status(403).json({ error: "You can only appeal your own orders" });
    }
  }

  console.log(`[createAppeal] Creating appeal for order ${order_id} (employee_id: ${employee_id}, vendor_id: ${vendor_id})`);

  try {
    const result = await pool.query(
      `INSERT INTO appeals (order_id, vendor_id, employee_id, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [order_id, vendor_id, employee_id, reason]
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
// approved + vendor_id 存在 → 自動呼叫 Vendor service 違規點數 +1
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

    const appeal = result.rows[0];

    if (status === "approved" && appeal.vendor_id) {
      try {
        await addViolationPoint(req, appeal.vendor_id);
        console.log(`[appeal] vendor ${appeal.vendor_id} violation point +1 (appeal ${id})`);
      } catch (err) {
        console.error(`[appeal] failed to add violation point for vendor ${appeal.vendor_id}:`, err.message);
      }
    }

    res.json(appeal);
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
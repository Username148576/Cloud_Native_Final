const pool = require("../db/pool");
const { getOrdersByVendor } = require("../middleware/orderService");

// ── billing_statements ───────────────────────────────────────

// POST /billing/statements  (admin)
// 自動去 Order Service 拉資料，計算總金額後建立帳單
const createStatement = async (req, res) => {
  const { vendor_id, statement_period } = req.body;
  if (!vendor_id || !statement_period)
    return res.status(400).json({ error: "vendor_id and statement_period required" });

  try {
    // 1. 向 Order service 取得該 vendor 的訂單
    const orders = await getOrdersByVendor(vendor_id, statement_period);

    // 2. 計算總金額（Order 資料裡有 total_price）
    const total_amount = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);

    // 3. 建立帳單
    const result = await pool.query(
      `INSERT INTO billing_statements (vendor_id, total_amount, statement_period)
       VALUES ($1, $2, $3) RETURNING *`,
      [vendor_id, total_amount, statement_period]
    );

    res.status(201).json({
      ...result.rows[0],
      order_count: orders.length,
    });
  } catch (err) {
    console.error(err);
    // 區分是 order service 連線失敗還是自己 DB 問題
    if (err.message.startsWith("Order service error")) {
      return res.status(502).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to create billing statement" });
  }
};

// GET /billing/statements  (admin)
const getAllStatements = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM billing_statements ORDER BY synced_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch statements" });
  }
};

// GET /billing/statements/user/:userId  (self vendor or admin)
// userId 這裡對應的是 vendor 的 user_id
const getStatementsByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM billing_statements WHERE vendor_id = $1 ORDER BY synced_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch statements" });
  }
};

// DELETE /billing/statements/:id  (admin)
const deleteStatement = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM billing_statements WHERE id = $1 RETURNING id",
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Statement deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete statement" });
  }
};

// ── vendor_incidents ─────────────────────────────────────────

// POST /billing/incidents  (admin)
const createIncident = async (req, res) => {
  const { vendor_id, description, deducted_points } = req.body;
  if (!vendor_id || !description)
    return res.status(400).json({ error: "vendor_id and description required" });

  try {
    const result = await pool.query(
      `INSERT INTO vendor_incidents (vendor_id, description, deducted_points)
       VALUES ($1, $2, $3) RETURNING *`,
      [vendor_id, description, deducted_points || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create incident" });
  }
};

// GET /billing/incidents  (admin)
const getAllIncidents = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vendor_incidents ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
};

// GET /billing/incidents/user/:userId  (self vendor or admin)
const getIncidentsByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM vendor_incidents WHERE vendor_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
};

// PATCH /billing/incidents/:id  (admin)
const updateIncident = async (req, res) => {
  const { id } = req.params;
  const { description, deducted_points } = req.body;
  try {
    const result = await pool.query(
      `UPDATE vendor_incidents
       SET description     = COALESCE($1, description),
           deducted_points = COALESCE($2, deducted_points)
       WHERE id = $3 RETURNING *`,
      [description, deducted_points, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update incident" });
  }
};

// DELETE /billing/incidents/:id  (admin)
const deleteIncident = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM vendor_incidents WHERE id = $1 RETURNING id",
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Incident deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete incident" });
  }
};

module.exports = {
  createStatement, getAllStatements, getStatementsByUser, deleteStatement,
  createIncident, getAllIncidents, getIncidentsByUser, updateIncident, deleteIncident,
};

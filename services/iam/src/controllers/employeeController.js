const pool = require("../db/pool");

// POST /employees  (admin)
const createEmployee = async (req, res) => {
  const { user_id, full_name, factory_zone, phone_number } = req.body;
  if (!user_id || !full_name)
    return res.status(400).json({ error: "user_id and full_name required" });

  try {
    const result = await pool.query(
      `INSERT INTO employees (user_id, full_name, factory_zone, phone_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, full_name, factory_zone, phone_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23503") return res.status(404).json({ error: "user_id not found" });
    console.error(err);
    res.status(500).json({ error: "Failed to create employee" });
  }
};

// GET /employees  (admin)
const getAllEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, u.email, u.role FROM employees e
       JOIN users u ON u.id = e.user_id ORDER BY e.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};

// GET /employees/user/:userId  (self or admin)
const getEmployeeByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM employees WHERE user_id = $1",
      [userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Employee not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
};

// PATCH /employees/:id  (admin) — update full_name, factory_zone
const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { full_name, factory_zone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE employees
       SET full_name    = COALESCE($1, full_name),
           factory_zone = COALESCE($2, factory_zone)
       WHERE id = $3 RETURNING *`,
      [full_name, factory_zone, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Employee not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update employee" });
  }
};

// PATCH /employees/user/:userId/phone  (self employee)
const updatePhone = async (req, res) => {
  const { userId } = req.params;
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ error: "phone_number required" });

  try {
    const result = await pool.query(
      "UPDATE employees SET phone_number = $1 WHERE user_id = $2 RETURNING *",
      [phone_number, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Employee not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update phone" });
  }
};

// DELETE /employees/:id  (admin)
const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM employees WHERE id = $1 RETURNING id", [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Employee not found" });
    res.json({ message: "Employee deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete employee" });
  }
};

module.exports = { createEmployee, getAllEmployees, getEmployeeByUser, updateEmployee, updatePhone, deleteEmployee };

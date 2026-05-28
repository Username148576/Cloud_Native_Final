const pool = require("../db/pool");

// POST /notifications  (admin, employee, vendor)
const createNotification = async (req, res) => {
  const { user_id, title, content } = req.body;
  if (!user_id || !title)
    return res.status(400).json({ error: "user_id and title required" });

  try {
    const result = await pool.query(
      "INSERT INTO notifications (user_id, title, content) VALUES ($1, $2, $3) RETURNING *",
      [user_id, title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create notification" });
  }
};

// GET /notifications  (admin)
const getAllNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notifications ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// GET /notifications/user/:userId  (self)
const getByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// PATCH /notifications/user/:userId/read  (self) — 把該 user 所有未讀設為已讀
const updateIsRead = async (req, res) => {
  const { userId } = req.params;
  // 可選：body 帶 ids 陣列只更新指定通知；不帶則全部標已讀
  const { ids } = req.body;

  try {
    let result;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      result = await pool.query(
        `UPDATE notifications SET is_read = TRUE
         WHERE user_id = $1 AND id = ANY($2::int[]) RETURNING *`,
        [userId, ids]
      );
    } else {
      result = await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 RETURNING *",
        [userId]
      );
    }
    res.json({ updated: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
};

// DELETE /notifications/:id  (admin)
const deleteNotification = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM notifications WHERE id = $1 RETURNING id",
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

module.exports = { createNotification, getAllNotifications, getByUser, updateIsRead, deleteNotification };

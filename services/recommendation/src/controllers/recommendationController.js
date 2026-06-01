const pool = require("../db/pool");
const { getRecentOrdersByEmployee } = require("../middleware/orderService");
const { getTodayMenus } = require("../middleware/menuService");
const { getfactoryZoneByEmployeeId } = require("../middleware/iamService");
const { recommend } = require("../middleware/engine");

// ── user_preferences ─────────────────────────────────────────

const createPreferences = async (req, res) => {
  const { employee_id, preference_tags } = req.body;
  if (!employee_id) return res.status(400).json({ error: "employee_id required" });
  try {
    const result = await pool.query(
      `INSERT INTO user_preferences (employee_id, preference_tags)
       VALUES ($1, $2)
       ON CONFLICT (employee_id) DO UPDATE SET preference_tags = EXCLUDED.preference_tags
       RETURNING *`,
      [employee_id, JSON.stringify(preference_tags || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create preferences" });
  }
};

const getPreferencesByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query("SELECT * FROM user_preferences WHERE employee_id = $1", [userId]);
    if (!result.rows[0]) return res.status(404).json({ error: "Preferences not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
};

const updatePreferences = async (req, res) => {
  const { employeeId } = req.params;
  const { preference_tags } = req.body;
  try {
    const result = await pool.query(
      `UPDATE user_preferences SET preference_tags = $1, last_calculation = NOW()
       WHERE employee_id = $2 RETURNING *`,
      [JSON.stringify(preference_tags), employeeId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Preferences not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update preferences" });
  }
};

const deletePreferences = async (req, res) => {
  const { employeeId } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM user_preferences WHERE employee_id = $1 RETURNING employee_id", [employeeId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Preferences deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete preferences" });
  }
};

// ── recommendation_cache ─────────────────────────────────────

const createCache = async (req, res) => {
  const { employee_id, recommended_menu_ids, expired_at } = req.body;
  if (!employee_id) return res.status(400).json({ error: "employee_id required" });
  try {
    const result = await pool.query(
      `INSERT INTO recommendation_cache (employee_id, recommended_menu_ids, expired_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_id) DO UPDATE
         SET recommended_menu_ids = EXCLUDED.recommended_menu_ids, expired_at = EXCLUDED.expired_at
       RETURNING *`,
      [employee_id, JSON.stringify(recommended_menu_ids || []), expired_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create cache" });
  }
};

const getCacheByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM recommendation_cache WHERE employee_id = $1", [userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Cache not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cache" });
  }
};

const updateCache = async (req, res) => {
  const { employeeId } = req.params;
  const { recommended_menu_ids, expired_at } = req.body;
  try {
    const result = await pool.query(
      `UPDATE recommendation_cache
       SET recommended_menu_ids = COALESCE($1, recommended_menu_ids),
           expired_at = COALESCE($2, expired_at)
       WHERE employee_id = $3 RETURNING *`,
      [recommended_menu_ids ? JSON.stringify(recommended_menu_ids) : null, expired_at, employeeId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Cache not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cache" });
  }
};

const deleteCache = async (req, res) => {
  const { employeeId } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM recommendation_cache WHERE employee_id = $1 RETURNING employee_id", [employeeId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Cache deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete cache" });
  }
};

// ── 核心推薦 API ──────────────────────────────────────────────

const getRecommendations = async (req, res) => {
  const employeeId = parseInt(req.params.userId, 10);
  try {
    // 1. 查 cache
    const cached = await pool.query(
      "SELECT * FROM recommendation_cache WHERE employee_id = $1 AND expired_at > NOW()",
      [employeeId]
    );
    console.log(`[recommendation] employee ${employeeId} cache hit: ${cached.rows.length > 0}`);
    if (cached.rows[0]) {
      return res.json({
        source: "cache",
        recommendations: cached.rows[0].recommended_menu_ids,
        expired_at: cached.rows[0].expired_at,
      });
    }

    // 2. 查 IAM 取得 factory zone
    const factoryZone = await getfactoryZoneByEmployeeId(req, employeeId);
    console.log(`[recommendation] employee ${employeeId} factory zone: ${factoryZone}`);

    // 3. 拿訂單（失敗不中斷，退化成熱門推薦）
    let orders = [];
    try {
      orders = await getRecentOrdersByEmployee(req, employeeId, 20);
    } catch (err) {
      console.warn(`Order service unavailable for employee ${employeeId}:`, err.message);
    }

    // 4. 拿今日菜單
    let menus = [];
    try {
      menus = await getTodayMenus(req, factoryZone);
    } catch (err) {
      return res.status(502).json({ error: `Menu service error: ${err.message}` });
    }

    if (menus.length === 0) {
      return res.json({ source: "live", recommendations: [], debug: { message: "今日無可用菜單" } });
    }

    // 5. 推薦引擎
    const { recommendations, debug } = recommend(orders, menus);

    // 6. 存 cache 到今天 23:59:59
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    await pool.query(
      `INSERT INTO recommendation_cache (employee_id, recommended_menu_ids, expired_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_id) DO UPDATE
         SET recommended_menu_ids = EXCLUDED.recommended_menu_ids, expired_at = EXCLUDED.expired_at`,
      [employeeId, JSON.stringify(recommendations), endOfDay]
    );

    // 7. 更新 user_preferences
    await pool.query(
      `INSERT INTO user_preferences (employee_id, preference_tags, last_calculation)
       VALUES ($1, $2, NOW())
       ON CONFLICT (employee_id) DO UPDATE SET last_calculation = NOW()`,
      [employeeId, JSON.stringify(debug.top_tags.map((t) => t.tag))]
    );

    res.json({ source: "live", recommendations, debug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
};

const refreshCache = async (req, res) => {
  const employeeId = parseInt(req.params.userId, 10);
  try {
    await pool.query("DELETE FROM recommendation_cache WHERE employee_id = $1", [employeeId]);
    res.json({ message: "Cache cleared, next request will recalculate" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to refresh cache" });
  }
};

module.exports = {
  createPreferences, getPreferencesByUser, updatePreferences, deletePreferences,
  createCache, getCacheByUser, updateCache, deleteCache,
  getRecommendations, refreshCache,
};

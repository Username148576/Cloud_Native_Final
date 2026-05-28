-- ============================================================
-- Recommendation Service Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  employee_id      INTEGER   PRIMARY KEY,  -- 邏輯關聯 IAM.employees.id
  preference_tags  JSONB     DEFAULT '[]',
  last_calculation TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendation_cache (
  employee_id          INTEGER   PRIMARY KEY,  -- 邏輯關聯 IAM.employees.id
  recommended_menu_ids JSONB     DEFAULT '[]',
  expired_at           TIMESTAMP
);

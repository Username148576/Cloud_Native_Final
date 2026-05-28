-- ============================================================
-- Notification Service Schema
-- 注意：user_id 是邏輯外鍵，實際 users 表在 IAM service
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL,  -- 邏輯關聯 IAM.users.id
  title      VARCHAR(255) NOT NULL,
  content    TEXT,
  is_read    BOOLEAN      DEFAULT FALSE,
  created_at TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- IAM Service Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'employee', 'vendor')),
  last_login_at  TIMESTAMP,
  -- email 驗證用
  pending_email        VARCHAR(255),
  email_verify_token   VARCHAR(255),
  email_verify_expires TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name    VARCHAR(255) NOT NULL,
  factory_zone VARCHAR(100),
  phone_number VARCHAR(50),
  created_at   TIMESTAMP DEFAULT NOW()
);

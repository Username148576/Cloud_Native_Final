-- ============================================================
-- Billing Service Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_statements (
  id               SERIAL PRIMARY KEY,
  vendor_id        INTEGER      NOT NULL,  -- 邏輯關聯 Vendor service
  total_amount     INTEGER      NOT NULL DEFAULT 0,
  statement_period VARCHAR(20)  NOT NULL,  -- 例如 "2024-01"
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'overdue')),
  synced_at        TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_incidents (
  id               SERIAL PRIMARY KEY,
  vendor_id        INTEGER   NOT NULL,
  description      TEXT      NOT NULL,
  deducted_points  INTEGER   NOT NULL DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_vendor ON billing_statements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_vendor ON vendor_incidents(vendor_id);

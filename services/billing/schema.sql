-- ============================================================
-- Billing Service Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_statements (
  id               SERIAL PRIMARY KEY,
  vendor_uuid      INTEGER      NOT NULL,  -- 邏輯關聯 Vendor service
  vendor_id        VARCHAR(32)  NOT NULL,
  total_amount     INTEGER      NOT NULL DEFAULT 0,
  statement_period VARCHAR(20)  NOT NULL,  -- 例如 "2024-01"
  synced_at        TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_vendor ON billing_statements(vendor_id);
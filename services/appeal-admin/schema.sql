-- ============================================================
-- Appeal-Admin Service Schema
-- 你加的 vendor_id 跟 employee_id 也補進來
-- ============================================================

CREATE TABLE IF NOT EXISTS appeals (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER   NOT NULL,          -- 邏輯關聯 Order service
  vendor_id      INTEGER,                     -- 邏輯關聯 Vendor service（你加的）
  employee_id    INTEGER,                     -- 邏輯關聯 IAM.employees.id（你加的）
  reason         TEXT      NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  refund_amount  INTEGER   DEFAULT 0,
  admin_notes    TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeals_order    ON appeals(order_id);
CREATE INDEX IF NOT EXISTS idx_appeals_vendor   ON appeals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_appeals_employee ON appeals(employee_id);

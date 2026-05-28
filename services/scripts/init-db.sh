#!/bin/bash
# ============================================================
# init-db.sh
# 連到 RDS，建立所有 database、table、初始資料
# 只需要執行一次，之後重新部署不需要再跑
#
# 使用方式：
#   bash init-db.sh
#
# 依賴環境變數（從 .env 讀取）：
#   RDS_HOST, RDS_USER, RDS_PASS
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 讀取 .env（CI 部署時放在 ~/.config/ordering/.env）
ENV_FILE="$HOME/.config/ordering/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "❌ 找不到 .env 檔案：$ENV_FILE"
  exit 1
fi

RDS_HOST="${RDS_HOST:?請在 .env 設定 RDS_HOST}"
RDS_USER="${RDS_USER:-postgres}"
RDS_PASS="${RDS_PASS:?請在 .env 設定 RDS_PASS}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:?請在 .env 設定 DB_PASSWORD}"

export PGPASSWORD="$RDS_PASS"

echo "========================================"
echo "  初始化 RDS 資料庫"
echo "  Host: $RDS_HOST"
echo "========================================"

# ── Step 1：建立所有 database ─────────────────────────────────
echo ""
echo "▶ Step 1：建立 databases..."

psql -h "$RDS_HOST" -U "$RDS_USER" -d postgres << SQL
-- 建立 app user（如果不存在）
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    RAISE NOTICE 'User $DB_USER created';
  ELSE
    RAISE NOTICE 'User $DB_USER already exists';
  END IF;
END
\$\$;

-- 建立各 database（如果不存在）
SELECT 'CREATE DATABASE iam_db OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iam_db')\gexec

SELECT 'CREATE DATABASE notification_db OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_db')\gexec

SELECT 'CREATE DATABASE recommendation_db OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'recommendation_db')\gexec

SELECT 'CREATE DATABASE billing_db OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'billing_db')\gexec

SELECT 'CREATE DATABASE appeal_admin_db OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'appeal_admin_db')\gexec

-- 授權
GRANT ALL PRIVILEGES ON DATABASE iam_db TO $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE recommendation_db TO $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE billing_db TO $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE appeal_admin_db TO $DB_USER;
SQL

echo "  ✅ Databases 建立完成"

# ── Step 2：建立 tables ───────────────────────────────────────
echo ""
echo "▶ Step 2：建立 tables..."

export PGPASSWORD="$DB_PASSWORD"

psql -h "$RDS_HOST" -U "$DB_USER" -d iam_db            -f "$SCRIPT_DIR/iam/schema.sql"
echo "  ✅ iam_db"

psql -h "$RDS_HOST" -U "$DB_USER" -d notification_db   -f "$SCRIPT_DIR/notification/schema.sql"
echo "  ✅ notification_db"

psql -h "$RDS_HOST" -U "$DB_USER" -d recommendation_db -f "$SCRIPT_DIR/recommendation/schema.sql"
echo "  ✅ recommendation_db"

psql -h "$RDS_HOST" -U "$DB_USER" -d billing_db        -f "$SCRIPT_DIR/billing/schema.sql"
echo "  ✅ billing_db"

psql -h "$RDS_HOST" -U "$DB_USER" -d appeal_admin_db   -f "$SCRIPT_DIR/appeal-admin/schema.sql"
echo "  ✅ appeal_admin_db"

# ── Step 3：寫入初始資料 ──────────────────────────────────────
echo ""
echo "▶ Step 3：寫入初始資料 (seed)..."

# 用 ON CONFLICT DO NOTHING 避免重複 insert 報錯
psql -h "$RDS_HOST" -U "$DB_USER" -d iam_db -f "$SCRIPT_DIR/iam/seed.sql" || true
echo "  ✅ Seed 完成"

echo ""
echo "========================================"
echo "  ✅ 資料庫初始化完成！"
echo "========================================"
#!/bin/bash
# ============================================================
# deploy.sh
# EC2 上的完整部署腳本
#
# 首次部署：  bash scripts/deploy.sh --init
# 更新部署：  bash scripts/deploy.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT_DIR/logs"
ENV_FILE="$HOME/.config/ordering/.env"
INIT_MODE=false

# 解析參數
if [ "$1" = "--init" ]; then
  INIT_MODE=true
fi

# ── 顏色輸出 ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo "========================================"
echo "  企業訂餐系統 — 部署腳本"
echo "  時間: $(date '+%Y-%m-%d %H:%M:%S')"
if [ "$INIT_MODE" = true ]; then
  echo "  模式: 首次部署 (--init)"
else
  echo "  模式: 更新部署"
fi
echo "========================================"

# ── 讀取 .env ────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  error ".env 不存在：$ENV_FILE"
fi
export $(grep -v '^#' "$ENV_FILE" | xargs)

# ── Step 1：建立 log 目錄 ─────────────────────────────────────
info "Step 1：建立 log 目錄..."
mkdir -p "$LOG_DIR"
success "Log 目錄：$LOG_DIR"

# ── Step 2：拉最新程式碼 ──────────────────────────────────────
info "Step 2：拉最新程式碼..."
REPO_DIR="$(cd "$ROOT_DIR" && git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/repo")"
cd "$REPO_DIR"
git pull origin main
success "程式碼已更新 ($(git log -1 --format='%h %s'))"

# ── Step 3：初始化資料庫（僅 --init 模式）────────────────────
if [ "$INIT_MODE" = true ]; then
  info "Step 3：初始化資料庫..."
  bash "$SCRIPT_DIR/init-db.sh"
  success "資料庫初始化完成"
else
  info "Step 3：跳過 DB 初始化"
fi

# ── Step 4：安裝套件 ──────────────────────────────────────────
info "Step 4：安裝 npm 套件..."
for svc in iam notification recommendation billing appeal-admin; do
  echo "  installing $svc..."
  cd "$ROOT_DIR/$svc"
  npm install --production --silent
done
cd "$ROOT_DIR"
success "所有套件安裝完成"

# ── Step 5：安裝根目錄依賴 ────────────────────────────────────
info "Step 5：安裝根目錄依賴..."
npm install --silent
success "根目錄依賴安裝完成"

# ── Step 6：啟動 / 重啟服務 ──────────────────────────────────
info "Step 6：啟動服務..."
if pm2 list | grep -q "iam"; then
  pm2 reload "$ROOT_DIR/ecosystem.config.js" --update-env
  echo "  已執行 reload（zero-downtime）"
else
  pm2 start "$ROOT_DIR/ecosystem.config.js"
  echo "  已啟動所有服務"
fi

# ── Step 7：設定開機自動啟動 ─────────────────────────────────
pm2 save
success "PM2 設定已儲存"

# ── Step 8：健康檢查 ──────────────────────────────────────────
info "Step 8：健康檢查（等待 10 秒服務啟動）..."
sleep 10

ALL_OK=true
for svc in iam:3001 notification:3002 recommendation:3003 billing:3004 appeal-admin:3005; do
  NAME="${svc%%:*}"
  PORT="${svc##*:}"
  if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo "  ✅ $NAME (:$PORT) — OK"
  else
    echo "  ❌ $NAME (:$PORT) — FAILED"
    ALL_OK=false
  fi
done

echo ""
echo "========================================"
pm2 status
echo "========================================"

if [ "$ALL_OK" = true ]; then
  echo ""
  success "部署完成！所有服務正常運行"
else
  echo ""
  warn "部分服務健康檢查失敗，請確認 log："
  echo "  pm2 logs --lines 50"
  exit 1
fi

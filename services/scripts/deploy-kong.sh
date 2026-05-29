#!/bin/bash
# scripts/deploy-kong.sh
# 部署或重新載入 Kong，把 JWT_SECRET 注入 kong.yml
#
# 使用方式：
#   bash scripts/deploy-kong.sh
#
# 需要環境變數：
#   JWT_SECRET  （跟 IAM service 的 JWT_SECRET 相同）

set -e

KONG_DIR="$HOME/kong"
RENDERED="$KONG_DIR/kong.rendered.yml"
ENV_FILE="$HOME/.config/ordering/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "❌ 找不到 .env 檔案：$ENV_FILE"
  exit 1
fi

JWT_SECRET="${JWT_SECRET:?請在 .env 設定 JWT_SECRET}"

echo "→ 產生 kong.rendered.yml..."
sed "s|\${JWT_SECRET}|$JWT_SECRET|g" "$KONG_DIR/kong.yml" > "$RENDERED"

# 如果 Kong 已在跑，reload；否則第一次啟動
if sudo docker ps --format '{{.Names}}' | grep -q '^kong$'; then
  echo "→ Kong 已在執行，執行 reload..."
  sudo docker cp "$RENDERED" kong:/kong.rendered.yml
  sudo docker exec kong kong reload
  echo "✅ Kong reload 完成"
else
  echo "→ 啟動 Kong..."
  sudo docker run -d \
    --name kong \
    --network host \
    -v "$RENDERED:/kong.yml" \
    -e KONG_DATABASE=off \
    -e KONG_DECLARATIVE_CONFIG=/kong.yml \
    -e KONG_PROXY_ACCESS_LOG=/dev/stdout \
    -e KONG_ADMIN_ACCESS_LOG=/dev/stdout \
    -e KONG_PROXY_ERROR_LOG=/dev/stderr \
    -e KONG_ADMIN_ERROR_LOG=/dev/stderr \
    -e KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    kong:latest
  echo "✅ Kong 啟動完成"
fi

# 健康檢查
echo "→ 健康檢查..."
sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/status)
if [ "$STATUS" = "200" ]; then
  echo "✅ Kong 正常，Admin API: http://localhost:8001"
  echo "   Proxy:     http://localhost:8000"
else
  echo "❌ Kong 健康檢查失敗（HTTP $STATUS），請查看 log："
  echo "   sudo docker logs kong"
  exit 1
fi
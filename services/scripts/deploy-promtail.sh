#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROMTAIL_DIR="$ROOT_DIR/monitoring/promtail"
ENV_FILE="$HOME/.config/ordering/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

LOKI_URL="${LOKI_URL:-http://172.31.2.29:3100/loki/api/v1/push}"
PROMTAIL_HOSTNAME="${PROMTAIL_HOSTNAME:-$(hostname)}"

if [ ! -f "$PROMTAIL_DIR/promtail-config.yml" ]; then
  echo "Promtail config not found: $PROMTAIL_DIR/promtail-config.yml"
  exit 1
fi

mkdir -p "$ROOT_DIR/logs"

export LOKI_URL
export PROMTAIL_HOSTNAME

if sudo docker compose version >/dev/null 2>&1; then
  sudo --preserve-env=LOKI_URL,PROMTAIL_HOSTNAME \
    docker compose -f "$PROMTAIL_DIR/docker-compose.promtail.yml" up -d
else
  sudo docker rm -f ordering-promtail >/dev/null 2>&1 || true
  sudo docker volume create ordering-promtail-data >/dev/null
  sudo docker run -d \
    --name ordering-promtail \
    --restart unless-stopped \
    -e "LOKI_URL=$LOKI_URL" \
    -e "HOSTNAME=$PROMTAIL_HOSTNAME" \
    -v "$PROMTAIL_DIR/promtail-config.yml:/etc/promtail/config.yml:ro" \
    -v "$ROOT_DIR/logs:/var/log/ordering:ro" \
    -v ordering-promtail-data:/var/lib/promtail \
    grafana/promtail:2.9.8 \
    -config.file=/etc/promtail/config.yml \
    -config.expand-env=true
fi

sleep 2

if ! sudo docker ps --format '{{.Names}}' | grep -q '^ordering-promtail$'; then
  echo "Promtail failed to start"
  sudo docker logs ordering-promtail || true
  exit 1
fi

echo "Promtail is shipping logs to $LOKI_URL"

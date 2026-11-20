#!/usr/bin/env bash
#
# Rollback manuel : rétablit la version précédente (/opt/app/.env.prev),
# ou un tag explicite passé en argument.
#
#   ./rollback.sh
#   ./rollback.sh sha-1a2b3c4
#
set -euo pipefail

cd "$(dirname "$0")"

WAIT_TIMEOUT="${WAIT_TIMEOUT:-90}"

if [ "${1:-}" != "" ]; then
  cp .env .env.prev 2>/dev/null || true
  echo "IMAGE_TAG=${1}" > .env
elif [ -f .env.prev ]; then
  cp .env .env.bak 2>/dev/null || true
  cp .env.prev .env
else
  echo "Aucun .env.prev et aucun tag fourni." >&2
  exit 1
fi

echo ">> rollback vers $(cat .env)"
docker compose pull
docker compose up -d --wait --wait-timeout "$WAIT_TIMEOUT"
echo ">> OK"

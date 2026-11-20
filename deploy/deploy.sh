#!/usr/bin/env bash
#
# Déploiement idempotent de gestipers sur le serveur (/opt/app).
# Appelé par la CI, ou manuellement en SSH.
#
#   ./deploy.sh <IMAGE_TAG>       ex: ./deploy.sh sha-1a2b3c4
#
# Secrets runtime : fichier /opt/app/.env.secrets (non versionné),
# chargé par docker-compose.yml (TURSO_*, GESTIPERS_API_SECRET, ARIA_*).
#
set -euo pipefail

cd "$(dirname "$0")"

NEW_TAG="${1:?Usage: deploy.sh <IMAGE_TAG>  (ex: sha-1a2b3c4)}"
ENV_FILE=".env"
PREV_FILE=".env.prev"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-90}"

up() { docker compose up -d --wait --wait-timeout "$WAIT_TIMEOUT"; }

[ -f "$ENV_FILE" ] && cp "$ENV_FILE" "$PREV_FILE"
echo "IMAGE_TAG=${NEW_TAG}" > "$ENV_FILE"

echo ">> pull ${NEW_TAG}"
docker compose pull

echo ">> up (attente healthcheck, ${WAIT_TIMEOUT}s)"
if up; then
  echo ">> OK — ${NEW_TAG} en ligne"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

echo "!! échec démarrage/healthcheck de ${NEW_TAG}"
if [ -f "$PREV_FILE" ]; then
  echo ">> rollback vers $(cat "$PREV_FILE")"
  cp "$PREV_FILE" "$ENV_FILE"
  docker compose pull
  up
  echo ">> rollback terminé — version précédente rétablie"
fi
exit 1

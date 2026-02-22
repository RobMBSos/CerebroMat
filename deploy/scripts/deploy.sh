#!/usr/bin/env bash
# CerebroMat — Manual deploy helper
# Usage: ./deploy.sh [--seed]
set -euo pipefail

APP_DIR="/opt/cerebromat"
COMPOSE="docker compose -f ${APP_DIR}/docker-compose.production.yml"

cd "$APP_DIR"

# Load env
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found in ${APP_DIR}"
  echo "Copy .env.production.example and fill in the values."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source .env.production
set +a

echo "==> Pulling latest images..."
$COMPOSE pull

echo "==> Ensuring database is running..."
$COMPOSE up -d postgres
$COMPOSE exec postgres sh -c 'until pg_isready -U $POSTGRES_USER; do sleep 1; done'

echo "==> Running database migrations..."
$COMPOSE run --rm api npx prisma migrate deploy

# Optional: seed database on first deploy
if [[ "${1:-}" == "--seed" ]]; then
  echo "==> Seeding database..."
  $COMPOSE run --rm api npx tsx prisma/seed.ts
fi

echo "==> Rolling restart (with health checks)..."
$COMPOSE up -d --no-deps --wait api
$COMPOSE up -d --no-deps --wait web
$COMPOSE up -d --no-deps --wait mobile
$COMPOSE up -d --no-deps --wait caddy

echo "==> Pruning old images..."
docker image prune -f

echo ""
echo "Deploy complete! Checking service health..."
$COMPOSE ps

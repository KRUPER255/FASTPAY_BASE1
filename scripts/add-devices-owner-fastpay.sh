#!/usr/bin/env bash
# Add the 6 devices for owner@fastpay.com and assign to all dashboards (ADMIN + REDPAY).
# Run from repo root: ./scripts/add-devices-owner-fastpay.sh
# Options: pass --no-sync to skip Firebase sync, or --owner-only to assign only to owner.
# Uses Docker if backend stack is running; otherwise runs manage.py locally.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="${REPO_ROOT}/BACKEND"

DEVICE_IDS="10657cd44bd5d227 39841d347b605455 426613fa87bdc6f9 60af718623d5f8ce 71e4fa3e11e00c68 e79f12871eee0edd"
EMAIL="owner@fastpay.com"

cd "$BACKEND"

# Use Docker if compose is available (run --rm = one-off container, works even if web is restarting)
# ENV_FILE=.env so the container uses BACKEND/.env (DB_* etc.); default compose uses .env.production
COMPOSE_FILE="-f docker-compose.yml"
if docker compose $COMPOSE_FILE ps 2>/dev/null | grep -q "web"; then
  echo "Running inside Docker (one-off container, ENV_FILE=.env)..."
  exec env ENV_FILE=.env docker compose $COMPOSE_FILE run --rm web python manage.py add_devices_for_owner $DEVICE_IDS --email "$EMAIL" "$@"
fi

# Fallback: run locally
echo "Running manage.py locally..."
exec python manage.py add_devices_for_owner $DEVICE_IDS --email "$EMAIL" "$@"

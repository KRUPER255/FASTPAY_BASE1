#!/bin/bash
#
# Run full Firebase → Django migration (devices, messages, notifications, contacts, users, user-device assignments).
# Loads env from .env.staging (or .env.production if you set ENV_FILE).
#
# Usage (from BACKEND/):
#   ./scripts/run_firebase_migration.sh [stage|prod] [--dry-run]
#
# From host when DB is in Docker: override DB_HOST so it resolves (e.g. Postgres port published):
#   DB_HOST=127.0.0.1 ./scripts/run_firebase_migration.sh stage
#
# Or with Docker (avoid file permission issues by passing credentials via env):
#   export FIREBASE_CREDENTIALS_JSON="$(cat firebase-credentials.json)"
#   docker compose run --rm -e ENV_FILE=.env.staging -e FIREBASE_CREDENTIALS_JSON web ./scripts/run_firebase_migration.sh stage
#
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

ENV_FILE="${ENV_FILE:-.env.staging}"
STAGE_FLAG="--stage"
EXTRA=()
for arg in "$@"; do
  case "$arg" in
    prod) STAGE_FLAG="--prod" ;;
    stage) STAGE_FLAG="--stage" ;;
    *) EXTRA+=("$arg") ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE (set ENV_FILE=... if needed)"
  exit 1
fi

echo "Loading env from $ENV_FILE"
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

PYTHON="${PYTHON:-python3}"
if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  PYTHON="$BACKEND_DIR/.venv/bin/python"
fi

echo ""
echo "=== Phase 1: Copy devices, messages, notifications, contacts ==="
"$PYTHON" manage.py copy_firebase_to_django $STAGE_FLAG "${EXTRA[@]}"

echo ""
echo "=== Phase 2: Migrate Firebase users → DashUser ==="
"$PYTHON" manage.py migrate_firebase_users_to_django "${EXTRA[@]}"

echo ""
echo "=== Phase 3: Migrate user–device assignments → Device.assigned_to ==="
"$PYTHON" manage.py migrate_firebase_user_devices_to_django "${EXTRA[@]}"

echo ""
echo "Migration finished."

#!/bin/bash
# Run the 4-device assign + data sync inside Docker (staging or default).
# Usage: ./scripts/run_assign_4_devices.sh [staging|default]
#   staging: use docker-compose.staging.yml (default)
#   default: use docker-compose.yml
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

MODE="${1:-staging}"
DEVICE_IDS="71e4fa3e11e00c68"
EMAIL="${ASSIGN_DEVICES_EMAIL:-admin@fastpay.com}"

if [[ "$MODE" == "staging" ]]; then
  COMPOSE_FILE="-f docker-compose.staging.yml"
  # Use existing staging project name so we attach to fastpay-staging-web-1
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-fastpay-staging}"
else
  COMPOSE_FILE="-f docker-compose.yml"
fi

echo "Using compose: $MODE"
echo "Checking that service 'web' is running..."
WEB_STATUS=$(docker compose $COMPOSE_FILE ps web --format "{{.Status}}" 2>/dev/null || true)
if [[ -z "$WEB_STATUS" || "$WEB_STATUS" != *"Up"* ]]; then
  echo "Service 'web' is not running. Start the stack first:"
  echo "  docker compose $COMPOSE_FILE up -d"
  exit 1
fi

echo "Running assign_devices_to_user (assign + sync from Firebase)..."
docker compose $COMPOSE_FILE exec web python manage.py assign_devices_to_user $DEVICE_IDS --email "$EMAIL"
echo "Done."

#!/bin/bash
#
# Add Firebase data into the backend (Django).
# Firebase device_id and backend Device.device_id are the same; devices are
# matched by this id when copying.
#
# Runs: copy_firebase_to_django --stage | --prod
#   - Staging: fastpay/testing/{deviceId}
#   - Production: device/{deviceId}, fastpay/running/{deviceId}
#
# Usage (run from BACKEND/ or repo root):
#   ./scripts/add_firebase_data_to_backend.sh [stage|prod] [options]
#
# Options:
#   --device-id=ID   Copy only this device
#   --dry-run         Show what would be done, no changes
#   --limit=N         Max messages per device (default: 100)
#
# Examples:
#   ./scripts/add_firebase_data_to_backend.sh stage
#   ./scripts/add_firebase_data_to_backend.sh prod --dry-run
#   ./scripts/add_firebase_data_to_backend.sh stage --device-id=abc123 --limit=50
#

set -e

ENV_ARG="stage"
EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    stage|prod)
      ENV_ARG="$arg"
      ;;
    --device-id=*)
      EXTRA_ARGS+=( "$arg" )
      ;;
    --dry-run)
      EXTRA_ARGS+=( "--dry-run" )
      ;;
    --limit=*)
      EXTRA_ARGS+=( "$arg" )
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [stage|prod] [--device-id=ID] [--dry-run] [--limit=N]" >&2
      exit 1
      ;;
  esac
done

if [ "$ENV_ARG" = "prod" ]; then
  CMD_FLAG="--prod"
else
  CMD_FLAG="--stage"
fi

# Run from BACKEND directory (where manage.py lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

# Staging uses docker-compose.staging.yml; prod uses default compose file
if [ "$ENV_ARG" = "stage" ]; then
  COMPOSE_FILE="-f docker-compose.staging.yml"
else
  COMPOSE_FILE=""
fi

echo "Adding Firebase data to backend (environment: $ENV_ARG)..."

# Staging often runs as project "fastpay-staging" (container fastpay-staging-web-1); prefer it if running
if [ "$ENV_ARG" = "stage" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "fastpay-staging-web-1"; then
  echo "Using running staging container fastpay-staging-web-1."
  COMMAND=( docker exec fastpay-staging-web-1 python manage.py copy_firebase_to_django "$CMD_FLAG" )
elif [ "$ENV_ARG" = "stage" ] && docker compose -f docker-compose.staging.yml -p fastpay-staging ps --services 2>/dev/null | grep -q web; then
  echo "Using Docker Compose (staging, project fastpay-staging) 'web' service."
  COMMAND=( docker compose -f docker-compose.staging.yml -p fastpay-staging exec web python manage.py copy_firebase_to_django "$CMD_FLAG" )
elif [ -n "$COMPOSE_FILE" ] && docker compose $COMPOSE_FILE ps --services 2>/dev/null | grep -q web; then
  echo "Using Docker Compose (staging) 'web' service."
  COMMAND=( docker compose $COMPOSE_FILE exec web python manage.py copy_firebase_to_django "$CMD_FLAG" )
elif [ -z "$COMPOSE_FILE" ] && docker compose ps --services 2>/dev/null | grep -q web; then
  echo "Using Docker Compose 'web' service."
  COMMAND=( docker compose exec web python manage.py copy_firebase_to_django "$CMD_FLAG" )
elif docker-compose $COMPOSE_FILE ps --services 2>/dev/null | grep -q web; then
  echo "Using Docker Compose 'web' service."
  COMMAND=( docker-compose $COMPOSE_FILE exec web python manage.py copy_firebase_to_django "$CMD_FLAG" )
elif docker ps -a --format '{{.Names}}' | grep -q "fastpay_be_web_1"; then
  echo "Using container fastpay_be_web_1."
  COMMAND=( docker exec fastpay_be_web_1 python manage.py copy_firebase_to_django "$CMD_FLAG" )
else
  echo "Running manage.py directly."
  COMMAND=( python3 manage.py copy_firebase_to_django "$CMD_FLAG" )
fi

"${COMMAND[@]}" "${EXTRA_ARGS[@]}"

if [ $? -eq 0 ]; then
  echo "Done."
else
  echo "Command failed. Check output above." >&2
  exit 1
fi

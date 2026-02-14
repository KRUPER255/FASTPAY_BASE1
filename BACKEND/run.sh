#!/bin/bash
# Run a Python command (or any command) in the backend environment.
# Uses Docker when the stack is up, otherwise runs locally with python3.
#
# Examples:
#   ./run.sh python manage.py migrate
#   ./run.sh python manage.py shell
#   ./run.sh python manage.py create_test_data --count 5
#   ./run.sh python -c "from api.models import Device; print(Device.objects.count())"
#   ./run.sh python scripts/my_script.py
#
# From repo root:  ./BACKEND/run.sh python manage.py check

set -e
cd "$(dirname "$0")"

COMPOSE_CMD="docker compose"
command -v docker-compose &>/dev/null && COMPOSE_CMD="docker-compose"

_run_in_docker() {
  if $COMPOSE_CMD ps --services 2>/dev/null | grep -q '^web$'; then
    $COMPOSE_CMD exec web "$@"
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'fastpay_be_web'; then
    CONTAINER=$(docker ps --format '{{.Names}}' | grep 'fastpay_be_web' | head -1)
    docker exec "$CONTAINER" "$@"
  else
    return 1
  fi
}

if [ $# -eq 0 ]; then
  echo "Usage: $0 <command> [args...]"
  echo "  Run a command in the backend environment (Docker if up, else local Python)."
  echo "  Examples:"
  echo "    $0 python manage.py migrate"
  echo "    $0 python manage.py shell"
  echo "    $0 python -c \"print(1+1)\""
  exit 1
fi

if _run_in_docker "$@"; then
  exit 0
fi

# Fallback: one-off container (no stack running)
if command -v docker &>/dev/null && [ -f docker-compose.yml ]; then
  echo "Stack not running; running one-off in Docker..."
  $COMPOSE_CMD run --rm web "$@"
  exit 0
fi

# Fallback: local Python
echo "Docker not available or no compose file; running locally..."
if [ "$1" = "python" ]; then
  shift
  exec python3 "$@"
else
  exec "$@"
fi

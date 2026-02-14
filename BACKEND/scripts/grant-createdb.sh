#!/usr/bin/env bash
# Grant CREATEDB to the DB user so Django tests can create test_fastpay_db.
# Run from BACKEND/. Usage: ./scripts/grant-createdb.sh [staging|production]

set -e

ENV="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ "$ENV" == "staging" ]]; then
    COMPOSE_FILE="docker-compose.staging.yml"
    PROJECT="fastpay-staging"
else
    COMPOSE_FILE="docker-compose.yml"
    PROJECT="fastpay-production"
fi

ENV_FILE=".env.$ENV"
[[ -f "$ENV_FILE" ]] || ENV_FILE=".env"
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "fastpay_user")

echo "Granting CREATEDB to $DB_USER for Django tests..."
if docker compose -f "$COMPOSE_FILE" -p "$PROJECT" exec -T db psql -U postgres -c "ALTER USER $DB_USER CREATEDB;"; then
    echo "Done. Tests should now be able to create the test database."
else
    echo "Failed. Ensure the db container is running: docker compose -f $COMPOSE_FILE -p $PROJECT up -d db"
    exit 1
fi

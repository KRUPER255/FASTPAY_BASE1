#!/usr/bin/env bash
# Set Postgres fastpay_user password to match DB_PASSWORD from .env.
# Use when the db container was initialized with a different password (e.g. default
# 'changeme') and your app uses .env with a different DB_PASSWORD.
#
# Run from BACKEND: ./scripts/sync-db-password-from-env.sh
# Or with a specific current password: OLD_PGPASSWORD=changeme ./scripts/sync-db-password-from-env.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in $BACKEND_DIR"
  exit 1
fi

# Load .env (no export of secrets to parent shell)
set -a
source .env
set +a

NEW_PASSWORD="${DB_PASSWORD:?DB_PASSWORD not set in .env}"
DB_USER="${DB_USER:-fastpay_user}"
DB_NAME="${DB_NAME:-fastpay_db}"

# Current postgres password (often 'changeme' if db was created with compose default)
CURRENT_PASSWORD="${OLD_PGPASSWORD:-changeme}"

echo "Updating Postgres user '$DB_USER' password to match .env (DB_PASSWORD)..."
if docker compose exec -e PGPASSWORD="$CURRENT_PASSWORD" db psql -U "$DB_USER" -d "$DB_NAME" -tc "ALTER USER $DB_USER WITH PASSWORD '$NEW_PASSWORD';"; then
  echo "Done. Use ENV_FILE=.env when running the app so it uses the same password."
else
  echo "Failed. If the db was created with a different password, run:"
  echo "  OLD_PGPASSWORD='<current-db-password>' $0"
  exit 1
fi

#!/usr/bin/env bash
# Backup before production deploy. Creates timestamped backups of DB, env, and commit.
# Usage: ./scripts/backup-before-deploy.sh
# Run from repo root. Uses PRODUCTION_BASE or current dir.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE="${PRODUCTION_BASE:-$REPO_ROOT}"
cd "$BASE"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BASE}/backups"
mkdir -p "$BACKUP_DIR"

echo "=== Backup before production deploy ==="
echo "Base: $BASE"
echo "Backup dir: $BACKUP_DIR"
echo ""

# 1. Save current commit
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "$COMMIT" > "$BACKUP_DIR/commit-$STAMP.txt"
echo -e "${GREEN}Saved commit: $COMMIT${NC}"

# 2. Backup env files
for f in BACKEND/.env.production DASHBOARD_FASTPAY/.env.production DASHBOARD_REDPAY/.env.production; do
    if [[ -f "$BASE/$f" ]]; then
        cp "$BASE/$f" "$BACKUP_DIR/env-$(basename $(dirname $f))-$STAMP.bak"
        echo -e "${GREEN}Backed up $f${NC}"
    fi
done

# 3. Database backup (if backend containers running)
if [[ -f "$BASE/BACKEND/.env.production" ]]; then
    DB_NAME=$(grep -E '^DB_NAME=' "$BASE/BACKEND/.env.production" 2>/dev/null | cut -d= -f2- || echo "fastpay_db")
    DB_USER=$(grep -E '^DB_USER=' "$BASE/BACKEND/.env.production" 2>/dev/null | cut -d= -f2- || echo "fastpay_user")
    if docker compose -f "$BASE/BACKEND/docker-compose.yml" -p fastpay-production ps 2>/dev/null | grep -q "Up"; then
        if docker compose -f "$BASE/BACKEND/docker-compose.yml" -p fastpay-production exec -T db pg_dump -U "$DB_USER" "$DB_NAME" 2>/dev/null > "$BACKUP_DIR/db-$STAMP.sql"; then
            echo -e "${GREEN}Backed up database to backups/db-$STAMP.sql${NC}"
        else
            echo -e "${YELLOW}Database backup skipped (pg_dump failed or DB not accessible)${NC}"
        fi
    else
        echo -e "${YELLOW}Database backup skipped (containers not running)${NC}"
    fi
fi

# 4. Save as "latest" for rollback
echo "$COMMIT" > "$BASE/.last-deploy-commit"
echo -e "${GREEN}Saved .last-deploy-commit${NC}"

echo ""
echo -e "${GREEN}Backup complete.${NC}"
echo "To restore DB: docker compose exec -T db psql -U \$DB_USER \$DB_NAME < backups/db-$STAMP.sql"

#!/bin/bash

# Promote code from staging directory to production directory
# Override with STAGING_DIR and PROD_DIR. Canonical production path: /var/www/fastpay (see docs/VPS_DEPLOY_STRUCTURE.md).
# Usage: ./promote-from-staging.sh [--dry-run] [--no-delete]

set -euo pipefail

STAGING_DIR="${STAGING_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
PROD_DIR="${PROD_DIR:-/var/www/fastpay}"
DRY_RUN=false
DELETE_FLAG="--delete"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-delete)
            DELETE_FLAG=""
            shift
            ;;
        *)
            shift
            ;;
    esac
done

if [[ ! -d "$STAGING_DIR" ]]; then
    echo "Staging directory not found: $STAGING_DIR"
    exit 1
fi

if [[ ! -d "$PROD_DIR" ]]; then
    echo "Production directory not found: $PROD_DIR"
    exit 1
fi

RSYNC_FLAGS=(-a --info=stats2,progress2 $DELETE_FLAG)
EXCLUDES=(
    ".git/"
    "**/.env"
    "**/.env.*"
    "**/node_modules/"
    "**/dist/"
    "**/dist-*"
    "BACKEND/db.sqlite3"
    "BACKEND/staticfiles/"
    "BACKEND/media/"
    "BACKEND/storage/"
    "BACKEND/nginx/ssl/"
    "BACKEND/nginx/acme/"
    "BACKEND/__pycache__/"
    "BACKEND/.pytest_cache/"
    "DASHBOARD_FASTPAY/.cache/"
    "DASHBOARD_REDPAY/.cache/"
)

if [[ "$DRY_RUN" == "true" ]]; then
    RSYNC_FLAGS+=(--dry-run)
fi

echo "Promoting code from $STAGING_DIR -> $PROD_DIR"
rsync "${RSYNC_FLAGS[@]}" "${EXCLUDES[@]/#/--exclude=}" "$STAGING_DIR/" "$PROD_DIR/"
echo "Promotion complete."

#!/bin/bash
#
# Create FASTPAY_DEPLOY directory structure for dist and config.
# Run once on the VPS (or when setting up a new server).
#
# Usage: sudo ./scripts/create-fastpay-deploy-dirs.sh
#        FASTPAY_DEPLOY_BASE=/custom/path ./scripts/create-fastpay-deploy-dirs.sh
#
# Creates:
#   $FASTPAY_DEPLOY_BASE/dist/{staging,production}/{fastpay,redpay}
#   $FASTPAY_DEPLOY_BASE/config/{staging,production}
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${FASTPAY_DEPLOY_BASE:-/var/www/FASTPAY_DEPLOY}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Creating FASTPAY_DEPLOY structure at $BASE"

# Create directories
mkdir -p "$BASE/dist/staging/fastpay"
mkdir -p "$BASE/dist/staging/redpay"
mkdir -p "$BASE/dist/production/fastpay"
mkdir -p "$BASE/dist/production/redpay"
mkdir -p "$BASE/config/staging"
mkdir -p "$BASE/config/production"

# Permissions: readable by www-data (nginx), writable by deploy user
# If run with sudo, adjust ownership
if [[ "$EUID" -eq 0 ]]; then
    chown -R www-data:www-data "$BASE" 2>/dev/null || true
fi
chmod -R 755 "$BASE"

echo -e "${GREEN}Created:${NC}"
echo "  $BASE/dist/staging/fastpay"
echo "  $BASE/dist/staging/redpay"
echo "  $BASE/dist/production/fastpay"
echo "  $BASE/dist/production/redpay"
echo "  $BASE/config/staging"
echo "  $BASE/config/production"
echo ""
echo -e "${GREEN}Done. Set FASTPAY_DEPLOY_BASE=$BASE in BACKEND/.env.staging and .env.production${NC}"

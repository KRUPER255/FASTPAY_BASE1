#!/bin/bash
#
# FastPay Production Full Deployment Script
#
# Builds both dashboards (production) + deploys backend (production).
# Production base path: /var/www/fastpay (see docs/VPS_DEPLOY_STRUCTURE.md).
# Can also run from repo root (e.g. current machine); set PRODUCTION_BASE if needed.
#
# Usage:
#   ./deploy-production.sh [dashboard|backend|all] [options]
#
# Target (optional first arg):
#   all        Deploy dashboard + backend (default)
#   dashboard  Deploy dashboard only
#   backend    Deploy backend only
#
# Options:
#   --skip-dashboard   Skip dashboard build
#   --skip-backend     Skip backend deployment
#   --skip-redpay      Skip RedPay dashboard build
#   --pull             Sync from GitHub first (production base) or git pull
#   --skip-pull        Don't pull (default)
#   --skip-tests       Skip backend tests
#   --no-input         Non-interactive mode
#   --dry-run          Show what would be done without executing
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${PRODUCTION_BASE:-$SCRIPT_DIR}"
cd "$BASE"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_DASHBOARD=false
SKIP_BACKEND=false
SKIP_REDPAY=false
SKIP_PULL=true
SKIP_TESTS=false
NO_INPUT=false
DRY_RUN=false
CURRENT_STEP=""

if [[ $# -gt 0 && "$1" == "dashboard" ]]; then
    SKIP_BACKEND=true
    shift
elif [[ $# -gt 0 && "$1" == "backend" ]]; then
    SKIP_DASHBOARD=true
    shift
elif [[ $# -gt 0 && "$1" == "all" ]]; then
    shift
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-dashboard) SKIP_DASHBOARD=true; shift ;;
        --skip-backend) SKIP_BACKEND=true; shift ;;
        --skip-redpay) SKIP_REDPAY=true; shift ;;
        --pull) SKIP_PULL=false; shift ;;
        --skip-pull) SKIP_PULL=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --no-input) NO_INPUT=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        *) shift ;;
    esac
done

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}FastPay Production Deployment${NC}"
echo -e "${BLUE}=========================================${NC}"
echo "Base: $BASE"
echo "Dashboard (FastPay) build: $([[ "$SKIP_DASHBOARD" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Dashboard (RedPay) build:  $([[ "$SKIP_DASHBOARD" == "true" || "$SKIP_REDPAY" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Backend deploy:            $([[ "$SKIP_BACKEND" == "true" ]] && echo "SKIP" || echo "YES")"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    exit 0
fi

# Step 1: Sync from GitHub or git pull
if [[ "$SKIP_PULL" != "true" ]]; then
    CURRENT_STEP="Step 1: Sync from GitHub / git pull"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ "$BASE" == "/var/www/fastpay" && -x "$BASE/scripts/sync-from-github.sh" ]]; then
        "$BASE/scripts/sync-from-github.sh" production --branch main || true
    else
        git pull origin main || echo "Warning: Could not pull from git"
    fi
    echo ""
fi

# Step 2: Build FastPay dashboard (production)
if [[ "$SKIP_DASHBOARD" != "true" ]]; then
    CURRENT_STEP="Step 2: Building FastPay dashboard (production)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ -x "$BASE/DASHBOARD_FASTPAY/deploy.sh" ]]; then
        "$BASE/DASHBOARD_FASTPAY/deploy.sh" production
    elif [[ -x "$BASE/DASHBOARD/deploy.sh" ]]; then
        "$BASE/DASHBOARD/deploy.sh" production
    else
        echo -e "${RED}Dashboard deploy script not found${NC}"
        exit 1
    fi
    echo ""

    # Step 2b: Build RedPay dashboard (production)
    if [[ "$SKIP_REDPAY" != "true" && -x "$BASE/DASHBOARD_REDPAY/deploy.sh" ]]; then
        CURRENT_STEP="Step 2b: Building RedPay dashboard (production)"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        "$BASE/DASHBOARD_REDPAY/deploy.sh" production
        echo ""
    fi
fi

# Step 3: Deploy Backend (production)
if [[ "$SKIP_BACKEND" != "true" ]]; then
    CURRENT_STEP="Step 3: Deploying backend (production)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    FASTPAY_DIST="${BASE}/DASHBOARD_FASTPAY/dist"
    [[ -d "$FASTPAY_DIST" ]] || FASTPAY_DIST="${BASE}/DASHBOARD/dist"
    export DASHBOARD_DIST_PATH="$FASTPAY_DIST"
    cd "$BASE/BACKEND"
    DEPLOY_CMD="./deploy.sh production"
    [[ "$NO_INPUT" == "true" ]] && DEPLOY_CMD+=" --no-input"
    [[ "$SKIP_TESTS" == "true" ]] && DEPLOY_CMD+=" --skip-tests"
    [[ "$SKIP_PULL" == "true" ]] && DEPLOY_CMD+=" --skip-pull"
    echo "Running: $DEPLOY_CMD"
    eval "$DEPLOY_CMD"
    cd "$BASE"
    echo ""
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Production deployment completed!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Production URLs:"
echo "  FastPay: https://fastpaygaming.com/"
echo "  RedPay:  https://redpay.fastpaygaming.com/"
echo "  API:     https://api.fastpaygaming.com/api/"
echo ""
echo "On server: sudo nginx -t && sudo systemctl reload nginx  (if host nginx serves static)"
echo ""

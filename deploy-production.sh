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
#   --skip-dashboard        Skip dashboard build
#   --skip-backend          Skip backend deployment
#   --skip-redpay           Skip RedPay dashboard build
#   --pull                  Sync from GitHub first (production base) or git pull
#   --skip-pull             Don't pull (default)
#   --skip-tests            Skip backend tests
#   --skip-postdeploy-checks  Skip DNS + HTTP + browser console post-deploy checks
#   --no-input              Non-interactive mode
#   --dry-run               Show what would be done without executing
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
SKIP_PREFLIGHT=false
PREFLIGHT_FORCE=false
SKIP_POSTDEPLOY_CHECKS=false
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
        --skip-postdeploy-checks) SKIP_POSTDEPLOY_CHECKS=true; shift ;;
        --no-input) NO_INPUT=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-preflight) SKIP_PREFLIGHT=true; shift ;;
        --force) PREFLIGHT_FORCE=true; shift ;;
        *) shift ;;
    esac
done

# Load FASTPAY_DEPLOY_BASE from .env.production or default
FASTPAY_DEPLOY_BASE="${FASTPAY_DEPLOY_BASE:-/var/www/FASTPAY_DEPLOY}"
if [[ -f "$BASE/BACKEND/.env.production" ]]; then
    val=$(grep -E '^FASTPAY_DEPLOY_BASE=' "$BASE/BACKEND/.env.production" 2>/dev/null | cut -d= -f2-)
    [[ -n "$val" ]] && FASTPAY_DEPLOY_BASE="$val"
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}FastPay Production Deployment${NC}"
echo -e "${BLUE}=========================================${NC}"
echo "Base: $BASE"
echo "FASTPAY_DEPLOY: $FASTPAY_DEPLOY_BASE"
echo "Dashboard (FastPay) build: $([[ "$SKIP_DASHBOARD" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Dashboard (RedPay) build:  $([[ "$SKIP_DASHBOARD" == "true" || "$SKIP_REDPAY" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Backend deploy:            $([[ "$SKIP_BACKEND" == "true" ]] && echo "SKIP" || echo "YES")"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    exit 0
fi

# Step 0a: Backup (production)
if [[ -x "$BASE/scripts/backup-before-deploy.sh" ]]; then
    CURRENT_STEP="Step 0a: Backup"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    "$BASE/scripts/backup-before-deploy.sh" || echo -e "${YELLOW}Backup failed or skipped (continuing)${NC}"
    echo ""
fi

# Step 0b: Pre-flight checks
if [[ "$SKIP_PREFLIGHT" != "true" && -x "$BASE/scripts/preflight-check.sh" ]]; then
    CURRENT_STEP="Step 0b: Pre-flight checks"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    PREFLIGHT_ARGS=(production)
    [[ "$PREFLIGHT_FORCE" == "true" ]] && PREFLIGHT_ARGS+=(--force)
    if ! "$BASE/scripts/preflight-check.sh" "${PREFLIGHT_ARGS[@]}"; then
        echo -e "${RED}Pre-flight checks failed. Use --skip-preflight to bypass (not recommended).${NC}" >&2
        exit 1
    fi
    echo ""
fi

# Step 1: Sync from GitHub or git pull
if [[ "$SKIP_PULL" != "true" ]]; then
    CURRENT_STEP="Step 1: Sync from GitHub / git pull"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ -x "$BASE/scripts/sync-from-github.sh" ]]; then
        REPO_BASE="$BASE" "$BASE/scripts/sync-from-github.sh" production --branch main || true
    else
        git pull origin main || echo "Warning: Could not pull from git"
    fi
    echo ""
fi

# Step 2: Build dashboards and rsync to FASTPAY_DEPLOY (production)
if [[ "$SKIP_DASHBOARD" != "true" ]]; then
    CURRENT_STEP="Step 2: Building FastPay dashboard (production)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ -x "$BASE/DASHBOARD_FASTPAY/deploy.sh" ]]; then
        "$BASE/DASHBOARD_FASTPAY/deploy.sh" production
    else
        echo -e "${RED}Dashboard deploy script not found in DASHBOARD_FASTPAY${NC}"
        exit 1
    fi

    # Rsync FastPay dist to FASTPAY_DEPLOY (on success)
    if [[ -d "$BASE/DASHBOARD_FASTPAY/dist" ]]; then
        CURRENT_STEP="Step 2a: Syncing FastPay dist to FASTPAY_DEPLOY"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        DEST="$FASTPAY_DEPLOY_BASE/dist/production/fastpay"
        sudo rsync -a --delete "$BASE/DASHBOARD_FASTPAY/dist/" "$DEST/" 2>/dev/null || rsync -a --delete "$BASE/DASHBOARD_FASTPAY/dist/" "$DEST/" 2>/dev/null || true
        echo -e "${GREEN}FastPay dist synced to $DEST${NC}"
    fi
    echo ""

    # Step 2b: Build RedPay dashboard (production)
    if [[ "$SKIP_REDPAY" != "true" && -x "$BASE/DASHBOARD_REDPAY/deploy.sh" ]]; then
        CURRENT_STEP="Step 2b: Building RedPay dashboard (production)"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        "$BASE/DASHBOARD_REDPAY/deploy.sh" production
        echo ""
    fi

    # Rsync RedPay dist to FASTPAY_DEPLOY (on success)
    if [[ "$SKIP_REDPAY" != "true" && -d "$BASE/DASHBOARD_REDPAY/dist" ]]; then
        CURRENT_STEP="Step 2c: Syncing RedPay dist to FASTPAY_DEPLOY"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        DEST="$FASTPAY_DEPLOY_BASE/dist/production/redpay"
        sudo rsync -a --delete "$BASE/DASHBOARD_REDPAY/dist/" "$DEST/" 2>/dev/null || rsync -a --delete "$BASE/DASHBOARD_REDPAY/dist/" "$DEST/" 2>/dev/null || true
        echo -e "${GREEN}RedPay dist synced to $DEST${NC}"
    fi
fi

# Step 3: Deploy Backend (production)
if [[ "$SKIP_BACKEND" != "true" ]]; then
    CURRENT_STEP="Step 3: Deploying backend (production)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"

    # Copy backend .env to FASTPAY_DEPLOY (deployed config - only updated on deploy)
    if [[ -f "$BASE/BACKEND/.env.production" ]]; then
        mkdir -p "$FASTPAY_DEPLOY_BASE/config/production"
        cp "$BASE/BACKEND/.env.production" "$FASTPAY_DEPLOY_BASE/config/production/backend.env" 2>/dev/null || \
        sudo cp "$BASE/BACKEND/.env.production" "$FASTPAY_DEPLOY_BASE/config/production/backend.env"
        echo -e "${GREEN}Backend config synced to FASTPAY_DEPLOY/config/production/backend.env${NC}"
    fi

    # Use FASTPAY_DEPLOY config for production deploy
    export ENV_FILE="$FASTPAY_DEPLOY_BASE/config/production/backend.env"
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

# Step 4: Verify (when backend was deployed)
if [[ "$SKIP_BACKEND" != "true" ]]; then
    CURRENT_STEP="Step 4: Verifying deployment"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    sleep 3
    PROD_WEB_PORT=8000
    ENV_FILE="$FASTPAY_DEPLOY_BASE/config/production/backend.env"
    if [[ -f "$ENV_FILE" ]]; then
        val=$(grep -E '^WEB_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
        [[ -n "$val" ]] && PROD_WEB_PORT="$val"
    fi
    HEALTH_RESPONSE=$(curl -s --connect-timeout 5 "http://localhost:${PROD_WEB_PORT}/health/" 2>/dev/null || echo "FAILED")
    if [[ "$HEALTH_RESPONSE" == "ok" ]]; then
        echo -e "${GREEN}Backend health check: OK (port ${PROD_WEB_PORT})${NC}"
    else
        echo -e "${YELLOW}Backend health check: $HEALTH_RESPONSE (port ${PROD_WEB_PORT}; ensure backend is up)${NC}"
    fi

    # Post-deploy checks (DNS, HTTP, browser console)
    if [[ "$SKIP_POSTDEPLOY_CHECKS" != "true" && -x "$BASE/BACKEND/scripts/check-production-postdeploy.sh" ]]; then
        echo ""
        echo "Running post-deploy checks..."
        if ! "$BASE/BACKEND/scripts/check-production-postdeploy.sh"; then
            echo -e "${RED}Post-deploy checks failed. Treat deploy as FAILED.${NC}" >&2
            exit 1
        fi
        echo -e "${GREEN}Post-deploy checks passed${NC}"
    fi
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
echo "See: docs/DEPLOY_PROCESS.md for full verification steps."
echo ""

#!/bin/bash
#
# FastPay Staging Full Deployment Script
# 
# Builds dashboard + deploys backend + sends Telegram notifications
#
# Usage:
#   ./deploy-all.sh [dashboard|backend|all] [options]
#
# Target (optional first arg):
#   all        Deploy dashboard + backend (default)
#   dashboard  Deploy dashboard only
#   backend    Deploy backend only
#
# Options:
#   --skip-dashboard      Skip dashboard build (same as target backend)
#   --skip-backend        Skip backend deployment (same as target dashboard)
#   --pull                Run git pull (default: skip pull, deploy local only)
#   --skip-pull           Don't run git pull (default for staging)
#   --skip-tests          Skip backend tests
#   --skip-notify         Skip Telegram notifications
#   --no-input            Non-interactive mode
#   --dry-run             Show what would be done without executing
#   --with-proxy          Enable staging reverse proxy (staging.fastpaygaming.com on 80/443)
#
# Staging: run from /desktop/fastpay when using the VPS layout (see docs/VPS_DEPLOY_STRUCTURE.md).
# With --pull, scripts/sync-from-github.sh staging is run first to update the repo.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default options (staging: deploy local, no git pull)
SKIP_DASHBOARD=false
SKIP_BACKEND=false
SKIP_PULL=true
SKIP_TESTS=false
SKIP_NOTIFY=false
NO_INPUT=false
DRY_RUN=false
CURRENT_STEP=""
DEPLOY_START_TIME=$(date +%s)

# Optional first arg: dashboard | backend | all
if [[ $# -gt 0 && "$1" == "dashboard" ]]; then
    SKIP_BACKEND=true
    shift
elif [[ $# -gt 0 && "$1" == "backend" ]]; then
    SKIP_DASHBOARD=true
    shift
elif [[ $# -gt 0 && "$1" == "all" ]]; then
    shift
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-dashboard) SKIP_DASHBOARD=true; shift ;;
        --skip-backend) SKIP_BACKEND=true; shift ;;
        --pull) SKIP_PULL=false; shift ;;
        --skip-pull) SKIP_PULL=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --skip-notify) SKIP_NOTIFY=true; shift ;;
        --no-input) NO_INPUT=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        *) shift ;;
    esac
done

# Load environment variables for Telegram
if [[ -f "BACKEND/.env.staging" ]]; then
    set -a
    source "BACKEND/.env.staging"
    set +a
fi

# ============================================================================
# Telegram Notification Functions
# ============================================================================

send_telegram() {
    local msg=$1
    [[ "$SKIP_NOTIFY" == "true" ]] && return 0
    [[ -z "$TELEGRAM_BOT_TOKEN" || -z "$TELEGRAM_CHAT_IDS" ]] && return 0
    
    local chat_ids
    IFS=',' read -ra chat_ids <<< "$TELEGRAM_CHAT_IDS"
    for cid in "${chat_ids[@]}"; do
        cid=$(echo "$cid" | tr -d ' ')
        [[ -z "$cid" ]] && continue
        curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            --data-urlencode "text=$msg" \
            -d "chat_id=${cid}" \
            -d "parse_mode=HTML" \
            -d "disable_web_page_preview=true" \
            --connect-timeout 5 --max-time 10 \
            >/dev/null 2>&1 || true
    done
}

notify_start() {
    local msg="🚀 <b>FastPay Staging Deploy STARTED</b>

<b>Time:</b> $(date -Iseconds)
<b>Server:</b> $(hostname)
<b>Components:</b>"
    
    [[ "$SKIP_DASHBOARD" != "true" ]] && msg+=" Dashboard"
    [[ "$SKIP_BACKEND" != "true" ]] && msg+=" Backend"
    
    send_telegram "$msg"
}

notify_success() {
    local duration=$(($(date +%s) - DEPLOY_START_TIME))
    local services_status=""
    
    if [[ "$SKIP_BACKEND" != "true" ]]; then
        services_status=$(cd BACKEND && docker compose -f docker-compose.staging.yml -p fastpay-staging ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 || echo "Unable to get status")
    fi
    
    local msg="✅ <b>FastPay Staging Deploy SUCCESS</b>

<b>Duration:</b> ${duration}s
<b>Time:</b> $(date -Iseconds)
<b>Server:</b> $(hostname)

<b>URLs:</b>
• API: https://api-staging.fastpaygaming.com/api/
• Dashboard: https://staging.fastpaygaming.com/"
    
    if [[ -n "$services_status" ]]; then
        msg+="

<b>Services:</b>
<code>${services_status}</code>"
    fi
    
    send_telegram "$msg"
}

notify_failure() {
    local step="${CURRENT_STEP:-Unknown step}"
    local duration=$(($(date +%s) - DEPLOY_START_TIME))
    
    local msg="❌ <b>FastPay Staging Deploy FAILED</b>

<b>Failed at:</b> ${step}
<b>Duration:</b> ${duration}s
<b>Time:</b> $(date -Iseconds)
<b>Server:</b> $(hostname)

Check logs on server."
    
    send_telegram "$msg"
}

# Error trap
on_error() {
    echo -e "${RED}Deployment failed at: ${CURRENT_STEP}${NC}"
    notify_failure
    exit 1
}
trap on_error ERR

# ============================================================================
# Main Deployment
# ============================================================================

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}FastPay Staging Full Deployment${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo "Dashboard build: $([[ "$SKIP_DASHBOARD" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Backend deploy:  $([[ "$SKIP_BACKEND" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Git pull:        $([[ "$SKIP_PULL" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Tests:           $([[ "$SKIP_TESTS" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Notifications:   $([[ "$SKIP_NOTIFY" == "true" ]] && echo "SKIP" || echo "YES")"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    exit 0
fi

# Send start notification
notify_start

# ----------------------------------------------------------------------------
# Step 1: Sync from GitHub or Git pull
# Staging base path: /desktop/fastpay (see docs/VPS_DEPLOY_STRUCTURE.md)
# ----------------------------------------------------------------------------
if [[ "$SKIP_PULL" != "true" ]]; then
    CURRENT_STEP="Step 1: Sync from GitHub / git pull"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    # When run from staging base /desktop/fastpay, use sync-from-github to update that tree
    if [[ "$SCRIPT_DIR" == "/desktop/fastpay" && -x "$SCRIPT_DIR/scripts/sync-from-github.sh" ]]; then
        "$SCRIPT_DIR/scripts/sync-from-github.sh" staging --branch main || true
    else
        git pull origin main || echo "Warning: Could not pull from git"
    fi
    echo ""
fi

# ----------------------------------------------------------------------------
# Step 2: Build Dashboard (DASHBOARD_FASTPAY for staging; see docs/VPS_DEPLOY_STRUCTURE.md)
# When run from /desktop/fastpay, staging nginx container mounts DASHBOARD_FASTPAY/dist.
# ----------------------------------------------------------------------------
if [[ "$SKIP_DASHBOARD" != "true" ]]; then
    CURRENT_STEP="Step 2: Building dashboard (DASHBOARD_FASTPAY)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ -x "$SCRIPT_DIR/DASHBOARD_FASTPAY/deploy.sh" ]]; then
        "$SCRIPT_DIR/DASHBOARD_FASTPAY/deploy.sh" staging
    elif [[ -x "$SCRIPT_DIR/DASHBOARD/deploy.sh" ]]; then
        echo -e "${YELLOW}DASHBOARD_FASTPAY not found, using DASHBOARD${NC}"
        "$SCRIPT_DIR/DASHBOARD/deploy.sh" staging
    else
        echo -e "${RED}Dashboard deploy script not found in DASHBOARD_FASTPAY or DASHBOARD${NC}"
        exit 1
    fi

    # Optional: copy to a separate nginx docroot if STAGING_NGINX_ROOT is set (e.g. legacy host path)
    # When using /desktop/fastpay layout, the staging container mounts dist from DASHBOARD_FASTPAY/dist.
    DASHBOARD_DIST="${SCRIPT_DIR}/DASHBOARD_FASTPAY/dist"
    [[ ! -d "$DASHBOARD_DIST" ]] && DASHBOARD_DIST="${SCRIPT_DIR}/DASHBOARD/dist"
    if [[ -n "$STAGING_NGINX_ROOT" && "$STAGING_NGINX_ROOT" != "/usr/share/nginx/html" && -d "$DASHBOARD_DIST" ]]; then
        CURRENT_STEP="Step 2b: Deploying dashboard to nginx root"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        DEST="$STAGING_NGINX_ROOT"
        if mkdir -p "$DEST" 2>/dev/null && rsync -a --delete "$DASHBOARD_DIST/" "$DEST/" 2>/dev/null; then
            echo -e "${GREEN}Dashboard deployed to $DEST${NC}"
        elif sudo mkdir -p "$DEST" && sudo rsync -a --delete "$DASHBOARD_DIST/" "$DEST/"; then
            echo -e "${GREEN}Dashboard deployed to $DEST${NC}"
        else
            echo -e "${YELLOW}Could not copy to $DEST. Copy manually.${NC}"
        fi
    fi
    echo ""
fi

# ----------------------------------------------------------------------------
# Step 3: Deploy Backend
# ----------------------------------------------------------------------------
if [[ "$SKIP_BACKEND" != "true" ]]; then
    CURRENT_STEP="Step 3: Deploying backend"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    
    cd "$SCRIPT_DIR/BACKEND"
    
    # Build deploy command
    DEPLOY_CMD="./deploy.sh staging"
    [[ "$NO_INPUT" == "true" ]] && DEPLOY_CMD+=" --no-input"
    [[ "$SKIP_TESTS" == "true" ]] && DEPLOY_CMD+=" --skip-tests"
    [[ "$SKIP_PULL" == "true" ]] && DEPLOY_CMD+=" --skip-pull"
    DEPLOY_CMD+=" --skip-notify"  # We handle notifications here
    
    echo "Running: $DEPLOY_CMD"
    eval "$DEPLOY_CMD"
    
    cd "$SCRIPT_DIR"
fi

# ----------------------------------------------------------------------------
# Step 4: Verify Deployment
# ----------------------------------------------------------------------------
CURRENT_STEP="Step 4: Verifying deployment"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"

# Wait for services to be ready
sleep 5

# Check backend health
if [[ "$SKIP_BACKEND" != "true" ]]; then
    echo "Checking backend health..."
    HEALTH_RESPONSE=$(curl -s --connect-timeout 5 http://localhost:8001/health/ 2>/dev/null || echo "FAILED")
    if [[ "$HEALTH_RESPONSE" == "ok" ]]; then
        echo -e "${GREEN}Backend health check: OK${NC}"
    else
        echo -e "${YELLOW}Backend health check: $HEALTH_RESPONSE${NC}"
    fi
fi

# Check public dashboard URL
echo "Checking public dashboard..."
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -L https://staging.fastpaygaming.com/ 2>/dev/null || echo "000")
if [[ "$DASH_STATUS" == "200" || "$DASH_STATUS" == "302" ]]; then
    echo -e "${GREEN}Public dashboard: OK (HTTP $DASH_STATUS)${NC}"
else
    echo -e "${YELLOW}Public dashboard: HTTP $DASH_STATUS${NC}"
    echo -e "${YELLOW}  If unreachable, ensure host nginx is configured (see BACKEND/nginx/STAGING_NGINX.md and run apply-staging-on-host.sh on the server).${NC}"
fi

# Check public API
echo "Checking public API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://api-staging.fastpaygaming.com/api/ 2>/dev/null || echo "000")
if [[ "$API_STATUS" == "200" ]]; then
    echo -e "${GREEN}Public API: OK (HTTP $API_STATUS)${NC}"
else
    echo -e "${YELLOW}Public API: HTTP $API_STATUS${NC}"
    echo -e "${YELLOW}  If unreachable, ensure host nginx is configured (see BACKEND/nginx/STAGING_NGINX.md and run apply-staging-on-host.sh on the server).${NC}"
fi

# Optional: run staging test plan (warning only on failure)
if [[ -x "$SCRIPT_DIR/run-staging-tests.sh" ]]; then
    echo "Running staging test plan..."
    if "$SCRIPT_DIR/run-staging-tests.sh" 2>&1; then
        echo -e "${GREEN}Staging test plan: passed${NC}"
    else
        echo -e "${YELLOW}Staging test plan had failures (deploy succeeded)${NC}"
    fi
fi

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Staging deployment completed!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Dashboard: https://staging.fastpaygaming.com/  (or http://localhost:8888/)"
echo "API:       https://api-staging.fastpaygaming.com/api/  (or http://localhost:8001/api/)"
echo "Admin:     https://api-staging.fastpaygaming.com/admin/"
echo ""

# Send success notification
notify_success

exit 0

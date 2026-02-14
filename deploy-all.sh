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
#   --skip-redpay         Skip RedPay dashboard build (only build DASHBOARD_FASTPAY)
#   --pull                Run git sync/pull before deploy (staging default: local code only)
#   --skip-pull           Don't run git sync/pull (default for staging; staging uses local code only)
#   --skip-tests          Skip backend tests
#   --skip-notify         Skip Telegram notifications
#   --no-input            Non-interactive mode
#   --dry-run             Show what would be done without executing
#   --with-proxy          Enable staging reverse proxy (staging.fastpaygaming.com on 80/443)
#   --apply-nginx         Apply host nginx config on this machine (sudo) so public URLs work
#   --skip-apply-nginx    Do not try to apply host nginx (default: try once if backend was deployed)
#   --require-public-urls   Exit with failure if public URL checks fail (use after applying nginx on server)
#   --push                  After success, push local code to GitHub (default: skip)
#   --skip-push             Do not push to GitHub after deploy (default)
#   --skip-postdeploy-checks  Skip DNS + HTTP + browser console post-deploy checks
#
# Staging: run from repo root (e.g. /root/Desktop/FASTPAY_BASE). Dist/config go to FASTPAY_DEPLOY.
# Public URLs (staging.fastpaygaming.com, sapi, sadmin, sredpay) require host nginx to be applied
# on the server. Run with --apply-nginx on the server, or run there: sudo ./BACKEND/nginx/apply-staging-on-host.sh
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

# Default options (staging: local code only, no git pull/sync)
SKIP_DASHBOARD=false
SKIP_BACKEND=false
SKIP_REDPAY=false
SKIP_PULL=true
SKIP_TESTS=false
SKIP_NOTIFY=false
NO_INPUT=false
DRY_RUN=false
SKIP_PREFLIGHT=false
PREFLIGHT_FORCE=false
APPLY_NGINX=""   # "yes" | "no" | "" (try once)
REQUIRE_PUBLIC_URLS=false
PUSH_TO_GITHUB=false
SKIP_POSTDEPLOY_CHECKS=false
CURRENT_STEP=""
DEPLOY_START_TIME=$(date +%s)
PUBLIC_URLS_OK=true
APPLY_NGINX_DID_RUN=false
APPLY_NGINX_OK=false

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
        --skip-redpay) SKIP_REDPAY=true; shift ;;
        --pull) SKIP_PULL=false; shift ;;
        --skip-pull) SKIP_PULL=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --skip-notify) SKIP_NOTIFY=true; shift ;;
        --no-input) NO_INPUT=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --apply-nginx) APPLY_NGINX=yes; shift ;;
        --skip-apply-nginx) APPLY_NGINX=no; shift ;;
        --require-public-urls) REQUIRE_PUBLIC_URLS=true; shift ;;
        --push) PUSH_TO_GITHUB=true; shift ;;
        --skip-push) PUSH_TO_GITHUB=false; shift ;;
        --skip-postdeploy-checks) SKIP_POSTDEPLOY_CHECKS=true; shift ;;
        --skip-preflight) SKIP_PREFLIGHT=true; shift ;;
        --force) PREFLIGHT_FORCE=true; shift ;;
        *) shift ;;
    esac
done
# Default: try to apply nginx when backend was deployed (so public URLs work)
[[ -z "$APPLY_NGINX" ]] && APPLY_NGINX=yes

# Load environment variables (Telegram, FASTPAY_DEPLOY_BASE)
if [[ -f "BACKEND/.env.staging" ]]; then
    set -a
    source "BACKEND/.env.staging"
    set +a
fi
FASTPAY_DEPLOY_BASE="${FASTPAY_DEPLOY_BASE:-/var/www/FASTPAY_DEPLOY}"

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
• FastPay: https://staging.fastpaygaming.com/
• RedPay: https://sredpay.fastpaygaming.com/
• API: https://sapi.fastpaygaming.com/api/
• Admin: https://sadmin.fastpaygaming.com/admin/"
    
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
    echo "To rollback: ./scripts/rollback.sh staging"
    echo "See: docs/DEPLOY_PROCESS.md docs/EASY_SECURE_DEPLOY_PLAN.md"
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
echo "Dashboard (FastPay) build: $([[ "$SKIP_DASHBOARD" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Dashboard (RedPay) build:  $([[ "$SKIP_DASHBOARD" == "true" || "$SKIP_REDPAY" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Backend deploy:            $([[ "$SKIP_BACKEND" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Git pull/sync:   $([[ "$SKIP_PULL" == "true" ]] && echo "SKIP (staging: local code only)" || echo "YES")"
echo "Tests:           $([[ "$SKIP_TESTS" == "true" ]] && echo "SKIP" || echo "YES")"
echo "Notifications:   $([[ "$SKIP_NOTIFY" == "true" ]] && echo "SKIP" || echo "YES")"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    exit 0
fi

# Send start notification
notify_start

# Save commit for rollback
echo "$(git rev-parse HEAD 2>/dev/null || echo "unknown")" > "$SCRIPT_DIR/.last-deploy-commit" 2>/dev/null || true

# ----------------------------------------------------------------------------
# Step 0: Pre-flight checks
# ----------------------------------------------------------------------------
if [[ "$SKIP_PREFLIGHT" != "true" && -x "$SCRIPT_DIR/scripts/preflight-check.sh" ]]; then
    CURRENT_STEP="Step 0: Pre-flight checks"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    PREFLIGHT_ARGS=(staging)
    [[ "$PREFLIGHT_FORCE" == "true" ]] && PREFLIGHT_ARGS+=(--force)
    if ! "$SCRIPT_DIR/scripts/preflight-check.sh" "${PREFLIGHT_ARGS[@]}"; then
        echo -e "${RED}Pre-flight checks failed. Use --skip-preflight to bypass (not recommended).${NC}" >&2
        exit 1
    fi
    echo ""
fi

# ----------------------------------------------------------------------------
# Step 1: Sync from GitHub or Git pull (optional; staging defaults to local code)
# ----------------------------------------------------------------------------
if [[ "$SKIP_PULL" != "true" ]]; then
    CURRENT_STEP="Step 1: Sync from GitHub / git pull"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ -x "$SCRIPT_DIR/scripts/sync-from-github.sh" ]]; then
        REPO_BASE="$SCRIPT_DIR" "$SCRIPT_DIR/scripts/sync-from-github.sh" staging --branch main || true
    else
        git pull origin main || echo "Warning: Could not pull from git"
    fi
    echo ""
fi

# ----------------------------------------------------------------------------
# Step 2: Build Dashboard and rsync to FASTPAY_DEPLOY
# ----------------------------------------------------------------------------
if [[ "$SKIP_DASHBOARD" != "true" ]]; then
    CURRENT_STEP="Step 2: Building dashboard (DASHBOARD_FASTPAY)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if [[ -x "$SCRIPT_DIR/DASHBOARD_FASTPAY/deploy.sh" ]]; then
        "$SCRIPT_DIR/DASHBOARD_FASTPAY/deploy.sh" staging
    else
        echo -e "${RED}Dashboard deploy script not found in DASHBOARD_FASTPAY${NC}"
        exit 1
    fi

    # Rsync FastPay dist to FASTPAY_DEPLOY (on success)
    FASTPAY_DIST="${SCRIPT_DIR}/DASHBOARD_FASTPAY/dist"
    if [[ -d "$FASTPAY_DIST" ]]; then
        CURRENT_STEP="Step 2a: Syncing FastPay dist to FASTPAY_DEPLOY"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        DEST="$FASTPAY_DEPLOY_BASE/dist/staging/fastpay"
        if sudo rsync -a --delete "$FASTPAY_DIST/" "$DEST/" 2>/dev/null || rsync -a --delete "$FASTPAY_DIST/" "$DEST/" 2>/dev/null; then
            echo -e "${GREEN}FastPay dist synced to $DEST${NC}"
        else
            echo -e "${YELLOW}Could not rsync to $DEST (check permissions)${NC}"
        fi
    fi

    # Build RedPay dashboard (staging; served at https://sredpay.fastpaygaming.com/)
    if [[ "$SKIP_REDPAY" != "true" && -x "$SCRIPT_DIR/DASHBOARD_REDPAY/deploy.sh" ]]; then
        CURRENT_STEP="Step 2b: Building RedPay dashboard (DASHBOARD_REDPAY)"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        "$SCRIPT_DIR/DASHBOARD_REDPAY/deploy.sh" staging
        echo -e "${GREEN}RedPay dashboard built; URL: https://sredpay.fastpaygaming.com/${NC}"
    fi

    # Rsync RedPay dist to FASTPAY_DEPLOY (on success)
    if [[ "$SKIP_REDPAY" != "true" && -d "$SCRIPT_DIR/DASHBOARD_REDPAY/dist" ]]; then
        CURRENT_STEP="Step 2c: Syncing RedPay dist to FASTPAY_DEPLOY"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        REDPAY_DIST="${SCRIPT_DIR}/DASHBOARD_REDPAY/dist"
        DEST="$FASTPAY_DEPLOY_BASE/dist/staging/redpay"
        if sudo rsync -a --delete "$REDPAY_DIST/" "$DEST/" 2>/dev/null || rsync -a --delete "$REDPAY_DIST/" "$DEST/" 2>/dev/null; then
            echo -e "${GREEN}RedPay dist synced to $DEST${NC}"
        else
            echo -e "${YELLOW}Could not rsync to $DEST (check permissions)${NC}"
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
    
    # Copy backend .env to FASTPAY_DEPLOY (deployed config - only updated on deploy)
    if [[ -f "$SCRIPT_DIR/BACKEND/.env.staging" ]]; then
        mkdir -p "$FASTPAY_DEPLOY_BASE/config/staging"
        cp "$SCRIPT_DIR/BACKEND/.env.staging" "$FASTPAY_DEPLOY_BASE/config/staging/backend.env" 2>/dev/null || \
        sudo cp "$SCRIPT_DIR/BACKEND/.env.staging" "$FASTPAY_DEPLOY_BASE/config/staging/backend.env"
        echo -e "${GREEN}Backend config synced to FASTPAY_DEPLOY/config/staging/backend.env${NC}"
    fi
    
    # Export for docker-compose: use FASTPAY_DEPLOY paths (not repo dist)
    export FASTPAY_DEPLOY_BASE
    export STAGING_DASHBOARD_DIST_PATH="$FASTPAY_DEPLOY_BASE/dist/staging/fastpay"
    export STAGING_REDPAY_DIST_PATH="$FASTPAY_DEPLOY_BASE/dist/staging/redpay"
    
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
# Step 3b: Apply host nginx (so public URLs work)
# Run on the server where nginx is installed. Requires sudo.
# ----------------------------------------------------------------------------
if [[ "$APPLY_NGINX" == "yes" && "$SKIP_BACKEND" != "true" && "$DRY_RUN" != "true" ]]; then
    APPLY_SCRIPT="$SCRIPT_DIR/BACKEND/nginx/apply-staging-on-host.sh"
    if [[ -x "$APPLY_SCRIPT" ]]; then
        CURRENT_STEP="Step 3b: Applying host nginx (public URLs)"
        echo -e "${GREEN}${CURRENT_STEP}...${NC}"
        if sudo -n "$APPLY_SCRIPT" 2>/dev/null; then
            echo -e "${GREEN}Host nginx applied. Public URLs should be reachable.${NC}"
            APPLY_NGINX_DID_RUN=true
            APPLY_NGINX_OK=true
        else
            echo -e "${YELLOW}Could not apply host nginx (need to run on server with sudo, or use --skip-apply-nginx).${NC}"
            echo -e "${YELLOW}  On the staging server run: sudo $APPLY_SCRIPT${NC}"
            APPLY_NGINX_DID_RUN=true
        fi
        echo ""
    fi
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
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 -L https://staging.fastpaygaming.com/ 2>/dev/null || echo "000")
if [[ "$DASH_STATUS" == "200" || "$DASH_STATUS" == "302" ]]; then
    echo -e "${GREEN}Public dashboard: OK (HTTP $DASH_STATUS)${NC}"
else
    echo -e "${YELLOW}Public dashboard: HTTP $DASH_STATUS${NC}"
    PUBLIC_URLS_OK=false
fi

# Check public API
echo "Checking public API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 https://sapi.fastpaygaming.com/api/ 2>/dev/null || echo "000")
if [[ "$API_STATUS" == "200" ]]; then
    echo -e "${GREEN}Public API: OK (HTTP $API_STATUS)${NC}"
else
    echo -e "${YELLOW}Public API: HTTP $API_STATUS${NC}"
    PUBLIC_URLS_OK=false
fi

# Check public Admin
echo "Checking public Admin..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 -L https://sadmin.fastpaygaming.com/admin/ 2>/dev/null || echo "000")
if [[ "$ADMIN_STATUS" == "200" || "$ADMIN_STATUS" == "302" ]]; then
    echo -e "${GREEN}Public Admin: OK (HTTP $ADMIN_STATUS)${NC}"
else
    echo -e "${YELLOW}Public Admin: HTTP $ADMIN_STATUS${NC}"
    PUBLIC_URLS_OK=false
fi

# Check RedPay staging dashboard
echo "Checking RedPay staging dashboard..."
REDPAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 -L https://sredpay.fastpaygaming.com/ 2>/dev/null || echo "000")
if [[ "$REDPAY_STATUS" == "200" || "$REDPAY_STATUS" == "302" ]]; then
    echo -e "${GREEN}RedPay staging: OK (HTTP $REDPAY_STATUS)${NC}"
else
    echo -e "${YELLOW}RedPay staging: HTTP $REDPAY_STATUS${NC}"
    PUBLIC_URLS_OK=false
fi

# Check AXISURGENT (optional)
echo "Checking AXISURGENT..."
AXIS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -L https://axisurgent.fastpaygaming.com/ 2>/dev/null || echo "000")
if [[ "$AXIS_STATUS" == "200" || "$AXIS_STATUS" == "302" ]]; then
    echo -e "${GREEN}AXISURGENT: OK (HTTP $AXIS_STATUS)${NC}"
else
    echo -e "${YELLOW}AXISURGENT: HTTP $AXIS_STATUS${NC}"
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

# Post-deploy checks (DNS, HTTP, browser console)
if [[ "$SKIP_POSTDEPLOY_CHECKS" != "true" && -x "$SCRIPT_DIR/BACKEND/scripts/check-staging-postdeploy.sh" ]]; then
    echo ""
    echo "Running post-deploy checks..."
    if ! "$SCRIPT_DIR/BACKEND/scripts/check-staging-postdeploy.sh"; then
        echo -e "${RED}Post-deploy checks failed. Treat deploy as FAILED.${NC}" >&2
        notify_failure
        exit 1
    fi
    echo -e "${GREEN}Post-deploy checks passed${NC}"
fi

# ----------------------------------------------------------------------------
# Step 5: Push to GitHub (optional)
# ----------------------------------------------------------------------------
if [[ "$PUSH_TO_GITHUB" == "true" ]]; then
    CURRENT_STEP="Step 5: Pushing to GitHub"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    if git push origin main 2>/dev/null || git push origin master 2>/dev/null; then
        echo -e "${GREEN}Pushed to GitHub${NC}"
    else
        echo -e "${YELLOW}Could not push to GitHub (check remote, auth, or use --skip-push)${NC}"
    fi
    echo ""
fi

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Staging deployment completed!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Public URLs (all staging):"
echo "  FastPay:   https://staging.fastpaygaming.com/  (or http://localhost:8888/)"
echo "  RedPay:    https://sredpay.fastpaygaming.com/"
echo "  API:       https://sapi.fastpaygaming.com/api/  (or http://localhost:8001/api/)"
echo "  Admin:     https://sadmin.fastpaygaming.com/admin/"
echo "  AXISURGENT: https://axisurgent.fastpaygaming.com/"
echo ""
[[ "$PUSH_TO_GITHUB" != "true" ]] && echo "To push this deploy to GitHub: ./deploy-all.sh --push  (or add --push next run)" && echo ""

if [[ "$PUBLIC_URLS_OK" != "true" ]]; then
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}ACTION REQUIRED: Public URLs are not reachable${NC}"
    echo -e "${RED}=========================================${NC}"
    echo ""
    echo "Host nginx must be applied on the staging server so that:"
    echo "  staging.fastpaygaming.com, sapi, sadmin, sredpay resolve and proxy to the app."
    echo ""
    echo "On the staging server run:"
    echo -e "  ${GREEN}sudo $SCRIPT_DIR/BACKEND/nginx/apply-staging-on-host.sh${NC}"
    echo ""
    echo "Then reload nginx if needed: sudo nginx -t && sudo systemctl reload nginx"
    echo "See: BACKEND/nginx/STAGING_NGINX.md"
    echo ""
    if [[ "$REQUIRE_PUBLIC_URLS" == "true" ]]; then
        echo -e "${RED}Exiting with error (--require-public-urls).${NC}"
        notify_failure
        exit 1
    fi
elif [[ "$APPLY_NGINX_OK" != "true" && "$APPLY_NGINX" == "yes" && "$SKIP_BACKEND" != "true" ]]; then
    echo -e "${YELLOW}Tip: To apply host nginx on the server (if not done): sudo $SCRIPT_DIR/BACKEND/nginx/apply-staging-on-host.sh${NC}"
    echo ""
fi

# Send success notification
notify_success

exit 0

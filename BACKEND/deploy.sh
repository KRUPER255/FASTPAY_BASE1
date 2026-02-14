#!/bin/bash

# FastPay Backend Deployment Script
# Usage: ./deploy.sh [production|staging] [--no-input] [--skip-tests] [--skip-pull] [--no-rebuild] [--test-pattern PATTERN] [--skip-nginx-reload] [--skip-notify]
#   --no-input: skip superuser prompt and any other interactive prompts
#   --skip-tests: skip running Django tests during deploy
#   --skip-pull: do not run git pull (staging always uses local code only; this flag only affects production)
#   --no-rebuild: build Docker images using cache (faster; omit for full rebuild)
#   --test-pattern: run tests matching pattern (passed to manage.py test)
#   --skip-nginx-reload: skip nginx config validation/reload step
#   --skip-notify: skip Telegram notifications

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

ENVIRONMENT=production
SKIP_INPUT=false
SKIP_TESTS=false
SKIP_PULL=false
NO_REBUILD=false
SKIP_NGINX_RELOAD=false
SKIP_NOTIFY=false
TEST_PATTERN=""
CURRENT_STEP=""

if [[ "$1" == "production" || "$1" == "staging" ]]; then
    ENVIRONMENT="$1"
    shift
fi

# Staging always uses local code only (no git pull)
if [[ "$ENVIRONMENT" == "staging" ]]; then
    SKIP_PULL=true
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-input)
            SKIP_INPUT=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-pull)
            SKIP_PULL=true
            shift
            ;;
        --no-rebuild)
            NO_REBUILD=true
            shift
            ;;
        --skip-nginx-reload)
            SKIP_NGINX_RELOAD=true
            shift
            ;;
        --skip-notify)
            SKIP_NOTIFY=true
            shift
            ;;
        --test-pattern)
            TEST_PATTERN="${2:-}"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo "========================================="
ENV_FILE="${ENV_FILE:-.env.${ENVIRONMENT}}"

echo "FastPay Backend Deployment"
echo "Environment: $ENVIRONMENT"
echo "Env file: $ENV_FILE"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Telegram notification functions
send_telegram() {
    local msg=$1
    # Skip if notifications disabled or no credentials
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

notify_success() {
    local services_status
    services_status=$("${DOCKER_COMPOSE_CMD[@]}" ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 || echo "Unable to get status")
    
    local msg="✅ <b>FastPay Deploy SUCCESS</b>

<b>Environment:</b> ${ENVIRONMENT}
<b>Time:</b> $(date -Iseconds)
<b>Server:</b> $(hostname)

<b>Services:</b>
<code>${services_status}</code>"
    
    send_telegram "$msg"
}

notify_failure() {
    local step="${CURRENT_STEP:-Unknown step}"
    local msg="❌ <b>FastPay Deploy FAILED</b>

<b>Environment:</b> ${ENVIRONMENT}
<b>Failed at:</b> ${step}
<b>Time:</b> $(date -Iseconds)
<b>Server:</b> $(hostname)

Check logs: <code>${DOCKER_COMPOSE_CMD[*]} logs</code>"
    
    send_telegram "$msg"
}

# Error trap - notify on failure
on_error() {
    echo -e "${RED}Deployment failed at: ${CURRENT_STEP}${NC}"
    echo "To rollback: ./scripts/rollback.sh $ENVIRONMENT"
    echo "See: docs/DEPLOY_PROCESS.md docs/EASY_SECURE_DEPLOY_PLAN.md"
    notify_failure
    exit 1
}
trap on_error ERR

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Warning: $ENV_FILE not found. Creating from template...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
        echo -e "${RED}Please edit $ENV_FILE with your settings before continuing!${NC}"
        exit 1
    else
        echo -e "${RED}Error: .env.example not found. Cannot create $ENV_FILE${NC}"
        exit 1
    fi
fi

# Validate env file before loading (exit early if invalid)
if [[ -x "$PROJECT_DIR/scripts/validate-env.sh" ]]; then
    if ! "$PROJECT_DIR/scripts/validate-env.sh" "$ENV_FILE"; then
        echo -e "${RED}Env validation failed. Fix $ENV_FILE and retry.${NC}" >&2
        exit 1
    fi
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Use docker compose (v2) or docker-compose (v1)
COMPOSE_FILE="docker-compose.yml"
COMPOSE_PROJECT=""
API_PORT=8000
if [[ "$ENVIRONMENT" == "staging" ]]; then
    API_PORT=8001
    COMPOSE_PROJECT="fastpay-staging"
    if [[ -f "docker-compose.staging.yml" ]]; then
        COMPOSE_FILE="docker-compose.staging.yml"
    else
        echo -e "${YELLOW}Warning: docker-compose.staging.yml not found. Using docker-compose.yml.${NC}"
    fi
elif [[ "$ENVIRONMENT" == "production" ]]; then
    COMPOSE_PROJECT="fastpay-production"
fi

if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")
else
    DOCKER_COMPOSE_CMD=(docker-compose -f "$COMPOSE_FILE")
fi
if [[ -n "$COMPOSE_PROJECT" ]]; then
    DOCKER_COMPOSE_CMD+=(-p "$COMPOSE_PROJECT")
fi

# Export environment variables for docker-compose variable substitution
# Preserve dist paths if already set (e.g. by deploy-all.sh or deploy-production.sh)
SAVED_STAGING_DIST=""
SAVED_DASHBOARD_DIST=""
[[ -n "$STAGING_DASHBOARD_DIST_PATH" ]] && SAVED_STAGING_DIST="$STAGING_DASHBOARD_DIST_PATH"
[[ -n "$DASHBOARD_DIST_PATH" ]] && SAVED_DASHBOARD_DIST="$DASHBOARD_DIST_PATH"
echo -e "${GREEN}Loading environment variables from $ENV_FILE...${NC}"
# Avoid leaking secrets: disable debug output during env load
{ set +x; } 2>/dev/null || true
export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | grep -v '^#' | grep -v '^$' | xargs)
{ set -x; } 2>/dev/null || true
[[ -n "$SAVED_STAGING_DIST" ]] && export STAGING_DASHBOARD_DIST_PATH="$SAVED_STAGING_DIST"
[[ -n "$SAVED_DASHBOARD_DIST" ]] && export DASHBOARD_DIST_PATH="$SAVED_DASHBOARD_DIST"
# Production: health check and display use WEB_PORT from env (e.g. 8002 when 8000 is in use)
[[ "$ENVIRONMENT" == "production" && -n "${WEB_PORT:-}" ]] && API_PORT="$WEB_PORT"

# Staging: ensure FASTPAY_DEPLOY config exists; ensure FastPay/RedPay dists exist with placeholder if needed
if [[ "$ENVIRONMENT" == "staging" ]]; then
    FASTPAY_DEPLOY_BASE="${FASTPAY_DEPLOY_BASE:-/var/www/FASTPAY_DEPLOY}"
    CONFIG_FILE="$FASTPAY_DEPLOY_BASE/config/staging/backend.env"
    if [[ ! -f "$CONFIG_FILE" ]] && [[ -f ".env.staging" ]]; then
        echo -e "${GREEN}Copying .env.staging to FASTPAY_DEPLOY (first run or standalone deploy)${NC}"
        mkdir -p "$FASTPAY_DEPLOY_BASE/config/staging"
        cp .env.staging "$CONFIG_FILE" 2>/dev/null || sudo cp .env.staging "$CONFIG_FILE"
    fi
    export FASTPAY_DEPLOY_BASE
    [[ -z "$STAGING_DASHBOARD_DIST_PATH" ]] && export STAGING_DASHBOARD_DIST_PATH="$FASTPAY_DEPLOY_BASE/dist/staging/fastpay"
    [[ -z "$STAGING_REDPAY_DIST_PATH" ]] && export STAGING_REDPAY_DIST_PATH="$FASTPAY_DEPLOY_BASE/dist/staging/redpay"
    FASTPAY_DEST="${STAGING_DASHBOARD_DIST_PATH:-$FASTPAY_DEPLOY_BASE/dist/staging/fastpay}"
    if [[ ! -f "$FASTPAY_DEST/index.html" ]]; then
        echo -e "${YELLOW}Staging FastPay dashboard dist missing or empty at $FASTPAY_DEST. Creating placeholder so nginx returns 200 instead of 403.${NC}"
        mkdir -p "$FASTPAY_DEST"
        cat > "$FASTPAY_DEST/index.html" << 'PLACEHOLDER'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Staging Dashboard</title></head>
<body style="font-family:sans-serif;max-width:560px;margin:2em auto;padding:1em;">
<h1>Staging dashboard not built</h1>
<p>Build the FastPay dashboard so this page is replaced:</p>
<pre>cd DASHBOARD_FASTPAY && npm ci && ./deploy.sh staging</pre>
<p>Or from repo root: <code>./deploy-all.sh --no-input --skip-tests</code></p>
<p>See <a href="https://github.com/TBIRDS130/FASTPAY_BASE">FASTPAY_BASE</a> and <code>docs/VPS_DEPLOY_STRUCTURE.md</code>.</p>
</body></html>
PLACEHOLDER
        echo -e "${GREEN}Placeholder written to $FASTPAY_DEST/index.html${NC}"
    fi
    # RedPay staging: host nginx serves from STAGING_REDPAY_DIST_PATH or FASTPAY_DEPLOY
    REDPAY_DEST="${STAGING_REDPAY_DIST_PATH:-$FASTPAY_DEPLOY_BASE/dist/staging/redpay}"
    if [[ ! -f "$REDPAY_DEST/index.html" ]]; then
        echo -e "${YELLOW}Staging RedPay dashboard dist missing or empty at $REDPAY_DEST. Creating placeholder so sredpay returns 200 instead of 403.${NC}"
        mkdir -p "$REDPAY_DEST"
        cat > "$REDPAY_DEST/index.html" << 'PLACEHOLDER'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>RedPay Staging</title></head>
<body style="font-family:sans-serif;max-width:560px;margin:2em auto;padding:1em;">
<h1>RedPay staging dashboard not built</h1>
<p>Build the RedPay dashboard so this page is replaced:</p>
<pre>cd DASHBOARD_REDPAY && npm ci && ./deploy.sh staging</pre>
<p>Or from repo root: <code>./deploy-all.sh --no-input --skip-tests</code></p>
<p>See <a href="https://github.com/TBIRDS130/FASTPAY_BASE">FASTPAY_BASE</a> and <code>docs/VPS_DEPLOY_STRUCTURE.md</code>.</p>
</body></html>
PLACEHOLDER
        echo -e "${GREEN}Placeholder written to $REDPAY_DEST/index.html${NC}"
    fi
fi

if [[ "$SKIP_PULL" == "true" ]]; then
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        echo -e "${GREEN}Staging: using local code only (no git pull).${NC}"
    else
        echo -e "${YELLOW}Skipping git pull (--skip-pull). Using current tree.${NC}"
    fi
else
    CURRENT_STEP="Step 1: Pulling latest code"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    git pull origin main || echo "Warning: Could not pull from git"
fi

CURRENT_STEP="Step 2: Building Docker images"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
if [[ "$NO_REBUILD" == "true" ]]; then
    "${DOCKER_COMPOSE_CMD[@]}" build
else
    "${DOCKER_COMPOSE_CMD[@]}" build --no-cache
fi

if [[ "$SKIP_TESTS" == "true" ]]; then
    echo -e "${YELLOW}Skipping tests (--skip-tests).${NC}"
else
    # Ensure db is up and user can create test database
    "${DOCKER_COMPOSE_CMD[@]}" up -d db redis 2>/dev/null || true
    sleep 5
    if [[ -x "$PROJECT_DIR/scripts/grant-createdb.sh" ]]; then
        "$PROJECT_DIR/scripts/grant-createdb.sh" "$ENVIRONMENT" 2>/dev/null || echo -e "${YELLOW}Could not grant CREATEDB (tests may fail with 'permission denied to create database')${NC}"
    fi
    CURRENT_STEP="Step 3: Running test suite"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    TEST_CMD="python manage.py test"
    if [[ -n "$TEST_PATTERN" ]]; then
        TEST_CMD="$TEST_CMD $TEST_PATTERN"
    fi
    "${DOCKER_COMPOSE_CMD[@]}" run --rm -e USE_HTTPS=False web bash -c "$TEST_CMD"
fi

CURRENT_STEP="Step 4: Running database migrations"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
# Pass DB_* from host so web container matches db credentials (env_file can differ per context)
RUN_DB_ENV=()
[[ -n "${DB_ENGINE:-}" ]] && RUN_DB_ENV+=(-e "DB_ENGINE=$DB_ENGINE")
[[ -n "${DB_NAME:-}" ]] && RUN_DB_ENV+=(-e "DB_NAME=$DB_NAME")
[[ -n "${DB_USER:-}" ]] && RUN_DB_ENV+=(-e "DB_USER=$DB_USER")
[[ -n "${DB_PASSWORD:-}" ]] && RUN_DB_ENV+=(-e "DB_PASSWORD=$DB_PASSWORD")
[[ -n "${DB_HOST:-}" ]] && RUN_DB_ENV+=(-e "DB_HOST=$DB_HOST")
[[ -n "${DB_PORT:-}" ]] && RUN_DB_ENV+=(-e "DB_PORT=$DB_PORT")
"${DOCKER_COMPOSE_CMD[@]}" run --rm "${RUN_DB_ENV[@]}" web python manage.py migrate

# Staging: ensure default dashboard login user exists (superadmin@fastpay.com)
if [[ "$ENVIRONMENT" == "staging" ]]; then
    CURRENT_STEP="Step 4b: Ensure default dashboard user (staging)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    STAGING_PW="${STAGING_SUPERADMIN_PASSWORD:-$(openssl rand -base64 24 2>/dev/null || echo "changeme")}"
    "${DOCKER_COMPOSE_CMD[@]}" run --rm "${RUN_DB_ENV[@]}" web python manage.py create_super_admin \
        --email "superadmin@fastpay.com" \
        --password "$STAGING_PW" \
        --full-name "Super Administrator" || true
    echo -e "${GREEN}Default login: superadmin@fastpay.com / (password in BACKEND/.env.staging STAGING_SUPERADMIN_PASSWORD)${NC}"
fi

CURRENT_STEP="Step 5: Collecting static files"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
"${DOCKER_COMPOSE_CMD[@]}" run --rm "${RUN_DB_ENV[@]}" web python manage.py collectstatic --noinput

CURRENT_STEP="Step 6: Creating superuser (if needed)"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
if [[ "$SKIP_INPUT" == "true" ]]; then
    echo "Skipping superuser creation (--no-input)."
else
    echo "Do you want to create a superuser? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        "${DOCKER_COMPOSE_CMD[@]}" run --rm "${RUN_DB_ENV[@]}" web python manage.py createsuperuser
    fi
fi

CURRENT_STEP="Step 7: Starting services"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
"${DOCKER_COMPOSE_CMD[@]}" down
"${DOCKER_COMPOSE_CMD[@]}" up -d

CURRENT_STEP="Step 8: Waiting for services to be healthy"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
# Try API_PORT first (e.g. 8002), then default 8000 (in case mapping used default)
HEALTH_URL="http://localhost:${API_PORT}/health/"
HEALTH_URL_ALT="http://localhost:8000/health/"
MAX_WAIT=120
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    RESP=$(curl -s --connect-timeout 3 "$HEALTH_URL" 2>/dev/null || echo "")
    [[ "$RESP" != "ok" && -n "${HEALTH_URL_ALT:-}" ]] && RESP=$(curl -s --connect-timeout 3 "$HEALTH_URL_ALT" 2>/dev/null || echo "")
    if [[ "$RESP" == "ok" ]]; then
        echo -e "${GREEN}Backend is healthy (${ELAPSED}s)${NC}"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -n "."
done
if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    echo ""
    echo -e "${RED}Health check timed out after ${MAX_WAIT}s. Check: curl $HEALTH_URL or curl $HEALTH_URL_ALT${NC}"
    CURRENT_STEP="Services failed to become healthy"
    notify_failure
    exit 1
fi

# Check if services are running
if "${DOCKER_COMPOSE_CMD[@]}" ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Services are running successfully!${NC}"
    echo ""
    echo "========================================="
    echo "Deployment completed successfully!"
    echo "========================================="
    echo ""
    if [[ "$SKIP_NGINX_RELOAD" == "true" ]]; then
        echo -e "${YELLOW}Skipping nginx reload (--skip-nginx-reload).${NC}"
    else
        if "${DOCKER_COMPOSE_CMD[@]}" ps | grep -q "nginx"; then
            echo -e "${GREEN}Validating nginx configuration...${NC}"
            "${DOCKER_COMPOSE_CMD[@]}" exec -T nginx nginx -t
            echo -e "${GREEN}Reloading nginx...${NC}"
            "${DOCKER_COMPOSE_CMD[@]}" exec -T nginx nginx -s reload
        else
            echo -e "${YELLOW}Nginx service not running; skipping reload.${NC}"
        fi
    fi
    echo ""
    echo "Services:"
    "${DOCKER_COMPOSE_CMD[@]}" ps
    echo ""
    echo "API is available at: http://localhost:${API_PORT}"
    echo "Admin panel: http://localhost:${API_PORT}/admin"
    if [[ "$ENVIRONMENT" == "staging" ]] && "${DOCKER_COMPOSE_CMD[@]}" ps 2>/dev/null | grep -q "nginx"; then
        echo "Dashboard: http://localhost:8888/test/"
    fi
    echo ""
    echo "View logs: ${DOCKER_COMPOSE_CMD[*]} logs -f"
    echo "Stop services: ${DOCKER_COMPOSE_CMD[*]} down"
    
    # Send success notification
    notify_success
else
    echo -e "${RED}Error: Services failed to start. Check logs: ${DOCKER_COMPOSE_CMD[*]} logs${NC}"
    CURRENT_STEP="Services failed to start"
    notify_failure
    exit 1
fi

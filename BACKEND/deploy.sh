#!/bin/bash

# FastPay Backend Deployment Script
# Usage: ./deploy.sh [production|staging] [--no-input] [--skip-tests] [--skip-pull] [--no-rebuild] [--test-pattern PATTERN] [--skip-nginx-reload] [--skip-notify]
#   --no-input: skip superuser prompt and any other interactive prompts
#   --skip-tests: skip running Django tests during deploy
#   --skip-pull: do not run git pull (deploy current tree only)
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
echo -e "${GREEN}Loading environment variables from $ENV_FILE...${NC}"
export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

if [[ "$SKIP_PULL" == "true" ]]; then
    echo -e "${YELLOW}Skipping git pull (--skip-pull). Using current tree.${NC}"
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
"${DOCKER_COMPOSE_CMD[@]}" run --rm web python manage.py migrate

# Staging: ensure default dashboard login user exists (superadmin@fastpay.com / superadmin123)
if [[ "$ENVIRONMENT" == "staging" ]]; then
    CURRENT_STEP="Step 4b: Ensure default dashboard user (staging)"
    echo -e "${GREEN}${CURRENT_STEP}...${NC}"
    "${DOCKER_COMPOSE_CMD[@]}" run --rm web python manage.py create_super_admin \
        --email "superadmin@fastpay.com" \
        --password "superadmin123" \
        --full-name "Super Administrator" || true
    echo -e "${GREEN}Default login: superadmin@fastpay.com / superadmin123${NC}"
fi

CURRENT_STEP="Step 5: Collecting static files"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
"${DOCKER_COMPOSE_CMD[@]}" run --rm web python manage.py collectstatic --noinput

CURRENT_STEP="Step 6: Creating superuser (if needed)"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
if [[ "$SKIP_INPUT" == "true" ]]; then
    echo "Skipping superuser creation (--no-input)."
else
    echo "Do you want to create a superuser? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        "${DOCKER_COMPOSE_CMD[@]}" run --rm web python manage.py createsuperuser
    fi
fi

CURRENT_STEP="Step 7: Starting services"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
"${DOCKER_COMPOSE_CMD[@]}" down
"${DOCKER_COMPOSE_CMD[@]}" up -d

CURRENT_STEP="Step 8: Waiting for services to be healthy"
echo -e "${GREEN}${CURRENT_STEP}...${NC}"
sleep 10

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

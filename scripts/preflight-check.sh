#!/usr/bin/env bash
# Pre-flight checks before deploy. Exits 0 if all pass, 1 with clear errors otherwise.
# Usage: ./scripts/preflight-check.sh <staging|production> [--force] [--skip-health]
#   --force: skip health check (deploy even if current backend unhealthy)
#   --skip-health: same as --force

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENV="${1:-}"
SKIP_HEALTH=false
[[ "${2:-}" == "--force" || "${2:-}" == "--skip-health" ]] && SKIP_HEALTH=true
[[ "${3:-}" == "--force" || "${3:-}" == "--skip-health" ]] && SKIP_HEALTH=true

if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
    echo -e "${RED}Usage: $0 <staging|production> [--force|--skip-health]${NC}" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FAILED=0

check_ok() {
    echo -e "${GREEN}  OK: $1${NC}"
}

check_fail() {
    echo -e "${RED}  FAIL: $1${NC}" >&2
    [[ -n "$2" ]] && echo -e "       Fix: $2" >&2
    FAILED=1
}

echo "=== Pre-flight checks ($ENV) ==="
echo ""

# 1. Docker
echo "1. Docker"
if docker info >/dev/null 2>&1; then
    check_ok "Docker running"
else
    check_fail "Docker not running" "sudo systemctl start docker"
fi
echo ""

# 2. Node/npm
echo "2. Node/npm"
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NVER=$(node -v 2>/dev/null || echo "?")
    check_ok "Node $NVER, npm $(npm -v 2>/dev/null || echo "?")"
else
    check_fail "Node or npm not found" "Install Node 20 LTS: https://nodejs.org/"
fi
echo ""

# 3. Env files exist
echo "3. Env files"
ENV_FILE="$REPO_ROOT/BACKEND/.env.$ENV"
if [[ -f "$ENV_FILE" ]]; then
    check_ok "BACKEND/.env.$ENV exists"
else
    check_fail "BACKEND/.env.$ENV not found" "Run ./scripts/setup-${ENV}-first-time.sh"
fi
if [[ -f "$REPO_ROOT/DASHBOARD_FASTPAY/.env.$ENV" ]]; then
    check_ok "DASHBOARD_FASTPAY/.env.$ENV exists"
else
    check_fail "DASHBOARD_FASTPAY/.env.$ENV not found" "Copy from .env.example"
fi
if [[ -f "$REPO_ROOT/DASHBOARD_REDPAY/.env.$ENV" ]]; then
    check_ok "DASHBOARD_REDPAY/.env.$ENV exists"
else
    check_fail "DASHBOARD_REDPAY/.env.$ENV not found" "Copy from .env.example"
fi
echo ""

# 4. Env validation
echo "4. Env validation (secrets)"
if [[ -x "$REPO_ROOT/BACKEND/scripts/validate-env.sh" ]]; then
    if "$REPO_ROOT/BACKEND/scripts/validate-env.sh" "$ENV_FILE"; then
        check_ok "Secrets valid"
    else
        check_fail "Env validation failed" "Fix BACKEND/.env.$ENV (see output above)"
    fi
else
    echo -e "${YELLOW}  SKIP: validate-env.sh not found or not executable${NC}"
fi
echo ""

# 5. Disk space (>= 1GB free)
echo "5. Disk space"
FREE_GB=$(df -BG "$REPO_ROOT" 2>/dev/null | awk 'NR==2 {gsub(/G/,""); print $4}')
if [[ -n "$FREE_GB" && "$FREE_GB" -ge 1 ]] 2>/dev/null; then
    check_ok "${FREE_GB}GB free"
else
    check_fail "Less than 1GB free" "Free disk space"
fi
echo ""

# 6. Ports (informational only - don't fail)
echo "6. Ports"
if [[ "$ENV" == "staging" ]]; then
    for port in 8001 8888; do
        if (echo >/dev/tcp/localhost/$port) 2>/dev/null; then
            echo -e "${YELLOW}  Port $port in use (OK if FastPay already running)${NC}"
        else
            check_ok "Port $port available"
        fi
    done
else
    WEB_PORT=8000
    if [[ -f "$ENV_FILE" ]]; then
        wp=$(grep -E "^WEB_PORT=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
        [[ -n "$wp" ]] && WEB_PORT="$wp"
    fi
    if (echo >/dev/tcp/localhost/$WEB_PORT) 2>/dev/null; then
        echo -e "${YELLOW}  Port $WEB_PORT in use (OK if FastPay already running)${NC}"
    else
        check_ok "Port $WEB_PORT available"
    fi
fi
echo ""

# 7. Git (production: warn if dirty)
if [[ "$ENV" == "production" ]]; then
    echo "7. Git status"
    if [[ -d "$REPO_ROOT/.git" ]]; then
        if [[ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ]]; then
            echo -e "${YELLOW}  Working tree has uncommitted changes (production will pull; ensure you want latest)${NC}"
        else
            check_ok "Git clean"
        fi
    else
        check_fail "Not a git repo" "Clone the repo first"
    fi
    echo ""
fi

# 8. Health check (optional)
if [[ "$SKIP_HEALTH" != "true" ]]; then
    echo "8. Backend health (current deploy)"
    if [[ "$ENV" == "staging" ]]; then
        PORT=8001
    else
        PORT=8000
        if [[ -f "$ENV_FILE" ]]; then
            wp=$(grep -E "^WEB_PORT=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
            [[ -n "$wp" ]] && PORT="$wp"
        fi
    fi
    HEALTH=$(curl -s --connect-timeout 3 "http://localhost:${PORT}/health/" 2>/dev/null || echo "")
    if [[ "$HEALTH" == "ok" ]]; then
        check_ok "Backend healthy"
    else
        echo -e "${YELLOW}  Backend not healthy (curl localhost:${PORT}/health/ failed)${NC}"
        echo -e "  Use --force to deploy anyway, or fix current deploy first"
        # Don't fail - allow deploy with --force
    fi
    echo ""
fi

if [[ $FAILED -eq 1 ]]; then
    echo -e "${RED}Pre-flight checks failed. Fix issues above before deploying.${NC}" >&2
    echo "See docs/EASY_SECURE_DEPLOY_PLAN.md" >&2
    exit 1
fi

echo -e "${GREEN}Pre-flight checks passed.${NC}"
exit 0

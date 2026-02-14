#!/usr/bin/env bash
# Production "freshen up" check: runs preflight + post-deploy checks without deploying.
# Use for a quick verification that production is ready or that URLs are healthy.
#
# Usage:
#   ./scripts/check-production-ready.sh
#   PRODUCTION_BASE=/var/www/fastpay ./scripts/check-production-ready.sh
#   SKIP_BROWSER_CHECK=1 ./scripts/check-production-ready.sh   # skip Playwright in post-deploy
#
# Options:
#   --skip-preflight    Run only post-deploy checks (DNS, HTTP, browser)
#   --skip-postdeploy   Run only preflight checks (Docker, Node, env files)
#
# See: docs/DEPLOY_PROCESS.md, DEPLOYMENT.md

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE="${PRODUCTION_BASE:-$REPO_ROOT}"
cd "$BASE"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SKIP_PREFLIGHT=false
SKIP_POSTDEPLOY=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-preflight)  SKIP_PREFLIGHT=true; shift ;;
        --skip-postdeploy) SKIP_POSTDEPLOY=true; shift ;;
        *) shift ;;
    esac
done

echo "=== Production ready check ==="
echo "Base: $BASE"
echo ""

FAILED=0

# 1. Preflight (env, Docker, Node, optional health)
if [[ "$SKIP_PREFLIGHT" != "true" ]]; then
    echo "--- Preflight (production) ---"
    if [[ -x "$BASE/scripts/preflight-check.sh" ]]; then
        if ! "$BASE/scripts/preflight-check.sh" production; then
            echo -e "${RED}Preflight failed.${NC}" >&2
            FAILED=1
        fi
    else
        echo -e "${YELLOW}Preflight script not found; skipping.${NC}"
    fi
    echo ""
fi

# 2. Post-deploy checks (DNS, HTTP, optional browser console)
if [[ "$SKIP_POSTDEPLOY" != "true" ]]; then
    echo "--- Post-deploy checks (DNS, HTTP, browser) ---"
    if [[ -x "$BASE/BACKEND/scripts/check-production-postdeploy.sh" ]]; then
        if ! "$BASE/BACKEND/scripts/check-production-postdeploy.sh"; then
            echo -e "${RED}Post-deploy checks failed.${NC}" >&2
            FAILED=1
        fi
    else
        echo -e "${YELLOW}Post-deploy script not found; skipping.${NC}"
    fi
    echo ""
fi

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}Production ready check passed.${NC}"
    exit 0
else
    echo -e "${RED}One or more checks failed.${NC}" >&2
    exit 1
fi

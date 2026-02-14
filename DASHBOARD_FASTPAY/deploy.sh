#!/bin/bash
# Dashboard build/deploy script. Called by deploy-all.sh or standalone.
# Usage: ./deploy.sh [staging|production] [--skip-install]
#   staging:    build for staging (base path /, mode staging)
#   production: build for production (base path /)
#   --skip-install: skip npm install (use existing node_modules)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-staging}"
SKIP_INSTALL=false
[[ "${2:-}" == "--skip-install" ]] && SKIP_INSTALL=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ "$MODE" != "staging" && "$MODE" != "production" ]]; then
    echo -e "${RED}Usage: ./deploy.sh [staging|production] [--skip-install]${NC}" >&2
    exit 1
fi

echo "========================================="
echo "Dashboard deploy: $MODE"
echo "========================================="

if [[ "$SKIP_INSTALL" != "true" ]]; then
    echo -e "${GREEN}Installing dependencies...${NC}"
    npm install --legacy-peer-deps
fi

# Read VITE_API_BASE_URL from .env.<mode> and pass into build so it is always in the bundle
VITE_API_BASE_URL_VALUE=""
if [[ -f ".env.$MODE" ]]; then
    VITE_API_BASE_URL_VALUE=$(grep -E '^VITE_API_BASE_URL=' ".env.$MODE" 2>/dev/null | cut -d= -f2- || true)
fi
if [[ "$MODE" == "production" && -z "${VITE_API_BASE_URL_VALUE// }" ]]; then
    echo -e "${RED}ERROR: VITE_API_BASE_URL must be set in .env.production for production builds.${NC}" >&2
    exit 1
fi
export VITE_API_BASE_URL="$VITE_API_BASE_URL_VALUE"

if [[ "$MODE" == "staging" ]]; then
    echo -e "${GREEN}Building for staging (base: /)...${NC}"
    VITE_BASE_PATH=/ npm run build -- --mode staging
else
    echo -e "${GREEN}Building for production (base: /)...${NC}"
    VITE_API_BASE_URL="$VITE_API_BASE_URL_VALUE" VITE_BASE_PATH=/ npm run build -- --mode production
fi

if [[ ! -f "dist/index.html" ]]; then
    echo -e "${RED}Dashboard build failed - dist/index.html not found${NC}" >&2
    exit 1
fi

echo -e "${GREEN}Dashboard build complete: $SCRIPT_DIR/dist/${NC}"
ls -la dist/ | head -10
exit 0

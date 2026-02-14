#!/bin/bash
#
# Deploy production from /var/www: fetch code from GitHub then run full production deploy.
#
# Usage:
#   ./scripts/deploy-production-from-github.sh [options]
#   PRODUCTION_BASE=/var/www/fastpay ./scripts/deploy-production-from-github.sh
#
# Can be run:
#   - From the production server (e.g. cd /var/www/fastpay && ./scripts/deploy-production-from-github.sh)
#   - From any clone (syncs into PRODUCTION_BASE then deploys from there)
#
# Options (passed to deploy-production.sh after sync):
#   dashboard|backend|all   Deploy target (default: all)
#   --skip-dashboard        Skip dashboard build
#   --skip-backend          Skip backend deployment
#   --skip-redpay           Skip RedPay dashboard build
#   --skip-tests            Skip backend tests
#   --dry-run               Show what would be done
#
# Sync options (for fetch/pull):
#   --branch NAME   Branch to use (default: main)
#   --tag TAG       Deploy a specific tag (detached HEAD)
#   --commit SHA    Deploy a specific commit
#
# Environment:
#   PRODUCTION_BASE   Base path for production (default: /var/www/fastpay)
#   GITHUB_REPO_URL   Clone URL (default: origin of repo containing this script)
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE="${PRODUCTION_BASE:-/var/www/fastpay}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse sync options to pass to sync-from-github
SYNC_ARGS=(production)
DEPLOY_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --branch)   SYNC_ARGS+=(--branch "$2"); shift 2 ;;
        --tag)      SYNC_ARGS+=(--tag "$2"); shift 2 ;;
        --commit)   SYNC_ARGS+=(--commit "$2"); shift 2 ;;
        dashboard|backend|all) DEPLOY_ARGS+=("$1"); shift ;;
        --skip-dashboard|--skip-backend|--skip-redpay|--skip-tests|--dry-run|--no-input)
            DEPLOY_ARGS+=("$1"); shift ;;
        *) echo -e "${RED}Unknown option: $1${NC}" >&2; exit 1 ;;
    esac
done

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Production deploy (fetch from GitHub)${NC}"
echo -e "${GREEN}=========================================${NC}"
echo "Production base: $BASE"
echo ""

# 1. Sync: clone or pull into production base
if [[ -x "$REPO_ROOT/scripts/sync-from-github.sh" ]]; then
    echo -e "${GREEN}Step 1: Syncing from GitHub into $BASE...${NC}"
    REPO_BASE="$BASE" GITHUB_REPO_URL="${GITHUB_REPO_URL:-$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || true)}" \
        "$REPO_ROOT/scripts/sync-from-github.sh" "${SYNC_ARGS[@]}" || {
        echo -e "${RED}Sync failed. If $BASE does not exist, clone first, e.g.:${NC}" >&2
        echo "  sudo mkdir -p /var/www && sudo git clone \$(git -C \"$REPO_ROOT\" config --get remote.origin.url) $BASE" >&2
        exit 1
    }
else
    if [[ ! -d "$BASE/.git" ]]; then
        echo -e "${RED}$BASE is not a git repo and sync-from-github.sh not found. Clone the repo into $BASE first.${NC}" >&2
        exit 1
    fi
    echo -e "${GREEN}Step 1: Pulling latest in $BASE...${NC}"
    (cd "$BASE" && git pull origin main) || { echo -e "${RED}git pull failed${NC}" >&2; exit 1; }
fi
echo ""

# 2. Deploy from production base (no extra pull)
if [[ ! -x "$BASE/deploy-production.sh" ]]; then
    echo -e "${RED}$BASE/deploy-production.sh not found.${NC}" >&2
    exit 1
fi
echo -e "${GREEN}Step 2: Running production deploy...${NC}"
PRODUCTION_BASE="$BASE" "$BASE/deploy-production.sh" --skip-pull --no-input "${DEPLOY_ARGS[@]}"
echo -e "${GREEN}Done.${NC}"

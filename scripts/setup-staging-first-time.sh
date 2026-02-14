#!/bin/bash
#
# First-time staging setup: create base dir (on Desktop), clone repo, env files,
# DB-related config, and make all scripts executable. Run once for a new staging env.
#
# Usage:
#   From any clone: STAGING_BASE=/root/Desktop/FASTPAY_BASE ./scripts/setup-staging-first-time.sh
#   Or from repo root: ./scripts/setup-staging-first-time.sh
#
# Prerequisites: Docker, Docker Compose, Node/npm, git.
#
# After this script: edit BACKEND/.env.staging (SECRET_KEY, DB_*, FIREBASE_*, STAGING_DASHBOARD_DIST_PATH),
# then run: ./deploy.sh staging --no-input
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Staging on Desktop: default to current repo if we're already in a clone
BASE="${STAGING_BASE:-$REPO_ROOT}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}FastPay staging – first-time setup${NC}"
echo -e "${GREEN}=========================================${NC}"
echo "Staging base: $BASE"
echo ""

# 1. Ensure we have the repo (clone if BASE is empty or not a repo)
if [[ ! -d "$BASE/.git" ]]; then
    if [[ -d "$BASE" && "$(ls -A "$BASE" 2>/dev/null)" ]]; then
        echo -e "${RED}$BASE exists and is not empty; not a git repo. Use an empty dir or remove it.${NC}" >&2
        exit 1
    fi
    echo -e "${GREEN}Step 1: Cloning repo into $BASE...${NC}"
    mkdir -p "$BASE"
    REPO_URL="${GITHUB_REPO_URL:-$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || echo "https://github.com/TBIRDS130/FASTPAY_BASE.git")}"
    git clone --branch "${GITHUB_STAGING_BRANCH:-main}" "$REPO_URL" "$BASE" || {
        echo -e "${RED}Clone failed. Set GITHUB_REPO_URL.${NC}" >&2
        exit 1
    }
else
    echo -e "${GREEN}Step 1: Staging base already has repo. Updating...${NC}"
    if [[ -x "$BASE/scripts/sync-from-github.sh" ]]; then
        REPO_BASE="$BASE" "$BASE/scripts/sync-from-github.sh" staging || true
    else
        (cd "$BASE" && git pull origin main) || true
    fi
fi
echo ""

# 2. Make scripts executable
echo -e "${GREEN}Step 2: Making scripts executable...${NC}"
for f in deploy.sh deploy-all.sh deploy-production.sh BACKEND/deploy.sh BACKEND/scripts/validate-env.sh DASHBOARD_FASTPAY/deploy.sh DASHBOARD_REDPAY/deploy.sh scripts/sync-from-github.sh scripts/deploy-production-from-github.sh scripts/preflight-check.sh scripts/backup-before-deploy.sh scripts/rollback.sh scripts/create-fastpay-deploy-dirs.sh; do
    if [[ -f "$BASE/$f" ]]; then
        chmod +x "$BASE/$f"
    fi
done
echo -e "${GREEN}Done.${NC}"
echo ""

# 3. Env files from .env.example (do not overwrite existing)
echo -e "${GREEN}Step 3: Creating env files from .env.example (if missing)...${NC}"
for dir in BACKEND DASHBOARD_FASTPAY DASHBOARD_REDPAY; do
    if [[ -f "$BASE/$dir/.env.example" ]]; then
        if [[ ! -f "$BASE/$dir/.env.staging" ]]; then
            cp "$BASE/$dir/.env.example" "$BASE/$dir/.env.staging"
            echo "  Created $dir/.env.staging"
        else
            echo "  $dir/.env.staging already exists (not overwritten)"
        fi
    fi
done
echo ""

# 4. Create FASTPAY_DEPLOY structure and set FASTPAY_DEPLOY_BASE in BACKEND/.env.staging
echo -e "${GREEN}Step 4: Creating FASTPAY_DEPLOY structure and setting FASTPAY_DEPLOY_BASE...${NC}"
FASTPAY_DEPLOY_BASE="${FASTPAY_DEPLOY_BASE:-/var/www/FASTPAY_DEPLOY}"
if [[ -x "$BASE/scripts/create-fastpay-deploy-dirs.sh" ]]; then
    FASTPAY_DEPLOY_BASE="$FASTPAY_DEPLOY_BASE" sudo "$BASE/scripts/create-fastpay-deploy-dirs.sh" 2>/dev/null || \
    sudo bash "$BASE/scripts/create-fastpay-deploy-dirs.sh" 2>/dev/null || echo "  Run manually: sudo $BASE/scripts/create-fastpay-deploy-dirs.sh"
fi
ENV_STAGING="$BASE/BACKEND/.env.staging"
if [[ -f "$ENV_STAGING" ]]; then
    line="FASTPAY_DEPLOY_BASE=$FASTPAY_DEPLOY_BASE"
    if grep -q "^FASTPAY_DEPLOY_BASE=" "$ENV_STAGING" 2>/dev/null; then
        sed -i "s|^FASTPAY_DEPLOY_BASE=.*|${line}|" "$ENV_STAGING"
    else
        echo "$line" >> "$ENV_STAGING"
    fi
    echo "  FASTPAY_DEPLOY_BASE=$FASTPAY_DEPLOY_BASE"
    # Add STAGING_SUPERADMIN_PASSWORD if not present (random for first-time)
    if ! grep -q "^STAGING_SUPERADMIN_PASSWORD=" "$ENV_STAGING" 2>/dev/null; then
        PW=$(openssl rand -base64 24 2>/dev/null || echo "changeme")
        echo "STAGING_SUPERADMIN_PASSWORD=$PW" >> "$ENV_STAGING"
        echo "  STAGING_SUPERADMIN_PASSWORD set (random). Save this password for superadmin@fastpay.com"
    fi
else
    echo -e "${YELLOW}  BACKEND/.env.staging not found; create from BACKEND/.env.example${NC}"
fi
echo ""

# 4b. Secure env file permissions (owner read/write only)
for envf in "$BASE/BACKEND/.env.staging" "$BASE/DASHBOARD_FASTPAY/.env.staging" "$BASE/DASHBOARD_REDPAY/.env.staging"; do
    if [[ -f "$envf" ]]; then
        chmod 600 "$envf"
        echo "  chmod 600 $(basename "$(dirname "$envf")")/.env.staging"
    fi
done
echo ""

# 5. Database note
echo -e "${GREEN}Step 5: Database${NC}"
echo "  Using Docker Compose: PostgreSQL and Redis are created automatically on first deploy."
echo "  Ensure BACKEND/.env.staging has DB_NAME, DB_USER, DB_PASSWORD set."
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}First-time staging setup complete.${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit BACKEND/.env.staging:"
echo "     - SECRET_KEY, DB_PASSWORD, FIREBASE_*, STAGING_DASHBOARD_DIST_PATH (already set)"
echo "     - STAGING_SUPERADMIN_PASSWORD (already set for superadmin@fastpay.com)"
echo "     - ALLOWED_HOSTS, CORS for staging domains"
echo "  2. Place Firebase credentials at path set in FIREBASE_CREDENTIALS_PATH"
echo "  3. Edit DASHBOARD_FASTPAY/.env.staging and DASHBOARD_REDPAY/.env.staging (VITE_API_BASE_URL, VITE_FIREBASE_CONFIG)"
echo "  4. Deploy: cd $BASE && ./deploy.sh staging --no-input"
echo "  5. For public URLs: sudo ./BACKEND/nginx/apply-staging-on-host.sh"
echo ""

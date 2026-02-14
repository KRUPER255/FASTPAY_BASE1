#!/bin/bash
#
# First-time production setup: create base dir, clone repo, env files, DB-related
# config, and make all scripts executable. Run once on a new server under /var/www.
#
# Usage:
#   From any clone: PRODUCTION_BASE=/var/www/fastpay ./scripts/setup-production-first-time.sh
#   On server:      cd /var/www/fastpay && ./scripts/setup-production-first-time.sh
#
# Prerequisites: Docker, Docker Compose, Node/npm, git. Install before running.
#
# After this script: edit BACKEND/.env.production (SECRET_KEY, DB_*, FIREBASE_*, etc.),
# then run: ./scripts/deploy-production-from-github.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE="${PRODUCTION_BASE:-/var/www/fastpay}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}FastPay production – first-time setup${NC}"
echo -e "${GREEN}=========================================${NC}"
echo "Production base: $BASE"
echo ""

# 1. Create base dir and get code
if [[ ! -d "$BASE" ]]; then
    echo -e "${GREEN}Step 1: Creating $BASE and cloning repo...${NC}"
    sudo mkdir -p "$(dirname "$BASE")"
    REPO_URL="${GITHUB_REPO_URL:-$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || echo "https://github.com/TBIRDS130/FASTPAY_BASE.git")}"
    if sudo git clone --branch "${GITHUB_PRODUCTION_BRANCH:-main}" "$REPO_URL" "$BASE" 2>/dev/null; then
        echo -e "${GREEN}Cloned into $BASE${NC}"
    else
        echo -e "${YELLOW}Clone may need your user. Trying without sudo...${NC}"
        sudo chown "$(whoami):" "$(dirname "$BASE")" 2>/dev/null || true
        git clone --branch "${GITHUB_PRODUCTION_BRANCH:-main}" "$REPO_URL" "$BASE" || {
            echo -e "${RED}Clone failed. Set GITHUB_REPO_URL and ensure git can write to $(dirname "$BASE")${NC}" >&2
            exit 1
        }
    fi
elif [[ ! -d "$BASE/.git" ]]; then
    echo -e "${RED}$BASE exists but is not a git repo. Remove it or use another path.${NC}" >&2
    exit 1
else
    echo -e "${GREEN}Step 1: $BASE already exists. Updating from GitHub...${NC}"
    if [[ -x "$BASE/scripts/sync-from-github.sh" ]]; then
        REPO_BASE="$BASE" "$BASE/scripts/sync-from-github.sh" production || true
    else
        (cd "$BASE" && git pull origin main) || true
    fi
fi
echo ""

# 2. Make scripts executable
echo -e "${GREEN}Step 2: Making scripts executable...${NC}"
for f in deploy.sh deploy-all.sh deploy-production.sh BACKEND/deploy.sh BACKEND/scripts/validate-env.sh DASHBOARD_FASTPAY/deploy.sh DASHBOARD_REDPAY/deploy.sh scripts/sync-from-github.sh scripts/deploy-production-from-github.sh scripts/preflight-check.sh scripts/check-production-ready.sh scripts/backup-before-deploy.sh scripts/rollback.sh; do
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
        if [[ ! -f "$BASE/$dir/.env.production" ]]; then
            cp "$BASE/$dir/.env.example" "$BASE/$dir/.env.production"
            echo "  Created $dir/.env.production"
        else
            echo "  $dir/.env.production already exists (not overwritten)"
        fi
    fi
done
echo ""

# 4. Set dashboard dist path in BACKEND/.env.production
echo -e "${GREEN}Step 4: Setting dashboard paths in BACKEND/.env.production...${NC}"
ENV_PROD="$BASE/BACKEND/.env.production"
if [[ -f "$ENV_PROD" ]]; then
    for line in "DASHBOARD_DIST_PATH=$BASE/DASHBOARD_FASTPAY/dist" "STAGING_DASHBOARD_DIST_PATH=$BASE/DASHBOARD_FASTPAY/dist"; do
        key="${line%%=*}"
        if grep -q "^${key}=" "$ENV_PROD" 2>/dev/null; then
            sed -i "s|^${key}=.*|${line}|" "$ENV_PROD"
        else
            echo "$line" >> "$ENV_PROD"
        fi
    done
    echo "  DASHBOARD_DIST_PATH and STAGING_DASHBOARD_DIST_PATH set."
else
    echo -e "${YELLOW}  BACKEND/.env.production not found; create it from BACKEND/.env.example${NC}"
fi
echo ""

# 4b. Secure env file permissions (owner read/write only)
for envf in "$BASE/BACKEND/.env.production" "$BASE/DASHBOARD_FASTPAY/.env.production" "$BASE/DASHBOARD_REDPAY/.env.production"; do
    if [[ -f "$envf" ]]; then
        chmod 600 "$envf"
        echo "  chmod 600 $(basename "$(dirname "$envf")")/.env.production"
    fi
done
echo ""

# 5. Nginx / certbot dir (for host nginx + Let's Encrypt)
echo -e "${GREEN}Step 5: Creating /var/www/certbot for certbot (if needed)...${NC}"
if [[ -w /var/www ]] || sudo test -d /var/www 2>/dev/null; then
    sudo mkdir -p /var/www/certbot
    echo "  /var/www/certbot ready."
else
    echo -e "${YELLOW}  Skip: cannot create /var/www/certbot (create manually if using host nginx + certbot)${NC}"
fi
echo ""

# 6. Database note (Docker creates DB on first deploy)
echo -e "${GREEN}Step 6: Database${NC}"
echo "  Using Docker Compose: PostgreSQL and Redis are created automatically on first deploy."
echo "  Ensure BACKEND/.env.production has DB_NAME, DB_USER, DB_PASSWORD set (from .env.example)."
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}First-time setup complete.${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit BACKEND/.env.production:"
echo "     - SECRET_KEY (e.g. python3 -c \"import secrets; print(secrets.token_urlsafe(50))\")"
echo "     - DB_PASSWORD, FIREBASE_DATABASE_URL, FIREBASE_CREDENTIALS_PATH"
echo "     - ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, GOOGLE_* if using Gmail/Drive"
echo "  2. Place Firebase service account JSON at path set in FIREBASE_CREDENTIALS_PATH"
echo "  3. Edit DASHBOARD_FASTPAY/.env.production and DASHBOARD_REDPAY/.env.production (VITE_API_BASE_URL, VITE_FIREBASE_CONFIG)"
echo "  4. Deploy: cd $BASE && ./scripts/deploy-production-from-github.sh"
echo "  5. If host nginx serves static: sudo nginx -t && sudo systemctl reload nginx"
echo ""

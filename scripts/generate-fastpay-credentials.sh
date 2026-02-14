#!/bin/bash
#
# Generate FastPay credentials: SECRET_KEY and/or dashboard users (super admin or owner).
# Run from repo root. For user creation, backend must be running (Docker).
#
# Usage:
#   ./scripts/generate-fastpay-credentials.sh secret-key
#       → Print a new SECRET_KEY (paste into BACKEND/.env.staging or .env.production)
#
#   ./scripts/generate-fastpay-credentials.sh secret-key --write-backend
#       → Generate and write SECRET_KEY into BACKEND/.env.staging (or ENV_FILE)
#
#   ./scripts/generate-fastpay-credentials.sh super-admin [--password PASS]
#       → Create staging super admin (superadmin@fastpay.com). Default password: superadmin123
#
#   ./scripts/generate-fastpay-credentials.sh owner [--fastpay-password FP] [--redpay-password RP]
#       → Create owner users: Django Admin + FastPay (owner@fastpay.com) + RedPay (owner@redpay.com)
#
#   ENV_FILE= BACKEND/.env.production ./scripts/generate-fastpay-credentials.sh owner
#       → Use production compose; env file can be set for which backend to target.
#
# Staging: uses docker-compose.staging.yml -p fastpay-staging if BACKEND/.env.staging exists.
# Production: uses docker-compose.yml -p fastpay-production otherwise.
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/BACKEND"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect compose and project
if [[ -f "$BACKEND_DIR/.env.staging" ]]; then
    COMPOSE_FILE="$BACKEND_DIR/docker-compose.staging.yml"
    COMPOSE_PROJECT="fastpay-staging"
else
    COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"
    COMPOSE_PROJECT="fastpay-production"
fi
if docker compose version &>/dev/null; then
    DOCKER_CMD=(docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT")
else
    DOCKER_CMD=(docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT")
fi

cmd="${1:-}"
shift || true

case "$cmd" in
    secret-key)
        KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
        if [[ "$1" == "--write-backend" ]]; then
            ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env.staging}"
            if [[ ! -f "$ENV_FILE" ]]; then
                ENV_FILE="$BACKEND_DIR/.env.production"
            fi
            if [[ -f "$ENV_FILE" ]]; then
                if grep -q '^SECRET_KEY=' "$ENV_FILE" 2>/dev/null; then
                    sed -i "s/^SECRET_KEY=.*/SECRET_KEY=$KEY/" "$ENV_FILE"
                else
                    echo "SECRET_KEY=$KEY" >> "$ENV_FILE"
                fi
                echo -e "${GREEN}SECRET_KEY written to $ENV_FILE${NC}"
            else
                echo -e "${YELLOW}No .env.staging or .env.production found. Print only.${NC}"
                echo "$KEY"
            fi
        else
            echo -e "${GREEN}Add this to BACKEND/.env.staging or .env.production:${NC}"
            echo ""
            echo "SECRET_KEY=$KEY"
            echo ""
        fi
        exit 0
        ;;

    super-admin)
        EMAIL="superadmin@fastpay.com"
        PASSWORD="${SUPERADMIN_PASSWORD:-superadmin123}"
        FULL_NAME="Super Administrator"
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --password) PASSWORD="$2"; shift 2 ;;
                --email) EMAIL="$2"; shift 2 ;;
                --name) FULL_NAME="$2"; shift 2 ;;
                *) shift ;;
            esac
        done
        echo -e "${GREEN}Creating super admin (staging dashboard user)...${NC}"
        cd "$BACKEND_DIR"
        "${DOCKER_CMD[@]}" exec -T web python manage.py create_super_admin \
            --email "$EMAIL" --password "$PASSWORD" --full-name "$FULL_NAME"
        echo ""
        echo -e "${GREEN}Staging login:${NC} $EMAIL / $PASSWORD"
        exit 0
        ;;

    owner)
        FP_PASS="${FP_PASS:-fastpay123}"
        RP_PASS="${RP_PASS:-redpay123}"
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --fastpay-password) FP_PASS="$2"; shift 2 ;;
                --redpay-password) RP_PASS="$2"; shift 2 ;;
                *) shift ;;
            esac
        done
        echo -e "${GREEN}Creating owner credentials (Django Admin + FastPay + RedPay)...${NC}"
        cd "$BACKEND_DIR"
        "${DOCKER_CMD[@]}" exec -T web python manage.py create_owner_credentials \
            --fastpay-password "$FP_PASS" --redpay-password "$RP_PASS"
        echo ""
        echo -e "${GREEN}Owner login – FastPay & Django Admin:${NC} owner@fastpay.com / $FP_PASS"
        echo -e "${GREEN}Owner login – RedPay:${NC} owner@redpay.com / $RP_PASS"
        exit 0
        ;;

    *)
        echo "Usage: $0 <secret-key|super-admin|owner> [options]" >&2
        echo "" >&2
        echo "  secret-key           Generate SECRET_KEY (option: --write-backend to patch BACKEND/.env)" >&2
        echo "  super-admin          Create super admin (superadmin@fastpay.com). Option: --password PASS" >&2
        echo "  owner                Create owner users. Options: --fastpay-password, --redpay-password" >&2
        echo "" >&2
        echo "Examples:" >&2
        echo "  $0 secret-key" >&2
        echo "  $0 secret-key --write-backend" >&2
        echo "  $0 super-admin" >&2
        echo "  $0 super-admin --password MySecurePass" >&2
        echo "  $0 owner --fastpay-password FpPass --redpay-password RpPass" >&2
        exit 1
        ;;
esac

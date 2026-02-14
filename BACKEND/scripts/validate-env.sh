#!/usr/bin/env bash
# Validate env file before deploy. Exits 0 if valid, 1 with clear errors otherwise.
# Usage: ./BACKEND/scripts/validate-env.sh <env-file>
# Example: ./scripts/validate-env.sh .env.staging

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}Usage: $0 <env-file>${NC}" >&2
    echo "Env file must exist (e.g. .env.staging or .env.production)" >&2
    exit 1
fi

FAILED=0

# Read var without exporting (avoid leaking to parent)
get_var() {
    local key="$1"
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | head -1 || true
}

# Check required vars
check_required() {
    local key="$1"
    local val
    val=$(get_var "$key")
    if [[ -z "$val" || "$val" == *"your-"* || "$val" == *"changeme"* || "$val" == *"example"* ]]; then
        echo -e "${RED}FAIL: $key is missing, empty, or still has placeholder value${NC}" >&2
        FAILED=1
    fi
}

# Check SECRET_KEY length
check_secret_key() {
    local val
    val=$(get_var "SECRET_KEY")
    if [[ -z "$val" ]]; then
        echo -e "${RED}FAIL: SECRET_KEY is not set${NC}" >&2
        FAILED=1
    elif [[ ${#val} -lt 50 ]]; then
        echo -e "${RED}FAIL: SECRET_KEY must be at least 50 characters (current: ${#val})${NC}" >&2
        echo "  Generate: python3 -c \"import secrets; print(secrets.token_urlsafe(50))\"" >&2
        FAILED=1
    elif [[ "$val" == *"your-secret"* || "$val" == *"changeme"* ]]; then
        echo -e "${RED}FAIL: SECRET_KEY contains placeholder. Generate a secure key.${NC}" >&2
        FAILED=1
    fi
}

# Check DB vars
check_db() {
    check_required "DB_NAME"
    check_required "DB_USER"
    local pw
    pw=$(get_var "DB_PASSWORD")
    if [[ -z "$pw" ]]; then
        echo -e "${RED}FAIL: DB_PASSWORD is not set${NC}" >&2
        FAILED=1
    elif [[ "$pw" == *"your-secure"* || "$pw" == *"changeme"* ]]; then
        echo -e "${RED}FAIL: DB_PASSWORD contains placeholder. Set a secure password.${NC}" >&2
        FAILED=1
    fi
}

# Check Firebase vars
check_firebase() {
    local url
    url=$(get_var "FIREBASE_DATABASE_URL")
    if [[ -z "$url" || "$url" == *"your-project"* ]]; then
        echo -e "${RED}FAIL: FIREBASE_DATABASE_URL is missing or placeholder${NC}" >&2
        FAILED=1
    fi
    local creds
    creds=$(get_var "FIREBASE_CREDENTIALS_PATH")
    if [[ -z "$creds" ]]; then
        echo -e "${RED}FAIL: FIREBASE_CREDENTIALS_PATH is not set${NC}" >&2
        FAILED=1
    elif [[ "$creds" == *"your-"* ]]; then
        echo -e "${RED}FAIL: FIREBASE_CREDENTIALS_PATH contains placeholder${NC}" >&2
        FAILED=1
    fi
}

echo "Validating $ENV_FILE..."
check_secret_key
check_db
check_firebase

if [[ $FAILED -eq 1 ]]; then
    echo "" >&2
    echo -e "${RED}Env validation failed. Fix the issues above before deploying.${NC}" >&2
    echo "See BACKEND/.env.example for reference." >&2
    exit 1
fi

echo -e "${GREEN}Env validation OK${NC}"
exit 0

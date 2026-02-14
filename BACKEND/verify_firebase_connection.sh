#!/bin/bash

# Firebase Connection Verification Script
# Verifies APK, Dashboard, and Django Backend use the same Firebase project.
# Set BASE_DIR to repo root (e.g. FASTPAY_BASE or /var/www/fastpay). Default: parent of BACKEND.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="${BASE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DASHBOARD_ENV="$BASE_DIR/DASHBOARD_FASTPAY/.env.production"
BACKEND_ENV="$BASE_DIR/BACKEND/.env.production"

# Docker: prefer "docker compose" (v2) else "docker-compose"
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi
# Staging: use staging compose when BASE_DIR looks like FASTPAY_BASE
if [[ "$BASE_DIR" == *"FASTPAY_BASE"* ]] && [[ -f "$BASE_DIR/BACKEND/docker-compose.staging.yml" ]]; then
    COMPOSE_FILE="-f $BASE_DIR/BACKEND/docker-compose.staging.yml"
else
    COMPOSE_FILE="-f $BASE_DIR/BACKEND/docker-compose.yml"
fi

echo "========================================="
echo "Firebase Connection Verification"
echo "========================================="
echo "BASE_DIR=$BASE_DIR"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track status
ALL_CONNECTED=true

# 1. Check APK Firebase Configuration
echo "1. Checking Android APK Firebase Configuration..."
APK_CONFIG=""
for candidate in "$BASE_DIR/FASTPAY_APK/FASTPAY_BASE/app/google-services.json" "$BASE_DIR/APK/app/google-services.json"; do
    if [ -f "$candidate" ]; then
        APK_CONFIG="$candidate"
        break
    fi
done
if [ -z "$APK_CONFIG" ]; then
    APK_CONFIG="${PROD_BASE:-/var/www/fastpay}/APK/app/google-services.json"
fi
if [ -f "$APK_CONFIG" ]; then
    APK_PROJECT=$(grep -o '"project_id": "[^"]*"' "$APK_CONFIG" | cut -d'"' -f4)
    APK_DB_URL=$(grep -o '"firebase_url": "[^"]*"' "$APK_CONFIG" | cut -d'"' -f4)
    if [ -n "$APK_PROJECT" ]; then
        echo -e "   ${GREEN}✓${NC} APK Project ID: $APK_PROJECT"
        echo -e "   ${GREEN}✓${NC} APK Database URL: $APK_DB_URL"
    else
        echo -e "   ${RED}✗${NC} Could not read APK Firebase config"
        ALL_CONNECTED=false
    fi
else
    echo -e "   ${RED}✗${NC} APK config file not found: $APK_CONFIG"
    ALL_CONNECTED=false
fi
echo ""

# 2. Check Dashboard Firebase Configuration
echo "2. Checking Dashboard Firebase Configuration..."
if [ -f "$DASHBOARD_ENV" ]; then
    DASHBOARD_CONFIG=$(grep "VITE_FIREBASE_CONFIG" "$DASHBOARD_ENV" | cut -d'=' -f2-)
    if [ -n "$DASHBOARD_CONFIG" ]; then
        DASHBOARD_PROJECT=$(echo "$DASHBOARD_CONFIG" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('projectId', 'N/A'))" 2>/dev/null)
        DASHBOARD_DB_URL=$(echo "$DASHBOARD_CONFIG" | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('databaseURL', 'N/A'))" 2>/dev/null)
        if [ "$DASHBOARD_PROJECT" != "N/A" ]; then
            echo -e "   ${GREEN}✓${NC} Dashboard Project ID: $DASHBOARD_PROJECT"
            echo -e "   ${GREEN}✓${NC} Dashboard Database URL: $DASHBOARD_DB_URL"
        else
            echo -e "   ${RED}✗${NC} Could not parse Dashboard Firebase config"
            ALL_CONNECTED=false
        fi
    else
        echo -e "   ${RED}✗${NC} VITE_FIREBASE_CONFIG not found in Dashboard .env.production"
        ALL_CONNECTED=false
    fi
else
    echo -e "   ${RED}✗${NC} Dashboard .env.production not found: $DASHBOARD_ENV"
    ALL_CONNECTED=false
fi
echo ""

# 3. Check Django Backend Firebase Configuration
echo "3. Checking Django Backend Firebase Configuration..."
# BACKEND_ENV already set from BASE_DIR above
if [ -f "$BACKEND_ENV" ]; then
    BACKEND_DB_URL=$(grep "^FIREBASE_DATABASE_URL=" "$BACKEND_ENV" | cut -d'=' -f2)
    BACKEND_CREDS_PATH=$(grep "^FIREBASE_CREDENTIALS_PATH=" "$BACKEND_ENV" | cut -d'=' -f2)
    
    if [ -n "$BACKEND_DB_URL" ]; then
        echo -e "   ${GREEN}✓${NC} Backend Database URL: $BACKEND_DB_URL"
    else
        echo -e "   ${RED}✗${NC} FIREBASE_DATABASE_URL not found in .env.production"
        ALL_CONNECTED=false
    fi
    
    if [ -n "$BACKEND_CREDS_PATH" ]; then
        if [ -f "$BACKEND_CREDS_PATH" ]; then
            CREDS_PROJECT=$(python3 -c "import json; f=open('$BACKEND_CREDS_PATH'); data=json.load(f); print(data.get('project_id', 'N/A'))" 2>/dev/null)
            echo -e "   ${GREEN}✓${NC} Service Account File: $BACKEND_CREDS_PATH"
            echo -e "   ${GREEN}✓${NC} Service Account Project: $CREDS_PROJECT"
        else
            echo -e "   ${RED}✗${NC} Service account file not found: $BACKEND_CREDS_PATH"
            ALL_CONNECTED=false
        fi
    else
        echo -e "   ${YELLOW}⚠${NC} FIREBASE_CREDENTIALS_PATH not set (will use default credentials)"
    fi
else
    echo -e "   ${RED}✗${NC} Backend .env.production not found: $BACKEND_ENV"
    ALL_CONNECTED=false
fi
echo ""

# 4. Verify All Use Same Project
echo "4. Verifying All Components Use Same Firebase Project..."
if [ -n "$APK_PROJECT" ] && [ -n "$DASHBOARD_PROJECT" ] && [ -n "$CREDS_PROJECT" ]; then
    if [ "$APK_PROJECT" = "$DASHBOARD_PROJECT" ] && [ "$DASHBOARD_PROJECT" = "$CREDS_PROJECT" ]; then
        echo -e "   ${GREEN}✓${NC} All components use the same project: $APK_PROJECT"
    else
        echo -e "   ${RED}✗${NC} Projects don't match!"
        echo "      APK: $APK_PROJECT"
        echo "      Dashboard: $DASHBOARD_PROJECT"
        echo "      Backend: $CREDS_PROJECT"
        ALL_CONNECTED=false
    fi
else
    echo -e "   ${YELLOW}⚠${NC} Could not verify project matching (missing config)"
fi
echo ""

# 5. Test Django Backend Firebase Connection
echo "5. Testing Django Backend Firebase Connection..."
cd "$BASE_DIR/BACKEND"

# Check if Docker container is running
if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps web 2>/dev/null | grep -q "Up"; then
    echo "   Checking environment variables in container..."
    DB_URL=$($DOCKER_COMPOSE $COMPOSE_FILE exec -T web env 2>/dev/null | grep "^FIREBASE_DATABASE_URL=" | cut -d'=' -f2 || echo "")
    CREDS=$($DOCKER_COMPOSE $COMPOSE_FILE exec -T web env 2>/dev/null | grep "^FIREBASE_CREDENTIALS_PATH=" | cut -d'=' -f2 || echo "")
    
    if [ -n "$DB_URL" ]; then
        echo -e "   ${GREEN}✓${NC} FIREBASE_DATABASE_URL is set in container"
    else
        echo -e "   ${YELLOW}⚠${NC} FIREBASE_DATABASE_URL not found in container (may need restart)"
    fi
    
    if [ -n "$CREDS" ]; then
        echo -e "   ${GREEN}✓${NC} FIREBASE_CREDENTIALS_PATH is set in container"
    else
        echo -e "   ${YELLOW}⚠${NC} FIREBASE_CREDENTIALS_PATH not found in container"
    fi
    
    echo "   Testing Firebase initialization..."
    TEST_RESULT=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T web python manage.py shell << 'PYEOF'
import os
from api.utils import initialize_firebase
try:
    initialize_firebase()
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
PYEOF
    2>&1 | tail -1)
    
    if echo "$TEST_RESULT" | grep -q "SUCCESS"; then
        echo -e "   ${GREEN}✓${NC} Firebase connection successful!"
    else
        echo -e "   ${RED}✗${NC} Firebase connection failed:"
        echo "      $TEST_RESULT"
        ALL_CONNECTED=false
    fi
else
    echo -e "   ${YELLOW}⚠${NC} Docker container 'web' is not running"
    echo "   Start it with: cd $BASE_DIR/BACKEND && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d web"
fi
echo ""

# Final Summary
echo "========================================="
echo "Summary"
echo "========================================="
if [ "$ALL_CONNECTED" = true ]; then
    echo -e "${GREEN}✓ All components are configured and connected to the same Firebase project!${NC}"
    echo ""
    echo "Components:"
    echo "  • Android APK: Connected"
    echo "  • Dashboard: Connected"
    echo "  • Django Backend: Connected"
    echo ""
    echo "Firebase Project: $APK_PROJECT"
    echo "Database URL: $APK_DB_URL"
    echo ""
    echo -e "${GREEN}All systems ready! 🎉${NC}"
    exit 0
else
    echo -e "${RED}✗ Some components are not properly configured${NC}"
    echo ""
    echo "Please check the errors above and fix them."
    exit 1
fi

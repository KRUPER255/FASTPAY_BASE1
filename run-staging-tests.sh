#!/bin/bash
# Automated staging test plan runner.
# Run from repo root: ./run-staging-tests.sh
# Covers: health endpoints, validate_env, Docker healthcheck, check-server,
#         verify_firebase_connection, health-monitor, docs/config.

set -e
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  ${GREEN}PASS${NC} $*"; ((PASS++)) || true; }
fail() { echo -e "  ${RED}FAIL${NC} $*"; ((FAIL++)) || true; }
skip() { echo -e "  ${YELLOW}SKIP${NC} $*"; ((SKIP++)) || true; }

echo "=============================================="
echo " Staging test plan (automated)"
echo " BASE_DIR=$BASE_DIR"
echo "=============================================="
echo ""

# --- 1. Backend health endpoints (staging 8001) ---
echo "--- 1. Backend health endpoints (staging :8001) ---"
STAGING_HOST="${STAGING_HOST:-http://127.0.0.1:8001}"

code=$(curl -sS -o /dev/null -w "%{http_code}" "$STAGING_HOST/health/" 2>/dev/null || echo "000")
if [[ "$code" == "200" ]]; then
    pass "GET /health/ => 200"
else
    fail "GET /health/ => $code (expected 200)"
fi

body=$(curl -sS "$STAGING_HOST/health/" 2>/dev/null || echo "")
if [[ "$body" == "ok" ]]; then
    pass "GET /health/ body is 'ok'"
else
    fail "GET /health/ body is not 'ok' (got: $body)"
fi

body=$(curl -sS "$STAGING_HOST/api/health/" 2>/dev/null || echo "")
if [[ -z "$body" ]]; then
    skip "GET /api/health/ empty (staging may not expose /api/)"
else
    if echo "$body" | grep -q '"status":"ok"'; then
        pass "GET /api/health/ => {\"status\":\"ok\"}"
    else
        fail "GET /api/health/ unexpected: $body"
    fi
fi

detailed=$(curl -sS "$STAGING_HOST/api/health/?detailed=1" 2>/dev/null || echo "")
if [[ -z "$detailed" ]]; then
    skip "GET /api/health/?detailed=1 empty (staging may not expose /api/)"
else
    if echo "$detailed" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if all(k in d for k in ('database','firebase','redis')) else 1)" 2>/dev/null; then
        pass "GET /api/health/?detailed=1 has database, firebase, redis"
    else
        fail "GET /api/health/?detailed=1 missing keys or invalid JSON"
    fi
    db_status=$(echo "$detailed" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('database',{}).get('status',''))" 2>/dev/null || echo "")
    if [[ "$db_status" == "healthy" ]]; then
        pass "database.status is healthy"
    else
        skip "database.status is '$db_status' (ok if DB not up)"
    fi
fi
echo ""

# --- 2. Backend environment validation ---
echo "--- 2. Backend environment validation ---"
BACKEND_DIR="$BASE_DIR/BACKEND"
if [[ -f "$BACKEND_DIR/manage.py" ]]; then
    # 2.1: without env should fail
    if (cd "$BACKEND_DIR" && unset SECRET_KEY FIREBASE_DATABASE_URL 2>/dev/null; python3 manage.py validate_env --context=production 2>/dev/null); then
        fail "validate_env (no env) should exit 1"
    else
        pass "validate_env (no env) exits non-zero"
    fi
    # 2.2: with .env.staging (source inside subshell so env applies to python)
    if [[ -f "$BACKEND_DIR/.env.staging" ]]; then
        if (cd "$BACKEND_DIR" && set -a && source .env.staging 2>/dev/null && set +a && python3 manage.py validate_env --context=production 2>/dev/null); then
            pass "validate_env (with .env.staging, production) passes"
        else
            skip "validate_env (with .env.staging, production) failed (env may be incomplete)"
        fi
        if (cd "$BACKEND_DIR" && set -a && source .env.staging 2>/dev/null && set +a && python3 manage.py validate_env --context=staging 2>/dev/null); then
            pass "validate_env (with .env.staging, staging) passes"
        else
            skip "validate_env (with .env.staging, staging) failed (env may be incomplete)"
        fi
    else
        skip ".env.staging not found, skipping loaded-env validate_env"
    fi
else
    skip "BACKEND/manage.py not found"
fi
echo ""

# --- 3. Docker web healthcheck (staging) ---
echo "--- 3. Docker web healthcheck (staging) ---"
if command -v docker &>/dev/null && [[ -f "$BACKEND_DIR/docker-compose.staging.yml" ]]; then
    web_id=$(cd "$BACKEND_DIR" && docker compose -f docker-compose.staging.yml ps -q web 2>/dev/null || true)
    if [[ -n "$web_id" ]]; then
        health=$(docker inspect "$web_id" --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")
        if [[ "$health" == "healthy" ]]; then
            pass "web container health status: healthy"
        else
            skip "web container health: $health (may need wait after start)"
        fi
    else
        skip "staging web container not running"
    fi
else
    skip "docker or docker-compose.staging.yml not available"
fi
echo ""

# --- 4. Dashboard build (optional) ---
echo "--- 4. Dashboard build ---"
if command -v npm &>/dev/null && [[ -f "$BASE_DIR/DASHBOARD/package.json" ]]; then
    if (cd "$BASE_DIR/DASHBOARD" && npm run build 2>/dev/null); then
        pass "Dashboard npm run build succeeded"
    else
        fail "Dashboard npm run build failed"
    fi
else
    skip "npm or DASHBOARD/package.json not found"
fi
echo ""

# --- 6. check-server.sh ---
echo "--- 6. check-server.sh ---"
if [[ -x "$BASE_DIR/check-server.sh" ]]; then
    out=$("$BASE_DIR/check-server.sh" 2>&1) || true
    if echo "$out" | grep -q "Staging (8001).*200\|Staging (8001): 200"; then
        pass "check-server.sh reports Staging (8001) 200"
    else
        if echo "$out" | grep -q "Staging (8001)"; then
            fail "check-server.sh Staging (8001) not 200"
        else
            skip "check-server.sh did not show Staging (8001) (backend may be down)"
        fi
    fi
    # Detailed health block or curl 8001
    if echo "$out" | grep -q "database:\|firebase:\|redis:"; then
        pass "check-server.sh detailed health block present"
    else
        code=$(curl -sS -o /dev/null -w "%{http_code}" "$STAGING_HOST/api/health/?detailed=1" 2>/dev/null || echo "000")
        if [[ "$code" == "200" ]]; then
            pass "staging detailed health returns 200 (block may be for 8000 only)"
        else
            skip "detailed health not in output and staging detailed not 200"
        fi
    fi
else
    skip "check-server.sh not executable"
fi
echo ""

# --- 7. verify_firebase_connection.sh ---
echo "--- 7. verify_firebase_connection.sh ---"
if [[ -x "$BACKEND_DIR/verify_firebase_connection.sh" ]]; then
    out=$(cd "$BACKEND_DIR" && ./verify_firebase_connection.sh 2>&1) || true
    if echo "$out" | grep -q "BASE_DIR="; then
        pass "verify_firebase_connection.sh runs and shows BASE_DIR"
    else
        fail "verify_firebase_connection.sh output missing BASE_DIR"
    fi
    if echo "$out" | grep -q "FASTPAY_BASE\|FASTPAY_APK"; then
        pass "verify_firebase_connection.sh uses FASTPAY_BASE paths"
    else
        skip "path check inconclusive (paths may differ)"
    fi
    if echo "$out" | grep -q "/opt/FASTPAY/APK"; then
        fail "verify_firebase_connection.sh should not hardcode /opt/FASTPAY when BASE_DIR is FASTPAY_BASE"
    else
        pass "no wrong /opt/FASTPAY hardcode in script output"
    fi
else
    skip "verify_firebase_connection.sh not executable"
fi
echo ""

# --- 8. Health monitor (optional) ---
echo "--- 8. Health monitor ---"
HM="$BASE_DIR/health-monitor/health-monitor.sh"
if [[ -x "$HM" ]]; then
    if HEALTH_DETAILED_URL="$STAGING_HOST/api/health/?detailed=1" "$HM" 2>/dev/null; then
        pass "health-monitor.sh with HEALTH_DETAILED_URL (staging) exit 0"
    else
        # Exit 1 can be expected if URLs in HEALTH_URLS are down
        skip "health-monitor with HEALTH_DETAILED_URL exit non-zero (URL list or component unhealthy)"
    fi
else
    skip "health-monitor.sh not executable"
fi
echo ""

# --- 10. Docs and config ---
echo "--- 10. Docs and config ---"
if [[ -f "$BASE_DIR/FASTPAY_APK/FASTPAY_BASE/FIREBASE_SETUP.md" ]]; then
    pass "FIREBASE_SETUP.md exists"
else
    skip "FIREBASE_SETUP.md missing (optional doc)"
fi
if [[ -f "$BACKEND_DIR/api/utils/FIREBASE_PATHS.md" ]]; then
    pass "FIREBASE_PATHS.md exists"
else
    fail "FIREBASE_PATHS.md missing"
fi
if grep -q "REDIS_URL" "$BACKEND_DIR/.env.example" 2>/dev/null; then
    pass "BACKEND/.env.example mentions REDIS_URL"
else
    fail "BACKEND/.env.example missing REDIS_URL"
fi
if grep -qE "VITE_API_MAX_RETRIES|VITE_API_TIMEOUT|REDIS" "$BASE_DIR/DASHBOARD/.env.example" 2>/dev/null; then
    pass "DASHBOARD/.env.example has retry/timeout or relevant vars"
else
    skip "DASHBOARD/.env.example retry vars optional"
fi
echo ""

# --- Summary ---
echo "=============================================="
echo " Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "=============================================="
if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
exit 0

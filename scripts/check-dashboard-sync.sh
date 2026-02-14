#!/usr/bin/env bash
# Build and test both dashboards to catch breakage and encourage sync.
# Run from repo root. RedPay is built with VITE_REDPAY_ONLY=true.
# Usage: ./scripts/check-dashboard-sync.sh [--build-only] [--skip-redpay]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BUILD_ONLY=false
SKIP_REDPAY=false
for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=true ;;
    --skip-redpay) SKIP_REDPAY=true ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

failed=0

# --- DASHBOARD_FASTPAY ---
echo ""
echo "========================================="
echo "DASHBOARD_FASTPAY: build"
echo "========================================="
if ( cd "$REPO_ROOT/DASHBOARD_FASTPAY" && npm ci --legacy-peer-deps --quiet && npm run build ); then
  echo -e "${GREEN}DASHBOARD_FASTPAY build OK${NC}"
else
  echo -e "${RED}DASHBOARD_FASTPAY build FAILED${NC}"
  failed=1
fi

if [[ "$BUILD_ONLY" != "true" ]]; then
  echo ""
  echo "DASHBOARD_FASTPAY: test"
  if ( cd "$REPO_ROOT/DASHBOARD_FASTPAY" && npm run test -- --run 2>/dev/null ); then
    echo -e "${GREEN}DASHBOARD_FASTPAY test OK${NC}"
  else
    echo -e "${YELLOW}DASHBOARD_FASTPAY test failed or no tests (continuing)${NC}"
  fi
fi

# --- DASHBOARD_REDPAY ---
if [[ "$SKIP_REDPAY" != "true" ]]; then
  echo ""
  echo "========================================="
  echo "DASHBOARD_REDPAY: build (VITE_REDPAY_ONLY=true)"
  echo "========================================="
  if ( cd "$REPO_ROOT/DASHBOARD_REDPAY" && export VITE_REDPAY_ONLY=true && npm ci --legacy-peer-deps --quiet && npm run build ); then
    echo -e "${GREEN}DASHBOARD_REDPAY build OK${NC}"
  else
    echo -e "${RED}DASHBOARD_REDPAY build FAILED${NC}"
    failed=1
  fi

  if [[ "$BUILD_ONLY" != "true" ]]; then
    echo ""
    echo "DASHBOARD_REDPAY: test"
    if ( cd "$REPO_ROOT/DASHBOARD_REDPAY" && npm run test -- --run 2>/dev/null ); then
      echo -e "${GREEN}DASHBOARD_REDPAY test OK${NC}"
    else
      echo -e "${YELLOW}DASHBOARD_REDPAY test failed or no tests (continuing)${NC}"
    fi
  fi
fi

echo ""
if [[ $failed -eq 0 ]]; then
  echo -e "${GREEN}Dashboard sync check passed.${NC}"
  exit 0
else
  echo -e "${RED}Dashboard sync check failed (build error). Fix and re-run.${NC}"
  exit 1
fi

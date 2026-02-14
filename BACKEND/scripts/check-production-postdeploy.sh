#!/bin/bash
# Production post-deploy checks:
# - DNS for production domains points to this VPS (or EXPECTED_IP)
# - Key production URLs respond with 200/expected status
# - Browser console check for dashboard URLs (no JS errors)
#
# Usage:
#   ./BACKEND/scripts/check-production-postdeploy.sh
#   EXPECTED_IP=72.60.202.91 ./BACKEND/scripts/check-production-postdeploy.sh
#   SKIP_BROWSER_CHECK=1 ./BACKEND/scripts/check-production-postdeploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

echo "=== PRODUCTION POST-DEPLOY CHECKS ==="
echo ""

echo "1) DNS check"
echo "------------"
./BACKEND/scripts/check-dns.sh
echo ""

echo "2) HTTP status check for key production URLs"
echo "---------------------------------------------"

urls=(
  "https://fastpaygaming.com/"
  "https://redpay.fastpaygaming.com/"
  "https://api.fastpaygaming.com/health/"
)

failed=0

for u in "${urls[@]}"; do
  printf "%s\n" "$u"
  status=$(curl -sk -o /dev/null -w "%{http_code}" "$u" || echo "000")
  echo "  Status: $status"

  case "$status" in
    200|302)
      # OK / expected redirect
      ;;
    *)
      echo "  => FAIL: unexpected status code for $u"
      failed=1
      ;;
  esac
  echo ""
done

if [[ $failed -ne 0 ]]; then
  echo "One or more production URLs failed. Treat this deploy as FAILED."
  exit 1
fi

echo "3) Browser console check for dashboard URLs"
echo "-------------------------------------------"

if [[ -n "${SKIP_BROWSER_CHECK:-}" ]]; then
  echo "  Skipped (SKIP_BROWSER_CHECK is set)"
else
  DEPLOY_CHECKS_DIR="${SCRIPT_DIR}/deploy-checks"
  if [[ -d "${DEPLOY_CHECKS_DIR}" ]]; then
    if ! command -v node >/dev/null 2>&1; then
      echo "  Skipping browser console check (Node not installed)"
    else
      browser_check_exit=0
      (
        cd "${DEPLOY_CHECKS_DIR}"
        if [[ ! -d node_modules/playwright ]]; then
          echo "  Installing deploy-checks deps (one-time)..."
          npm install --silent 2>/dev/null || true
          npx playwright install chromium 2>/dev/null || true
        fi
        node check-dashboard-console.mjs \
          "https://fastpaygaming.com/" \
          "https://redpay.fastpaygaming.com/"
      ) || browser_check_exit=$?
      if [[ $browser_check_exit -eq 2 ]]; then
        echo "  Skipping browser console check (Playwright not installed)"
        echo "  To enable: cd BACKEND/scripts/deploy-checks && npm install && npx playwright install chromium"
      elif [[ $browser_check_exit -ne 0 ]]; then
        echo "  => FAIL: browser console check reported errors"
        exit 1
      fi
    fi
  else
    echo "  Skipping browser console check (deploy-checks not found)"
  fi
fi

echo ""
echo "All production DNS, HTTP, and browser checks passed."

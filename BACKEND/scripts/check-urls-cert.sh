#!/bin/bash
# Check HTTPS and certificate for fastpaygaming.com URLs.
# Exits 0 if every URL returns HTTP 2xx/3xx and SSL_verify 0; otherwise exits 1.
# Run from repo root. Uses sudo only for the certbot summary at the end.
#
# Usage:
#   ./BACKEND/scripts/check-urls-cert.sh
#
# Optional env:
#   CHECK_URLS     Newline-separated list of URLs to check (default: built-in list).
#   EXPECTED_CODES Space-separated HTTP codes to accept (default: any 200-399).

set -euo pipefail

# Default URL list (production + staging + welcome). owner.fastpaygaming.com not in use on this VPS.
DEFAULT_URLS=(
  "https://fastpaygaming.com/"
  "https://www.fastpaygaming.com/"
  "https://api.fastpaygaming.com/"
  "https://api.fastpaygaming.com/health/"
  "https://admin.fastpaygaming.com/"
  "https://redpay.fastpaygaming.com/"
  "https://staging.fastpaygaming.com/"
  "https://sapi.fastpaygaming.com/api/"
  "https://sadmin.fastpaygaming.com/admin/"
  "https://sredpay.fastpaygaming.com/"
  "https://csapay.fastpaygaming.com/"
  "https://bropay.fastpaygaming.com/"
  "https://hypay.fastpaygaming.com/"
  "https://kypay.fastpaygaming.com/"
)

URLS=()
if [[ -n "${CHECK_URLS:-}" ]]; then
  while IFS= read -r u; do
    [[ -n "$u" ]] && URLS+=("$u")
  done <<< "$CHECK_URLS"
fi
[[ ${#URLS[@]} -eq 0 ]] && URLS=("${DEFAULT_URLS[@]}")

# Optional: restrict accepted HTTP codes (default: 200-399)
ACCEPT_200_399=true
if [[ -n "${EXPECTED_CODES:-}" ]]; then
  ACCEPT_200_399=false
  EXPECTED_CODES_ARR=($EXPECTED_CODES)
fi

echo "=== Certificate and HTTPS check for fastpaygaming.com URLs ==="
echo "SSL_verify: 0=OK, 1=invalid/missing, 2=hostname mismatch"
echo ""

passed=0
failed=0
total=${#URLS[@]}

for url in "${URLS[@]}"; do
  echo "--- $url ---"
  ret=0
  out=$(curl -sS -o /dev/null -w "HTTP %{http_code}  SSL_verify %{ssl_verify_result}" --connect-timeout 10 "$url" 2>&1) || ret=$?
  http_code=$(echo "$out" | sed -n 's/.*HTTP \([0-9]*\).*/\1/p')
  ssl_verify=$(echo "$out" | sed -n 's/.*SSL_verify \([0-9]*\).*/\1/p')

  ok=false
  if [[ $ret -eq 0 && "$ssl_verify" == "0" ]]; then
    if [[ "$ACCEPT_200_399" == "true" ]]; then
      if [[ -n "$http_code" && "$http_code" -ge 200 && "$http_code" -le 399 ]]; then
        ok=true
      fi
    else
      for c in "${EXPECTED_CODES_ARR[@]:-}"; do
        [[ "$c" == "$http_code" ]] && ok=true && break
      done
    fi
  fi

  if [[ "$ok" == "true" ]]; then
    echo "$out  (0 = cert OK)"
    ((passed++)) || true
  else
    echo "FAIL (exit $ret): ${out:-no output}"
    echo "  (SSL_verify: 0=OK, 1=cert missing/invalid, 2=hostname mismatch)"
    ((failed++)) || true
  fi
  echo ""
done

echo "=== Certbot certificates (fastpaygaming.com) ==="
if sudo certbot certificates 2>/dev/null | grep -E "Certificate Name:|Domains:|Expiry|Certificate Path:"; then
  :
else
  echo "Certbot not available (install certbot and run as root to see certificate list)."
fi

echo ""
echo "=== Summary ==="
if [[ $failed -eq 0 ]]; then
  echo "PASS: $passed/$total URLs (HTTP 2xx/3xx + SSL OK)"
  exit 0
else
  echo "FAIL: $passed/$total URLs passed, $failed failed"
  exit 1
fi

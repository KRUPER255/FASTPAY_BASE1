#!/bin/bash
# Check HTTPS and certificate for all fastpaygaming.com URLs.
# Usage: ./check-urls-cert.sh

URLS=(
  "https://fastpaygaming.com/"
  "https://www.fastpaygaming.com/"
  "https://api.fastpaygaming.com/"
  "https://staging.fastpaygaming.com/"
  "https://api-staging.fastpaygaming.com/api/"
  "https://admin-staging.fastpaygaming.com/admin/"
  "https://owner.fastpaygaming.com/"
)

echo "=== Certificate and HTTPS check for fastpaygaming.com URLs ==="
echo ""

for url in "${URLS[@]}"; do
  echo "--- $url ---"
  out=$(curl -sS -o /dev/null -w "HTTP %{http_code}  SSL_verify %{ssl_verify_result}" --connect-timeout 10 "$url" 2>&1)
  ret=$?
  if [[ $ret -eq 0 ]]; then
    echo "$out  (0 = cert OK)"
  else
    echo "FAIL (exit $ret): ${out:-no output}"
    echo "  (SSL_verify: 0=OK, 1=cert missing/invalid, 2=hostname mismatch)"
  fi
  echo ""
done

echo "=== Certbot certificates (fastpaygaming.com) ==="
sudo certbot certificates 2>/dev/null | grep -E "Certificate Name:|Domains:|Expiry|Certificate Path:" || true

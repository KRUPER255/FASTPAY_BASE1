#!/bin/bash
# DNS A-record check: verify that key domains resolve to the expected IPv4.
# Exits 0 only if every domain has an A record matching EXPECTED_IP.
#
# Usage:
#   ./BACKEND/scripts/check-dns-a.sh
#   EXPECTED_IP=1.2.3.4 ./BACKEND/scripts/check-dns-a.sh
#
# Use from repo root: ./scripts/check-dns-a.sh (wrapper) or ./BACKEND/scripts/check-dns-a.sh

set -euo pipefail

DOMAINS=(
  "fastpaygaming.com"
  "api.fastpaygaming.com"
  "admin.fastpaygaming.com"
  "redpay.fastpaygaming.com"
  "staging.fastpaygaming.com"
  "sapi.fastpaygaming.com"
  "sadmin.fastpaygaming.com"
  "sredpay.fastpaygaming.com"
)

if [[ -z "${EXPECTED_IP:-}" ]]; then
  EXPECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [[ -z "${EXPECTED_IP:-}" ]]; then
  echo "ERROR: Could not determine EXPECTED_IP. Set EXPECTED_IP=1.2.3.4" >&2
  exit 1
fi

if ! command -v dig >/dev/null 2>&1; then
  echo "ERROR: dig is required. Install bind9-dnsutils or dnsutils." >&2
  exit 1
fi

failed=0
echo "DNS A-record check (expected IPv4: ${EXPECTED_IP})"
echo ""

for domain in "${DOMAINS[@]}"; do
  ips=$(dig +short A "${domain}" | sort -u)
  if [[ -z "${ips}" ]]; then
    echo "  ${domain}: no A record  [FAIL]"
    failed=1
    continue
  fi
  match=""
  while IFS= read -r ip; do
    [[ -z "$ip" ]] && continue
    if [[ "$ip" == "$EXPECTED_IP" ]]; then
      match=1
      break
    fi
  done <<< "${ips}"
  if [[ -n "$match" ]]; then
    echo "  ${domain}: ${EXPECTED_IP}  [OK]"
  else
    echo "  ${domain}: $(echo "$ips" | tr '\n' ' ') (expected ${EXPECTED_IP})  [FAIL]"
    failed=1
  fi
done

echo ""
if [[ $failed -eq 1 ]]; then
  echo "DNS A check FAILED: one or more domains do not point at ${EXPECTED_IP}."
  echo "Update A records at your DNS provider, then re-run this script."
  exit 1
fi

echo "DNS A check passed: all domains point at ${EXPECTED_IP}."
exit 0

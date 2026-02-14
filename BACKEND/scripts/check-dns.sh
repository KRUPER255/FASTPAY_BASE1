#!/bin/bash
# Check that key fastpaygaming.com DNS records point to this VPS (or a given IP).
# Usage:
#   ./BACKEND/scripts/check-dns.sh
#   EXPECTED_IP=1.2.3.4 ./BACKEND/scripts/check-dns.sh
#   EXPECTED_IPV6=2a02:.... ./BACKEND/scripts/check-dns.sh
#
# NOTES:
# - By default EXPECTED_IP is the first IPv4 returned by `hostname -I` on this host.
# - If you are using a CDN (e.g. Cloudflare) in front of this VPS, set EXPECTED_IP
#   to the public IP you expect the records to resolve to.
# - This script now also reports AAAA (IPv6) records and will warn if they exist,
#   since many clients prefer IPv6 and may hit a different server even when A
#   records look correct.

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

# Determine expected IPv4
if [[ -z "${EXPECTED_IP:-}" ]]; then
  EXPECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [[ -z "${EXPECTED_IP:-}" ]]; then
  echo "ERROR: Could not determine EXPECTED_IP automatically. Please set EXPECTED_IP=..."
  exit 1
fi

echo "=== DNS record check for fastpaygaming.com domains ==="
echo "Expected IPv4 (A):  ${EXPECTED_IP}"
if [[ -n "${EXPECTED_IPV6:-}" ]]; then
  echo "Expected IPv6 (AAAA): ${EXPECTED_IPV6}"
fi
echo ""

have_dig=0
if command -v dig >/dev/null 2>&1; then
  have_dig=1
fi

for domain in "${DOMAINS[@]}"; do
  echo "--- ${domain} ---"

  # A records (IPv4)
  if [[ $have_dig -eq 1 ]]; then
    ips=$(dig +short A "${domain}" | sort -u)
  else
    # Fallback using getent if dig is not available
    ips=$(getent ahostsv4 "${domain}" 2>/dev/null | awk '{print $1}' | sort -u || true)
  fi

  if [[ -z "${ips}" ]]; then
    echo "  A record: (none)  [FAIL]"
  else
    echo "  A record(s):"
    match="no"
    while IFS= read -r ip; do
      [[ -z "$ip" ]] && continue
      if [[ "$ip" == "$EXPECTED_IP" ]]; then
        echo "    ${ip}  [OK]"
        match="yes"
      else
        echo "    ${ip}  [WARN: does not match EXPECTED_IP]"
      fi
    done <<< "${ips}"

    if [[ "$match" == "no" ]]; then
      echo "  => DNS A for ${domain} does NOT point at ${EXPECTED_IP}"
    fi
  fi

  # AAAA records (IPv6)
  if [[ $have_dig -eq 1 ]]; then
    ipv6s=$(dig +short AAAA "${domain}" | sort -u)
  else
    ipv6s=""  # getent fallback for IPv6 is less portable; skip
  fi

  if [[ -n "${ipv6s}" ]]; then
    echo "  AAAA record(s):"
    v6match="no"
    while IFS= read -r ip6; do
      [[ -z "$ip6" ]] && continue
      if [[ -n "${EXPECTED_IPV6:-}" && "$ip6" == "$EXPECTED_IPV6" ]]; then
        echo "    ${ip6}  [OK]"
        v6match="yes"
      else
        echo "    ${ip6}  [WARN: may point to a different server]"
      fi
    done <<< "${ipv6s}"

    if [[ "$v6match" == "no" && -z "${EXPECTED_IPV6:-}" ]]; then
      echo "  => NOTE: AAAA records exist. If this host does not serve the app over IPv6,"
      echo "           remove or update these AAAA records; many clients prefer IPv6."
    fi
  else
    echo "  AAAA record(s): (none)"
  fi

  echo ""
done

echo "Done."


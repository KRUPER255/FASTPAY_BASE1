#!/bin/bash
# Obtain a single wildcard SSL cert for *.fastpaygaming.com and fastpaygaming.com
# Requires DNS-01: you must add the TXT record certbot shows at your DNS provider.
# Usage: ./certbot-wildcard-fastpaygaming.sh
# Optional: CONFIG_DIR=/path/to/ssl CERTBOT_EMAIL=you@example.com ./certbot-wildcard-fastpaygaming.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Where to store certs (default: certbot default = /etc/letsencrypt)
# If you use nginx/ssl on the host, set CONFIG_DIR to that path so nginx can read it
CONFIG_DIR="${CONFIG_DIR:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

EXTRA=()
if [[ -n "$CONFIG_DIR" ]]; then
  mkdir -p "$CONFIG_DIR"
  EXTRA+=(--config-dir "$CONFIG_DIR" --work-dir "$CONFIG_DIR/work" --logs-dir "$CONFIG_DIR/logs")
fi
if [[ -n "$CERTBOT_EMAIL" ]]; then
  EXTRA+=(--email "$CERTBOT_EMAIL" --agree-tos)
else
  EXTRA+=(--agree-tos)
fi

echo "Obtaining wildcard cert for *.fastpaygaming.com and fastpaygaming.com (DNS-01 challenge)."
echo "You will need to add a TXT record _acme-challenge.fastpaygaming.com at your DNS provider."
echo ""
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.fastpaygaming.com" \
  -d "fastpaygaming.com" \
  "${EXTRA[@]}" \
  "$@"

echo ""
echo "Done. Cert is in: ${CONFIG_DIR:-/etc/letsencrypt}/live/fastpaygaming.com/"
echo "All nginx configs for fastpaygaming.com subdomains use: /etc/letsencrypt/live/fastpaygaming.com/"
if [[ -n "$CONFIG_DIR" ]]; then
  echo "Ensure nginx can read that path (e.g. symlink under /etc/nginx/ssl/live if needed)."
fi

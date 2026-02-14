#!/bin/bash
# Obtain SSL cert for fastpaygaming.com, www, and staging subdomains (HTTP-01).
# Cert is written to /etc/letsencrypt/live/fastpaygaming.com/
# Run on the server. Nginx must serve HTTP on port 80 with /.well-known/acme-challenge/ -> /var/www/certbot.
#
# Usage: sudo ./BACKEND/scripts/certbot-fastpay-and-staging.sh
#   Or:  CERTBOT_EMAIL=admin@fastpaygaming.com sudo ./BACKEND/scripts/certbot-fastpay-and-staging.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBROOT="${WEBROOT:-/var/www/certbot}"
CONFIG_DIR="${CONFIG_DIR:-}"

sudo mkdir -p "$WEBROOT/.well-known/acme-challenge"

EXTRA=()
if [[ -n "$CONFIG_DIR" ]]; then
  EXTRA+=(--config-dir "$CONFIG_DIR" --work-dir "$CONFIG_DIR/work" --logs-dir "$CONFIG_DIR/logs")
fi
if [[ -n "$CERTBOT_EMAIL" ]]; then
  EXTRA+=(--email "$CERTBOT_EMAIL" --agree-tos --non-interactive)
else
  EXTRA+=(--agree-tos)
fi

echo "Obtaining cert for fastpaygaming.com, www, and staging subdomains (HTTP-01)."
echo "Webroot: $WEBROOT"
echo ""

sudo certbot certonly --webroot -w "$WEBROOT" \
  -d fastpaygaming.com \
  -d www.fastpaygaming.com \
  -d staging.fastpaygaming.com \
  -d sapi.fastpaygaming.com \
  -d sadmin.fastpaygaming.com \
  -d sredpay.fastpaygaming.com \
  "${EXTRA[@]}" \
  "$@"

echo ""
echo "Done. Cert is at: ${CONFIG_DIR:-/etc/letsencrypt}/live/fastpaygaming.com/"
echo "Run: sudo nginx -t && sudo systemctl reload nginx"

#!/bin/bash
# Obtain SSL cert for fastpaygaming.com + www only (apex). Uses HTTP-01, no DNS needed.
# Cert is written to /etc/letsencrypt/live/fastpaygaming.com/ (same path as wildcard).
# Run on the server. Ensure nginx serves HTTP on port 80 for fastpaygaming.com and www
# with location /.well-known/acme-challenge/ -> root /var/www/certbot (or set WEBROOT).
#
# Usage: sudo ./BACKEND/scripts/certbot-apex-fastpaygaming.sh
#   Or:  WEBROOT=/var/www/certbot sudo ./BACKEND/scripts/certbot-apex-fastpaygaming.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
# Webroot that nginx serves for ACME (see fastpay.conf / api-subdomain.conf)
WEBROOT="${WEBROOT:-/var/www/certbot}"
# Use certbot default config so cert goes to /etc/letsencrypt/live/fastpaygaming.com/
CONFIG_DIR="${CONFIG_DIR:-}"

mkdir -p "$WEBROOT/.well-known/acme-challenge"

EXTRA=()
if [[ -n "$CONFIG_DIR" ]]; then
  EXTRA+=(--config-dir "$CONFIG_DIR" --work-dir "$CONFIG_DIR/work" --logs-dir "$CONFIG_DIR/logs")
fi

echo "Obtaining cert for fastpaygaming.com and www.fastpaygaming.com (HTTP-01)."
echo "Webroot: $WEBROOT"
echo ""

CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
if [[ -n "$CERTBOT_EMAIL" ]]; then
  EXTRA+=(--email "$CERTBOT_EMAIL" --non-interactive)
fi

sudo certbot certonly --webroot -w "$WEBROOT" \
  -d fastpaygaming.com \
  -d www.fastpaygaming.com \
  --agree-tos \
  "${EXTRA[@]}" \
  "$@"

echo ""
echo "Done. Cert is at: ${CONFIG_DIR:-/etc/letsencrypt}/live/fastpaygaming.com/"
echo "Run: sudo nginx -t && sudo systemctl reload nginx"

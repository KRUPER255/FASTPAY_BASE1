#!/bin/bash
# Obtain SSL certs for staging subdomains
# IMPORTANT: Use the webroot that nginx serves. On production server this is
# /opt/FASTPAY/BACKEND/nginx/acme (NOT /var/www/certbot).
# Usage: ./certbot-staging.sh
#   Or:  WEBROOT=/opt/FASTPAY/BACKEND/nginx/acme ./certbot-staging.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
# Production server: /opt/FASTPAY. Staging: /root/Desktop/FASTPAY_BASE
PROD_ACME="/opt/FASTPAY/BACKEND/nginx/acme"
WEBROOT="${WEBROOT:-$PROD_ACME}"
# Fallback to local if production path doesn't exist (e.g. dev machine)
[[ ! -d "$WEBROOT" ]] && WEBROOT="$BACKEND_DIR/nginx/acme"

mkdir -p "$WEBROOT/.well-known/acme-challenge"

# Production stores certs in nginx/ssl (nginx mounts it as /etc/nginx/ssl)
CONFIG_DIR="${CONFIG_DIR:-/opt/FASTPAY/BACKEND/nginx/ssl}"
[[ ! -d "$CONFIG_DIR" ]] && CONFIG_DIR="$BACKEND_DIR/nginx/ssl"

echo "Using webroot: $WEBROOT"
echo "Using config-dir: $CONFIG_DIR"
sudo certbot certonly --webroot -w "$WEBROOT" \
    --config-dir "$CONFIG_DIR" \
    --work-dir "$CONFIG_DIR/work" \
    --logs-dir "$CONFIG_DIR/logs" \
    -d staging.fastpaygaming.com \
    -d api-staging.fastpaygaming.com \
    -d admin-staging.fastpaygaming.com \
    "$@"

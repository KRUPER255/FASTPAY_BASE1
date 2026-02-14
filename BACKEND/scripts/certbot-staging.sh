#!/bin/bash
# Obtain SSL certs for staging subdomains
# Use the webroot that nginx serves. Override with WEBROOT or PROD_BASE (default /var/www/fastpay).
# Usage: ./certbot-staging.sh
#   Or:  PROD_BASE=/var/www/fastpay ./certbot-staging.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROD_BASE="${PROD_BASE:-/var/www/fastpay}"
PROD_ACME="$PROD_BASE/BACKEND/nginx/acme"
WEBROOT="${WEBROOT:-$PROD_ACME}"
# Fallback to this repo's nginx/acme if production path doesn't exist (e.g. dev machine)
[[ ! -d "$WEBROOT" ]] && WEBROOT="$BACKEND_DIR/nginx/acme"

mkdir -p "$WEBROOT/.well-known/acme-challenge"

# Production stores certs in nginx/ssl (nginx mounts it as /etc/nginx/ssl)
CONFIG_DIR="${CONFIG_DIR:-$PROD_BASE/BACKEND/nginx/ssl}"
[[ ! -d "$CONFIG_DIR" ]] && CONFIG_DIR="$BACKEND_DIR/nginx/ssl"

echo "Using webroot: $WEBROOT"
echo "Using config-dir: $CONFIG_DIR"
sudo certbot certonly --webroot -w "$WEBROOT" \
    --config-dir "$CONFIG_DIR" \
    --work-dir "$CONFIG_DIR/work" \
    --logs-dir "$CONFIG_DIR/logs" \
    -d staging.fastpaygaming.com \
    -d sapi.fastpaygaming.com \
    -d sadmin.fastpaygaming.com \
    -d sredpay.fastpaygaming.com \
    "$@"

#!/bin/bash
# DEPRECATED: deploy-all.sh now rsyncs to FASTPAY_DEPLOY/dist/staging/redpay directly.
# Nginx staging 04-redpay.conf serves from /var/www/FASTPAY_DEPLOY/dist/staging/redpay.
# Use deploy-all.sh or deploy-production.sh instead. This script kept for backwards compatibility.
#
# Legacy: Sync DASHBOARD_REDPAY/dist to /var/www/sredpay-dist for host nginx (sredpay.fastpaygaming.com).
# Run from repo root. Use sudo if you cannot write to /var/www.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC="${1:-$REPO_ROOT/DASHBOARD_REDPAY/dist}"
DEST="/var/www/sredpay-dist"
if [[ ! -d "$SRC" ]]; then
    echo "Error: $SRC not found. Build RedPay first: cd DASHBOARD_REDPAY && npm run build -- --mode staging" >&2
    exit 1
fi
echo "Syncing $SRC -> $DEST"
mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"
echo "Done. Nginx sredpay vhost serves from $DEST."

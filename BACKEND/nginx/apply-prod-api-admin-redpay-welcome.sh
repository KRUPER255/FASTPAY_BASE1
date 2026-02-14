#!/usr/bin/env bash
# Apply nginx config for api, admin, redpay (proxy) + csapay, bropay, hypay, kypay (welcome).
# Run from repo root: ./BACKEND/nginx/apply-prod-api-admin-redpay-welcome.sh
# Requires: nginx installed, wildcard cert at /etc/letsencrypt/live/fastpaygaming.com/ (see WILDCARD_CERT.md).

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NGINX_DIR="$(dirname "$0")"
WELCOME_ROOT="/var/www/welcome"
JOIN_ROOT="/var/www/join"
CONF_DEST="/etc/nginx/conf.d/prod-03-api-admin-redpay-welcome.conf"

echo "Repo root: $REPO_ROOT"
echo "Nginx conf dir: $NGINX_DIR"

# Create welcome root and copy welcome page (csapay, bropay, hypay, kypay)
sudo mkdir -p "$WELCOME_ROOT"
sudo cp -r "$NGINX_DIR/html/welcome/"* "$WELCOME_ROOT/"
sudo chown -R www-data:www-data "$WELCOME_ROOT" 2>/dev/null || true

# Create join root and copy "link to join" page (api, admin, redpay root)
sudo mkdir -p "$JOIN_ROOT"
sudo cp -r "$NGINX_DIR/html/join/"* "$JOIN_ROOT/"
sudo chown -R www-data:www-data "$JOIN_ROOT" 2>/dev/null || true

# Deploy conf (remove old filenames if present)
sudo rm -f /etc/nginx/conf.d/prod-api-admin-redpay-welcome.conf /etc/nginx/conf.d/prod-api-admin-redpay-csapay-bropay-hypay-kypay.conf
sudo cp "$NGINX_DIR/conf.d/production/00-fastpay-main.conf" /etc/nginx/conf.d/prod-00-fastpay-main.conf
sudo cp "$NGINX_DIR/conf.d/production/03-api-admin-redpay-welcome.conf" "$CONF_DEST"
echo "Config copied to $CONF_DEST"

# Test and reload
if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    echo "Nginx reloaded."
else
    echo "Nginx test failed. Ensure SSL cert exists: /etc/letsencrypt/live/fastpaygaming.com/"
    echo "See BACKEND/nginx/WILDCARD_CERT.md to obtain wildcard cert."
    exit 1
fi

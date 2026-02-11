#!/bin/bash
#
# Run ON THE SERVER to fix fastpaygaming.com, www, api, and owner HTTPS.
# 1) Copies fastpay.conf, api-subdomain.conf, owner-subdomain.conf so api and owner
#    use per-domain cert paths (not the missing wildcard path).
# 2) Obtains apex cert (fastpaygaming.com + www) via HTTP-01 if missing.
# 3) Tests and reloads nginx.
#
# Usage (on server, from repo root):
#   sudo ./BACKEND/nginx/fix-fastpay-certs-on-host.sh
# For non-interactive apex cert: sudo CERTBOT_EMAIL=admin@fastpaygaming.com ./BACKEND/nginx/fix-fastpay-certs-on-host.sh
#   sudo NGINX_CONF_D=/etc/nginx/conf.d ./BACKEND/nginx/fix-fastpay-certs-on-host.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SOURCE="${SCRIPT_DIR}/conf.d"

# Destination: same logic as apply-staging-on-host.sh
if [[ -n "$NGINX_CONF_D" ]]; then
  CONF_DEST="$NGINX_CONF_D"
elif [[ -d /etc/nginx/conf.d ]]; then
  CONF_DEST="/etc/nginx/conf.d"
elif [[ -d /etc/nginx/sites-available ]]; then
  CONF_DEST="/etc/nginx/sites-available"
else
  echo "Set NGINX_CONF_D or ensure /etc/nginx/conf.d exists."
  exit 1
fi

echo "=== Fix fastpaygaming.com certs on host ==="
echo "Source: $CONF_SOURCE"
echo "Dest:   $CONF_DEST"
echo ""

echo "1. Copying configs (api and owner use per-domain cert paths)..."
cp -v "$CONF_SOURCE/fastpay.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/api-subdomain.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/owner-subdomain.conf" "$CONF_DEST/"
# Host nginx: cannot resolve "web" or "host.docker.internal"
sudo sed -i 's/server web:8000/server 127.0.0.1:8000/' "$CONF_DEST/fastpay.conf" 2>/dev/null || true
sudo sed -i 's/host\.docker\.internal/127.0.0.1/g' "$CONF_DEST/fastpay.conf" 2>/dev/null || true
echo ""

echo "2. Ensuring ACME webroot exists..."
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
echo ""

APEX_LIVE="/etc/letsencrypt/live/fastpaygaming.com"
NEED_APEX=0
if [[ ! -f "$APEX_LIVE/fullchain.pem" ]]; then
  NEED_APEX=1
elif ! sudo openssl x509 -in "$APEX_LIVE/fullchain.pem" -noout -checkend 2592000 2>/dev/null; then
  NEED_APEX=1
fi

if [[ $NEED_APEX -eq 1 ]]; then
  echo "3. Creating temporary self-signed cert so nginx can load..."
  sudo mkdir -p "$APEX_LIVE"
  if [[ ! -f "$APEX_LIVE/privkey.pem" ]]; then
    sudo openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout "$APEX_LIVE/privkey.pem" -out "$APEX_LIVE/fullchain.pem" \
      -subj "/CN=fastpaygaming.com" 2>/dev/null
    echo "   Temp cert created."
  fi
  echo ""
fi

echo "4. Testing and reloading nginx..."
if ! sudo nginx -t 2>/dev/null; then
  echo "   nginx -t failed. Check config and cert paths."
  exit 1
fi
sudo systemctl reload nginx 2>/dev/null || sudo systemctl reload nginx.service 2>/dev/null || true
echo "   Nginx reloaded."
echo ""

if [[ $NEED_APEX -eq 1 ]]; then
  echo "5. Obtaining real apex cert (HTTP-01)..."
  if sudo CERTBOT_EMAIL="${CERTBOT_EMAIL:-}" "$SCRIPT_DIR/../scripts/certbot-apex-fastpaygaming.sh"; then
    echo "   Apex cert obtained. Reloading nginx..."
    sudo systemctl reload nginx 2>/dev/null || true
  else
    echo "   Certbot failed. Ensure port 80 for fastpaygaming.com serves /.well-known/acme-challenge/ from /var/www/certbot."
    echo "   Then run: sudo $SCRIPT_DIR/../scripts/certbot-apex-fastpaygaming.sh"
    exit 1
  fi
fi

echo ""
echo "Verify with: ./BACKEND/scripts/check-urls-cert.sh"

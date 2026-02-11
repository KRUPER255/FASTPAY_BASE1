#!/bin/bash
#
# Run this script ON THE STAGING SERVER (where host nginx runs).
# Copies the 6 staging configs (dashboard, api, admin, axisurgent, redpay) to /etc/nginx/conf.d/, removes old staging
# configs, then tests and reloads nginx.
#
# Usage (run on STAGING SERVER where nginx is installed):
#   sudo ./BACKEND/nginx/apply-staging-on-host.sh
#   sudo NGINX_CONF_D=/etc/nginx/sites-available ./BACKEND/nginx/apply-staging-on-host.sh
#   sudo ./apply-staging-on-host.sh /etc/nginx/sites-available
# Script auto-detects: conf.d, then sites-available. Override with NGINX_CONF_D or first argument.
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SOURCE="${SCRIPT_DIR}/conf.d"

# Destination: explicit env, or first arg, or auto-detect
if [[ -n "$NGINX_CONF_D" ]]; then
    CONF_DEST="$NGINX_CONF_D"
elif [[ -n "$1" ]]; then
    CONF_DEST="$1"
elif [[ -d /etc/nginx/conf.d ]]; then
    CONF_DEST="/etc/nginx/conf.d"
elif [[ -d /etc/nginx/sites-available ]]; then
    CONF_DEST="/etc/nginx/sites-available"
elif [[ -d /etc/nginx/sites-enabled ]]; then
    CONF_DEST="/etc/nginx/sites-enabled"
elif [[ -d /usr/local/etc/nginx/conf.d ]]; then
    CONF_DEST="/usr/local/etc/nginx/conf.d"
elif [[ -d /usr/local/etc/nginx/sites-available ]]; then
    CONF_DEST="/usr/local/etc/nginx/sites-available"
else
    # Discover from nginx -T (e.g. snap or custom layout)
    DISCOVERED=""
    NGINX_T_OUT=""
    if command -v nginx &>/dev/null; then
        NGINX_T_OUT="$(nginx -T 2>/dev/null || true)"
    fi
    # Try to extract dir from "include /path/to/dir/*.conf;" or similar
    while IFS= read -r line; do
        if [[ "$line" =~ include[[:space:]]+([^\;*\"\']+)\* ]]; then
            dir="${BASH_REMATCH[1]}"
            dir="${dir# }"
            dir="${dir% }"
            dir="${dir%/}"
            if [[ -n "$dir" && -d "$dir" ]]; then
                DISCOVERED="$dir"
                break
            fi
        fi
    done < <(echo "$NGINX_T_OUT" | grep -E "include\s+" || true)
    # Fallback: any path containing conf.d or sites-enabled
    if [[ -z "$DISCOVERED" && -n "$NGINX_T_OUT" ]]; then
        while IFS= read -r line; do
            if [[ "$line" =~ /(conf\.d|sites-enabled|sites-available)(/|[[:space:]]|;) ]]; then
                dir="${line#*include}"
                dir="${dir//[\"\']/}"
                dir="${dir%;*}"
                dir="${dir%%\**}"
                dir="${dir% }"
                dir="${dir# }"
                dir="${dir%/}"
                # Resolve to parent dir if line was e.g. .../conf.d/*.conf
                if [[ "$dir" == *conf.d ]]; then
                    [[ -d "$dir" ]] && DISCOVERED="$dir" && break
                elif [[ "$dir" == *sites-enabled || "$dir" == *sites-available ]]; then
                    [[ -d "$dir" ]] && DISCOVERED="$dir" && break
                fi
            fi
        done < <(echo "$NGINX_T_OUT" | grep -E "include\s+.*(conf\.d|sites-enabled|sites-available)" || true)
    fi
    if [[ -n "$DISCOVERED" ]]; then
        CONF_DEST="$DISCOVERED"
        echo "Auto-detected nginx config directory from nginx -T: $CONF_DEST"
    fi
fi

if [[ -z "$CONF_DEST" ]]; then
    # Create /etc/nginx/conf.d (and /etc/nginx if missing) and use it
    echo "No nginx config dir found. Creating /etc/nginx/conf.d and using it."
    mkdir -p /etc/nginx/conf.d
    CONF_DEST="/etc/nginx/conf.d"
    CREATED_CONF_D=1
fi

if [[ ! -d "$CONF_DEST" ]]; then
    echo "Error: $CONF_DEST is not a directory."
    exit 1
fi
echo "Using nginx config directory: $CONF_DEST"

echo "Copying staging configs from $CONF_SOURCE to $CONF_DEST ..."
cp -v "$CONF_SOURCE/staging-00-http.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/staging-01-dashboard.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/staging-02-api.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/staging-03-admin.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/staging-04-axisurgent.conf" "$CONF_DEST/"
cp -v "$CONF_SOURCE/staging-05-redpay.conf" "$CONF_DEST/"

echo "Removing old staging configs from $CONF_DEST ..."
for f in acme-staging.conf staging-subdomains.conf staging-subdomain-proxy.conf \
         staging-proxy.conf staging-proxy-ssl.conf staging-standalone.conf \
         api-staging-subdomain.conf admin-staging-subdomain.conf; do
    if [[ -f "$CONF_DEST/$f" ]]; then
        rm -v "$CONF_DEST/$f"
    fi
done

# If using sites-available, nginx often loads from sites-enabled (symlinks)
if [[ "$CONF_DEST" == *sites-available* && -d /etc/nginx/sites-enabled ]]; then
    echo "Note: Configs were copied to sites-available. To enable them:"
    echo "  cd /etc/nginx/sites-enabled && for f in staging-00-http staging-01-dashboard staging-02-api staging-03-admin staging-04-axisurgent staging-05-redpay; do ln -sf ../sites-available/\${f}.conf .; done"
fi

NGINX_CONF="/etc/nginx/nginx.conf"
INCLUDE_LINE="include /etc/nginx/conf.d/*.conf;"
if [[ -n "$CREATED_CONF_D" && -f "$NGINX_CONF" ]]; then
    if grep -qF "$INCLUDE_LINE" "$NGINX_CONF" 2>/dev/null; then
        echo "Include for conf.d already present in $NGINX_CONF"
    else
        echo "Adding include to $NGINX_CONF (inside http { })..."
        if grep -qE '^[[:space:]]*http[[:space:]]*\{' "$NGINX_CONF" 2>/dev/null; then
            sed -i "/^[[:space:]]*http[[:space:]]*{/a\\
    $INCLUDE_LINE" "$NGINX_CONF"
            echo "Added: $INCLUDE_LINE"
        else
            echo "  Could not find 'http {' in $NGINX_CONF. Add this line inside the http { } block:"
            echo "  $INCLUDE_LINE"
        fi
    fi
    echo ""
fi

echo "Testing nginx configuration..."
if nginx -t 2>/dev/null; then
    echo "Reloading nginx..."
    systemctl reload nginx
    echo "Done. Staging is now using the new configs."
else
    if [[ -n "$CREATED_CONF_D" ]]; then
        echo "nginx -t failed. If the include was not added, add this inside http { } in $NGINX_CONF:"
        echo "  $INCLUDE_LINE"
        echo "Then run: sudo nginx -t && sudo systemctl reload nginx"
    else
        echo "nginx -t failed. Fix the configuration and run the script again."
        exit 1
    fi
fi

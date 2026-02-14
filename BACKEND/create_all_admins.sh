#!/bin/bash

# FastPay Multi-Admin Creation Script
# Creates admin users for dashboard, redpay, and kypay
# Password: use ADMIN_PASSWORD env or --password (required)

ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --password) ADMIN_PASSWORD="$2"; shift 2 ;;
        *) shift ;;
    esac
done

if [[ -z "$ADMIN_PASSWORD" ]]; then
    echo "Error: Password required. Use ADMIN_PASSWORD=xxx $0 or $0 --password 'YourPassword'" >&2
    exit 1
fi

echo "Creating admin users for all dashboards..."

# Check if docker-compose or docker compose is available
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_CMD="docker compose"
else
    echo "Error: Docker Compose not found. Please install docker-compose or docker compose v2."
    exit 1
fi

# Create admin@fastpay.com for /dashboard
echo ""
echo "===================================================="
echo "Creating admin@fastpay.com (for /dashboard)..."
echo "===================================================="
$DOCKER_CMD exec -T web python manage.py create_super_admin \
    --email admin@fastpay.com \
    --password "$ADMIN_PASSWORD" \
    --full-name "Dashboard Admin"

# Create admin@redpay.com for /redpay
echo ""
echo "===================================================="
echo "Creating admin@redpay.com (for /redpay)..."
echo "===================================================="
$DOCKER_CMD exec -T web python manage.py create_super_admin \
    --email admin@redpay.com \
    --password "$ADMIN_PASSWORD" \
    --full-name "RedPay Admin"

# Create admin@kypay.com for /kypay
echo ""
echo "===================================================="
echo "Creating admin@kypay.com (for /kypay)..."
echo "===================================================="
$DOCKER_CMD exec -T web python manage.py create_super_admin \
    --email admin@kypay.com \
    --password "$ADMIN_PASSWORD" \
    --full-name "KyPay Admin"

echo ""
echo "===================================================="
echo "✅ All admin users created successfully!"
echo ""
echo "Login credentials:"
echo ""
echo "Dashboard Admin:"
echo "  Email: admin@fastpay.com"
echo "  Password: (the password you provided)"
echo "  Access: /dashboard, /redpay, /kypay"
echo ""
echo "RedPay Admin:"
echo "  Email: admin@redpay.com"
echo "  Password: (the password you provided)"
echo "  Access: /dashboard, /redpay, /kypay"
echo ""
echo "KyPay Admin:"
echo "  Email: admin@kypay.com"
echo "  Password: (the password you provided)"
echo "  Access: /dashboard, /redpay, /kypay"
echo ""
echo "All users have Full Admin access (level 0)"
echo "and can access all dashboards!"
echo "===================================================="

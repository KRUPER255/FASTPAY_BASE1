#!/bin/bash

# FastPay Super Admin Creation Script
# This script creates a super admin user who can access all dashboards

# Default values (password must be provided via --password or SUPERADMIN_PASSWORD env)
EMAIL="superadmin@fastpay.com"
PASSWORD="${SUPERADMIN_PASSWORD:-}"
FULL_NAME="Super Administrator"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --email) EMAIL="$2"; shift ;;
        --password) PASSWORD="$2"; shift ;;
        --name) FULL_NAME="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [[ -z "$PASSWORD" ]]; then
    echo "Error: Password required. Use --password PASSWORD or set SUPERADMIN_PASSWORD env var." >&2
    echo "Example: $0 --email superadmin@fastpay.com --password 'YourSecurePassword'" >&2
    exit 1
fi

echo "Creating Super Admin User..."
echo "Email: $EMAIL"

# Check if docker-compose or docker compose is available
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_CMD="docker compose"
else
    echo "Error: Docker Compose not found. Please install docker-compose or docker compose v2."
    exit 1
fi

# Run the management command inside the web container
$DOCKER_CMD exec -T web python manage.py create_super_admin --email "$EMAIL" --password "$PASSWORD" --full-name "$FULL_NAME"

if [ $? -eq 0 ]; then
    echo ""
    echo "===================================================="
    echo "✅ Super admin user created successfully!"
    echo ""
    echo "Login credentials:"
    echo "Email: $EMAIL"
    echo "Password: (the password you provided)"
    echo ""
    echo "This user can access all dashboards:"
    echo "  - /dashboard"
    echo "  - /redpay"
    echo "  - /kypay"
    echo "===================================================="
else
    echo "❌ Failed to create super admin user. Please check the errors above."
    exit 1
fi

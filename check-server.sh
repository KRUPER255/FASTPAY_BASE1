#!/bin/bash
# Quick server health check - run from FASTPAY_BASE or BACKEND
# Usage: ./check-server.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Server health check ==="
echo ""

# Docker
echo "Docker containers:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -20
echo ""

# Backend (production) - port 8000
CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health/ 2>/dev/null || echo "000")
if [[ "$CODE" == "200" ]]; then
    echo -e "${GREEN}OK${NC} Backend (8000): $CODE"
else
    echo -e "${YELLOW}??${NC} Backend (8000): $CODE (expected 200 after /health/ fix)"
fi

# Staging - port 8001
CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/ 2>/dev/null || echo "000")
if [[ "$CODE" == "200" ]]; then
    echo -e "${GREEN}OK${NC} Staging (8001): $CODE"
else
    echo -e "${YELLOW}??${NC} Staging (8001): $CODE"
fi

# Detailed health (backend 8000) - optional
DETAILED=$(curl -sS "http://127.0.0.1:8000/api/health/?detailed=1" 2>/dev/null || echo "")
if [[ -n "$DETAILED" ]]; then
    echo ""
    echo "Backend detailed health (8000):"
    echo "$DETAILED" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  database:', d.get('database',{}).get('status','?')); print('  firebase:', d.get('firebase',{}).get('status','?')); print('  redis:', d.get('redis',{}).get('status','?'))" 2>/dev/null || echo "  (parse failed)"
fi

# Guacamole - port 8080
CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/guacamole/ 2>/dev/null || echo "000")
if [[ "$CODE" == "200" ]]; then
    echo -e "${GREEN}OK${NC} Guacamole (8080): $CODE"
else
    echo -e "${YELLOW}??${NC} Guacamole (8080): $CODE"
fi

# Nginx (if exposed)
CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:80/health/ 2>/dev/null || echo "000")
if [[ "$CODE" == "200" ]]; then
    echo -e "${GREEN}OK${NC} Nginx (80): $CODE"
else
    echo -e "${YELLOW}??${NC} Nginx (80): $CODE"
fi

echo ""
echo "Unhealthy containers (Docker healthcheck):"
docker ps -a --filter "health=unhealthy" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || true
echo ""
echo "To fix backend/staging 'unhealthy': rebuild and restart so they use /health/ instead of /admin/:"
echo "  cd /root/Desktop/FASTPAY_BASE/BACKEND && docker compose build web && docker compose up -d"
echo "  cd /root/Desktop/FASTPAY_BASE/BACKEND && docker compose -f docker-compose.staging.yml build web && docker compose -f docker-compose.staging.yml up -d"
echo ""

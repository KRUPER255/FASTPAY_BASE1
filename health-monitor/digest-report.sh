#!/bin/bash
# FastPay 15-minute digest: service status, VPS/resources, recent logs.
# Uses same health-monitor.env (TELEGRAM_*, HEALTH_URLS). Run via fastpay-digest.timer.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/health-monitor.env"
DIGEST_MAX_LOG_LINES="${DIGEST_MAX_LOG_LINES:-30}"
TELEGRAM_MAX_LEN=4000

# Load config (same as health-monitor)
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
fi

# URLs to check
DEFAULT_URLS="https://fastpaygaming.com/ https://fastpaygaming.com/health/ https://api.fastpaygaming.com/api/ https://staging.fastpaygaming.com/ https://sapi.fastpaygaming.com/api/ https://owner.fastpaygaming.com/"
HEALTH_URLS_STR="${HEALTH_URLS:-$DEFAULT_URLS}"
read -ra HEALTH_URLS <<< "$HEALTH_URLS_STR"

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_IDS="${TELEGRAM_CHAT_IDS:-}"
TELEGRAM_ENABLED=false
[[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_IDS" ]] && TELEGRAM_ENABLED=true

get_vps_info() {
    local h u ip
    h=$(hostname 2>/dev/null || echo "unknown")
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    [[ -z "$ip" ]] && ip=$(ip -4 route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[\d.]+' || true)
    u=$(uptime -p 2>/dev/null | sed 's/^up //' || echo "?")
    echo "VPS: ${h} | IP: ${ip:-?} | Uptime: ${u}"
}

send_telegram() {
    local msg=$1
    local chat_ids
    IFS=',' read -ra chat_ids <<< "$TELEGRAM_CHAT_IDS"
    for cid in "${chat_ids[@]}"; do
        cid=$(echo "$cid" | tr -d ' ')
        [[ -z "$cid" ]] && continue
        curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            --data-urlencode "text=$msg" \
            -d "chat_id=${cid}" \
            -d "disable_web_page_preview=true" \
            --connect-timeout 5 --max-time 15 \
            >/dev/null 2>&1 || true
    done
}

check_url() {
    local url=$1
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 -L -k "$url" 2>/dev/null || echo "000")
    [[ "$code" =~ ^(200|301|302)$ ]]
}

# --- Service status (URLs + Docker) ---
failures=()
for url in "${HEALTH_URLS[@]}"; do
    [[ -z "$url" ]] && continue
    if ! check_url "$url"; then
        failures+=("$url")
    fi
done

if [[ ${#failures[@]} -gt 0 ]]; then
    urls_str=$(IFS=', '; echo "${failures[*]}")
    SERVICE_STATUS="Services: ⚠️ Down: ${urls_str}"
else
    SERVICE_STATUS="Services: ✅ All OK"
fi

# Docker ps summary (optional, best-effort)
DOCKER_PS=""
if command -v docker &>/dev/null; then
    for proj in backend fastpay-staging; do
        line=$(docker ps -a --filter "label=com.docker.compose.project=${proj}" --format "{{.Names}}: {{.Status}}" 2>/dev/null | head -10)
        [[ -n "$line" ]] && DOCKER_PS="${DOCKER_PS}${proj}: ${line}
"
    done
    [[ -n "$DOCKER_PS" ]] && DOCKER_PS="Docker:
${DOCKER_PS}"
fi

# --- VPS & resources ---
VPS_LINE=$(get_vps_info)
STORAGE=$(df -h / /opt /var 2>/dev/null | awk 'NR==1 {next} !seen[$6]++ {print $6": "$3" used / "$2" ("$5")"}')
[[ -d /var/lib/fastpay ]] && STORAGE="${STORAGE}
$(df -h /var/lib/fastpay 2>/dev/null | awk 'NR==2 {print $6": "$3" used / "$2" ("$5")"}')"
MEMORY=$(free -h 2>/dev/null | awk '/^Mem:/ {print "Mem: "$3" used / "$2" total"}')

# --- Recent activity (last 15 min) ---
N=$((DIGEST_MAX_LOG_LINES / 2))
RECENT=""

# Docker backend (production). Override with PROD_BASE (default /var/www/fastpay).
PROD_BASE="${PROD_BASE:-/var/www/fastpay}"
BACKEND_DIR="${PROD_BASE}/BACKEND"
if [[ -d "$BACKEND_DIR" ]] && command -v docker &>/dev/null; then
    backend_logs=$(cd "$BACKEND_DIR" && docker compose -p backend logs --since 15m 2>&1 | tail -n "$N" || true)
    [[ -n "$backend_logs" ]] && RECENT="${RECENT}Docker (backend):
${backend_logs}

"
fi

# Docker staging. Override with STAGING_BASE (default: parent of health-monitor, or /desktop/fastpay).
STAGING_BASE="${STAGING_BASE:-$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)}"
STAGING_DIR="${STAGING_BASE}/BACKEND"
if [[ -d "$STAGING_DIR" ]] && command -v docker &>/dev/null; then
    staging_logs=$(cd "$STAGING_DIR" && docker compose -f docker-compose.staging.yml -p fastpay-staging logs --since 15m 2>&1 | tail -n "$N" || true)
    [[ -n "$staging_logs" ]] && RECENT="${RECENT}Docker (staging):
${staging_logs}

"
fi

# Systemd
JOURNAL=$(journalctl -u owner-novnc -u fastpay-onboot --since "15 min ago" -n 20 --no-pager 2>/dev/null || true)
[[ -n "$JOURNAL" ]] && RECENT="${RECENT}Systemd (noVNC, onboot):
${JOURNAL}
"

[[ -z "$RECENT" ]] && RECENT="(no recent activity in last 15 min)
"

# --- Build message ---
HEADER="📋 FastPay 15-min digest · $(hostname 2>/dev/null || echo "?") · $(date -Iseconds)"
MSG="${HEADER}

${SERVICE_STATUS}
${DOCKER_PS}

${VPS_LINE}
Storage:
${STORAGE}
${MEMORY}

Recent activity (last 15 min):
${RECENT}"

# Truncate if over Telegram limit (4096); keep last 400 chars of log section if needed
if [[ ${#MSG} -gt $TELEGRAM_MAX_LEN ]]; then
    RECENT_HEAD="Recent activity (last 15 min, truncated):
"
    if [[ ${#RECENT} -gt 400 ]]; then
        RECENT_TRIM="${RECENT: -400}"
    else
        RECENT_TRIM="$RECENT"
    fi
    MSG="${HEADER}

${SERVICE_STATUS}
${DOCKER_PS}

${VPS_LINE}
Storage:
${STORAGE}
${MEMORY}

${RECENT_HEAD}${RECENT_TRIM}"
    # If still too long, trim from end
    while [[ ${#MSG} -gt $TELEGRAM_MAX_LEN && ${#RECENT_TRIM} -gt 50 ]]; do
        RECENT_TRIM="${RECENT_TRIM:50}"
        MSG="${HEADER}

${SERVICE_STATUS}
${DOCKER_PS}

${VPS_LINE}
Storage:
${STORAGE}
${MEMORY}

${RECENT_HEAD}${RECENT_TRIM}"
    done
    [[ ${#MSG} -gt $TELEGRAM_MAX_LEN ]] && MSG="${MSG:0:$((TELEGRAM_MAX_LEN-3))}..."
fi

if $TELEGRAM_ENABLED; then
    send_telegram "$MSG"
else
    echo "$MSG"
fi
exit 0

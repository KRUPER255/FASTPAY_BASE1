#!/bin/bash
# Health check monitor for FastPay dashboard and backend.
# On failure, sends Telegram alert. Run via cron or systemd timer.
#
# Setup:
#   1. cp health-monitor.env.example health-monitor.env
#   2. Edit health-monitor.env with TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS
#   3. chmod +x health-monitor.sh
#   4. Add to cron: */5 * * * * /root/Desktop/FASTPAY_BASE/health-monitor/health-monitor.sh
#      Or use systemd: see health-monitor.timer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/health-monitor.env"
STATE_FILE="${SCRIPT_DIR}/.health-state"
THROTTLE_MINUTES="${HEALTH_THROTTLE_MINUTES:-15}"

# Load config
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
fi

# URLs to check (override in env: HEALTH_URLS="url1 url2 ...")
DEFAULT_URLS="https://fastpaygaming.com/ https://fastpaygaming.com/health/ https://api.fastpaygaming.com/api/ https://staging.fastpaygaming.com/ https://sapi.fastpaygaming.com/api/ https://owner.fastpaygaming.com/"
HEALTH_URLS_STR="${HEALTH_URLS:-$DEFAULT_URLS}"
read -ra HEALTH_URLS <<< "$HEALTH_URLS_STR"

# Telegram (required for alerts)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_IDS="${TELEGRAM_CHAT_IDS:-}"
TELEGRAM_ENABLED=false
[[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_IDS" ]] && TELEGRAM_ENABLED=true

# VPS info for alerts (hostname, IP, uptime)
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
            --connect-timeout 5 --max-time 10 \
            >/dev/null 2>&1 || true
    done
}

check_url() {
    local url=$1
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 -L -k "$url" 2>/dev/null || echo "000")
    [[ "$code" =~ ^(200|301|302)$ ]]
}

throttled_send() {
    local key=$1
    local msg=$2
    local now
    now=$(date +%s)
    local last
    last=$(grep "^${key}=" "$STATE_FILE" 2>/dev/null | cut -d= -f2 || echo "0")
    local throttle_sec=$((THROTTLE_MINUTES * 60))
    if (( now - last >= throttle_sec )); then
        if $TELEGRAM_ENABLED; then
            send_telegram "$msg"
        else
            echo "[ALERT] $msg"
        fi
        # Update state
        if [[ -f "$STATE_FILE" ]]; then
            grep -v "^${key}=" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null || true
        fi
        echo "${key}=${now}" >> "${STATE_FILE}.tmp"
        mv "${STATE_FILE}.tmp" "$STATE_FILE" 2>/dev/null || true
    fi
}

# Main: URL checks
failures=()
for url in "${HEALTH_URLS[@]}"; do
    [[ -z "$url" ]] && continue
    if ! check_url "$url"; then
        failures+=("$url")
    fi
done

# Optional: detailed health (API up but component unhealthy)
if [[ -n "${HEALTH_DETAILED_URL:-}" ]]; then
    detailed_json=$(curl -sS --connect-timeout 10 --max-time 15 -L -k "$HEALTH_DETAILED_URL" 2>/dev/null || echo "")
    if [[ -n "$detailed_json" ]]; then
        unhealthy_components=()
        for comp in database firebase redis; do
            status=$(echo "$detailed_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$comp',{}).get('status',''))" 2>/dev/null || echo "")
            if [[ "$status" == "unhealthy" ]]; then
                unhealthy_components+=("$comp")
            fi
        done
        if [[ ${#unhealthy_components[@]} -gt 0 ]]; then
            comps_str=$(IFS=', '; echo "${unhealthy_components[*]}")
            msg="🚨 FastPay detailed health: API up but component(s) unhealthy: ${comps_str}

Time: $(date -Iseconds)
$(get_vps_info)"
            throttle_key="health_detailed_${comps_str// /_}"
            throttled_send "$throttle_key" "$msg"
            exit 1
        fi
    fi
fi

if [[ ${#failures[@]} -gt 0 ]]; then
    urls_str=$(IFS=', '; echo "${failures[*]}")
    msg="🚨 FastPay health check failed

Down:
${urls_str}

Time: $(date -Iseconds)
$(get_vps_info)"

    # Throttle key per failure set (so we can alert again if different URLs fail)
    throttle_key="health_$(echo "$urls_str" | cksum 2>/dev/null | cut -d' ' -f1 || echo "default")"
    throttled_send "$throttle_key" "$msg"
    exit 1
fi

# Clear failure state on success (optional - allows re-alert on next failure)
# rm -f "$STATE_FILE"
exit 0

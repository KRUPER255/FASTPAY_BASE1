# FastPay Health Monitor

Periodically checks dashboard and backend URLs. On failure, sends Telegram alerts.

A separate **15-minute digest** sends one combined Telegram message with: service status (URL checks + Docker), VPS info (hostname, IP, uptime), storage and memory, and recent activity (Docker backend/staging logs + systemd noVNC/onboot) from the last 15 minutes.

## Setup

1. **Copy config and add Telegram credentials:**
   ```bash
   cd /root/Desktop/FASTPAY_BASE/health-monitor
   cp health-monitor.env.example health-monitor.env
   # Edit health-monitor.env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS
   ```

2. **Make script executable:**
   ```bash
   chmod +x health-monitor.sh
   ```

3. **Choose scheduling:**

   **Option A: Cron (every 5 minutes)**
   ```bash
   crontab -e
   # Add:
   */5 * * * * /root/Desktop/FASTPAY_BASE/health-monitor/health-monitor.sh
   ```

   **Option B: Systemd timer**
   ```bash
   sudo cp health-monitor.service health-monitor.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable health-monitor.timer
   sudo systemctl start health-monitor.timer
   # Check: systemctl list-timers health-monitor.timer
   ```

4. **Optional: 15-minute digest**
   Same `health-monitor.env` (Telegram credentials). Digest runs every 15 min and sends one combined message (services, VPS, storage, memory, recent logs).
   ```bash
   sudo cp /root/Desktop/FASTPAY_BASE/health-monitor/fastpay-digest.service /root/Desktop/FASTPAY_BASE/health-monitor/fastpay-digest.timer /etc/systemd/system/
   # Use same paths; or fix ExecStart/EnvironmentFile if you copied health-monitor elsewhere
   sudo systemctl daemon-reload
   sudo systemctl enable fastpay-digest.timer
   sudo systemctl start fastpay-digest.timer
   # Check: systemctl list-timers fastpay-digest.timer
   ```
   Test once: `./digest-report.sh` (sends one digest to Telegram if configured).

## Test

```bash
./health-monitor.sh
# Success: exit 0, no output
# Failure: exit 1, Telegram alert (if configured)
```

## Configuration

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_IDS` | Comma-separated chat IDs (get from [@userinfobot](https://t.me/userinfobot)) |
| `HEALTH_THROTTLE_MINUTES` | Min minutes between alerts for same failure (default: 15) |
| `HEALTH_URLS` | Space-separated URLs to check (optional) |
| `HEALTH_DETAILED_URL` | Optional. If set (e.g. `https://api.fastpaygaming.com/api/health/?detailed=1`), script parses JSON and alerts when any of database/firebase/redis is unhealthy (API up but component down). Same throttle applies. |
| `DIGEST_MAX_LOG_LINES` | Optional. Used by digest-report.sh: max log lines per Docker project (backend/staging) before merging (default 30). Message is truncated to &lt;4096 chars if needed. |

## 15-minute digest

The digest report (`digest-report.sh`) sends one Telegram message every 15 minutes (when run by `fastpay-digest.timer`) with:

- **Header**: Hostname and timestamp
- **Service status**: All OK or list of down URLs; optional Docker container status (backend, fastpay-staging)
- **VPS & resources**: Hostname, IP, uptime; storage (`df -h` for `/`, `/opt`, `/var`, `/var/lib/fastpay`); memory (`free -h`)
- **Recent activity (last 15 min)**: Docker logs (production backend, staging), then `journalctl` for `owner-novnc` and `fastpay-onboot`

Uses the same `health-monitor.env` (TELEGRAM_*, HEALTH_URLS). If the message exceeds Telegram’s limit, the “Recent activity” section is truncated.

## Default URLs checked

- https://fastpaygaming.com/ (production dashboard)
- https://fastpaygaming.com/health/ (nginx health)
- https://api.fastpaygaming.com/api/ (production API)
- https://staging.fastpaygaming.com/ (staging dashboard)
- https://sapi.fastpaygaming.com/api/ (staging API)

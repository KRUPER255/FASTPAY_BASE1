# Telegram integration – current state

This document describes the current Telegram integration in the FastPay backend and dashboards (as of the last update). Use it when extending the bot, adding webhooks, or troubleshooting alerts.

---

## Overview

- **Current behaviour**: **Send-only**. The app sends messages (alerts, test messages, photos, documents) to Telegram. There is no endpoint for Telegram to push updates to the app unless the **webhook** (see below) is enabled.
- **Interactive webhook**: Optional. When configured, Telegram sends updates to `/api/telegram/webhook/<bot_id>/` and the app can reply to commands (e.g. `/start`, `/help`, `/link`, `/status`).

---

## Configuration sources (priority order)

When sending a message, the backend resolves the bot token and chat IDs in this order:

1. **Explicit parameters** – `token` and `chat_ids` passed to the send function.
2. **Database** – `TelegramBot` model, looked up by `bot_id` or `bot_name` (case-insensitive, active only).
3. **Environment** – `TELEGRAM_BOT_CONFIGS` (JSON array of `{ "name", "token", "chat_ids" }`).
4. **Default env** – `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_IDS` (comma-separated).

So for alerts that use `bot_name='alerts'`, you must have either:

- A DB bot with `name = "alerts"` (and `is_active=True`), or  
- An entry in `TELEGRAM_BOT_CONFIGS` with `"name": "alerts"`, or  
- No named config and the single `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_IDS` will be used.

### Alert channels (bot_name)

You can send different categories of alerts to different bots/chats by using different `bot_name` values:

- **`alerts`** – Default for app alerts (sync failures, device offline, low battery, health check). Create a DB bot named "alerts" or add it to `TELEGRAM_BOT_CONFIGS`.
- **`deploy`** – Use in deploy scripts for success/failure notifications (e.g. set in `TELEGRAM_BOT_CONFIGS` or create a DB bot named "deploy").
- **`health`** – Optional separate channel for health-check failures; create a DB bot named "health" if you want to split health alerts from general alerts.

All call sites currently use `bot_name='alerts'`. To add a new channel, create a `TelegramBot` with the desired name (or add an entry to `TELEGRAM_BOT_CONFIGS`) and pass that name to `send_alert` / `send_telegram_alert_async`. Use explicit `throttle_key` at each call site so duplicate alerts are deduplicated by type (e.g. `device_offline:{device_id}`, `health_check_failed`).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Default bot token (used if no DB/named config). |
| `TELEGRAM_CHAT_IDS` | Comma-separated chat IDs for the default bot. |
| `TELEGRAM_BOT_CONFIGS` | JSON array of named bots: `[{"name":"alerts","token":"...","chat_ids":"123,456"}]`. |
| `TELEGRAM_ALERT_THROTTLE_SECONDS` | Min seconds between identical alerts (default 60). |
| `TELEGRAM_WEBHOOK_SECRET` | Optional. If set, webhook view requires `X-Telegram-Bot-Api-Secret-Token` header to match. |
| `TELEGRAM_WEBHOOK_BASE_URL` | Base URL for webhook (e.g. `https://sapi.<domain>` or `https://api.<domain>`). Defaults to `SITE_URL`. Used by `register_telegram_webhook` command. |

---

## Backend modules

| File | Role |
|------|------|
| `api/utils/telegram.py` | Core: `send_message`, `send_alert`, `format_alert`, `send_alert_templated`, `send_photo`, `send_document`, `build_keyboard`, `answer_callback`, `TelegramWebhook`, config resolution, throttle. |
| `api/telegram_service.py` | Deprecated wrapper; re-exports from `api.utils.telegram`. |
| `api/views/telegram.py` | `TelegramBotViewSet` (CRUD + test/validate/sync-info/discover-chats/lookup-chat), and `telegram_webhook` for receiving updates. |
| `api/models.py` | `TelegramBot`: name, token, chat_ids, chat_type, message_thread_id, cached chat/bot info, is_active, usage stats. |
| `api/tasks.py` | Celery: `send_telegram_message_async`, `send_telegram_alert_async`, `send_telegram_photo_async`, `send_telegram_document_async` (routed to queue `telegram`). |

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/etc. | `telegram-bots/` | CRUD for `TelegramBot` (list, create, retrieve, update, delete). |
| POST | `telegram-bots/{id}/test/` | Send a test message with optional body `message`, `chat_id`, `message_thread_id`. |
| POST | `telegram-bots/{id}/validate/` | Validate token via Telegram getMe. |
| POST | `telegram-bots/{id}/sync-info/` | Sync bot and chat metadata from Telegram. |
| GET | `telegram-bots/{id}/discover-chats/` | List chats from getUpdates (fails if webhook is set). |
| POST | `telegram/validate-token/` | Validate token (no bot ID). |
| POST | `telegram/discover-chats/` | Discover chats by token. |
| POST | `telegram/lookup-chat/` | Lookup chat by token and username/chat_id. |
| POST | `telegram/webhook/<bot_id>/` | **Webhook** – Telegram sends updates here for bot `bot_id`. Validate secret if `TELEGRAM_WEBHOOK_SECRET` is set. |

---

## Where alerts are sent

All of these use `bot_name='alerts'` (or equivalent) and rely on the config order above:

- **api/views/mobile.py**: Message sync issues, notification sync issues, contact sync issues.
- **api/tasks.py**: Firebase sync failures, hard sync failures, OAuth refresh issues, device offline/low battery/sync issues, health check failures.
- **api/management/commands/send_device_alerts.py**: Offline devices, low battery, sync failures.

---

## Health check

`api/tasks.py` – `health_check_task`:

- **Telegram**: Only checks `TELEGRAM_BOT_TOKEN`. If unset, status is `not_configured` even when bots exist in the DB. Consider extending to also check active DB bots.

---

## Deploy scripts and health monitor

- `deploy.sh`, `deploy-all.sh`, `health-monitor/health-monitor.sh`, `digest-report.sh` use **only** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_IDS`. They do not use the `TelegramBot` model or `TELEGRAM_BOT_CONFIGS`.

---

## Celery

- Telegram tasks are routed to the `telegram` queue (`CELERY_TASK_ROUTES` in settings).
- Ensure a worker consumes that queue (e.g. in Docker: `-Q celery,telegram,sync,maintenance`).

---

## Dashboard

- **DASHBOARD_FASTPAY** and **DASHBOARD_REDPAY**: `src/lib/telegram-api.ts` (API client), `src/pages/dashboard/components/TelegramBotsSection.tsx` (CRUD, validate, discover, lookup, test message). No UI yet for scheduled Telegram messages or per-user Telegram links.

---

## Webhook setup (interactive bot)

1. Set `TELEGRAM_WEBHOOK_SECRET` in env (recommended in production).
2. Set `TELEGRAM_WEBHOOK_BASE_URL` to your API base URL (e.g. `https://sapi.<domain>` for staging, `https://api.<domain>` for production). Defaults to `SITE_URL` if not set.
3. After deploy, run the management command for each bot:
   ```bash
   python manage.py register_telegram_webhook --bot-id=1
   # Or with explicit base URL:
   python manage.py register_telegram_webhook --bot-id=1 --base-url=https://api.example.com
   ```
   With Docker (staging): `docker exec fastpay-staging-web-1 python manage.py register_telegram_webhook --bot-id=1`
4. Staging: use `TELEGRAM_WEBHOOK_BASE_URL=https://sapi.<domain>`; production: `https://api.<domain>` (see `docs/VPS_DEPLOY_STRUCTURE.md`).
5. Supported commands (when webhook is enabled): `/start`, `/help`, `/link [token]`, `/status`.

---

## Staging verification checklist

After deploying to staging (e.g. `sapi.<domain>`), run through this checklist to confirm the Telegram integration works end-to-end:

1. **Webhook registration**
   - Set `TELEGRAM_WEBHOOK_BASE_URL=https://sapi.<domain>` (or your staging API base).
   - Run: `docker exec fastpay-staging-web-1 python manage.py register_telegram_webhook --bot-id=1` (use the correct bot id).
   - Optionally set `TELEGRAM_WEBHOOK_SECRET` and pass it when calling `setWebhook` (the command uses it from settings if set).

2. **Interactive bot**
   - In Telegram, open the bot and send `/start`. You should get a welcome reply.
   - Send `/help` and `/status` and confirm replies.

3. **Scheduled Telegram message**
   - In the dashboard, open **Utility → Scheduled tasks**.
   - Add a task: name e.g. "Test Telegram", task `api.tasks.send_telegram_message_async`, schedule type interval or crontab, kwargs e.g. `{"bot_name": "alerts", "message": "Scheduled test"}`.
   - Run the task once and confirm the message appears in the configured Telegram chat.

4. **Per-user link (My Telegram)**
   - In the dashboard, open **Utility → My Telegram**.
   - Click "Connect Telegram", choose a bot; copy the token or deep link.
   - In Telegram, send `/link <token>` (or use the deep link and then send the shown token).
   - Confirm "Linked successfully" and that the link appears in the dashboard with toggles; disconnect and reconnect to verify.

5. **Alerts**
   - Trigger an alert (e.g. device offline, or a sync failure) and confirm it is delivered to the alerts bot/channel.

---

## Gaps and possible improvements

- **Health check**: Could consider DB bots and report “configured” if any active bot exists.
- **Per-user/company notifications**: Implemented via `TelegramUserLink` and "My Telegram" dashboard UI; users can link their Telegram and toggle alerts/reports/device events.
- **Scheduled Telegram messages**: Dashboard UI under Utility → Scheduled tasks; use task `api.tasks.send_telegram_message_async` with kwargs.

# Concrete plan: remaining Telegram enhancements (Points 3–8)

Points 1 (documentation) and 2 (webhook + commands) are done. This document is the **implementation plan** for the rest, in recommended order with specific files and steps.

**Path note:** Backend file paths in the tables are relative to `BACKEND/`. Dashboard paths are under `DASHBOARD_FASTPAY/` (and optionally `DASHBOARD_REDPAY/`).

---

## Implementation order and dependencies

```mermaid
flowchart LR
  P3[Point 3 Richer alerts]
  P4[Point 4 Per-user model]
  P5a[Point 5 Dashboard links UI]
  P5b[Point 5 Auto messages UI]
  P6[Point 6 Deploy webhook cmd]
  P7[Point 7 Tests]
  P8[Point 8 Auto message Celery]

  P3 --> P7
  P4 --> P5a
  P4 --> P2link[/link command]
  P5a --> P7
  P5b --> P7
  P6 --> P7
  P8 --> P5b
  P8 --> P7
```

**Suggested order:**

1. **Point 8 (Auto message Celery)** – No new backend model; add dashboard UI only. Delivers value fast.
2. **Point 3 (Richer alerts)** – Helpers + throttle keys + optional metrics. Backend-only.
3. **Point 4 (Per-user notifications)** – New model + API + webhook `/link` implementation.
4. **Point 5 (Dashboard UX)** – “My Telegram” + optional refinements to Telegram section (webhook status, etc.).
5. **Point 6 (Deployment)** – Management command to register webhook + doc updates.
6. **Point 7 (Testing)** – Unit/integration tests and staging checklist.

---

## Point 3 — Richer alerts

**Goal:** Templates, consistent throttle keys, optional Redis throttle and metrics.

| Step | Action | Files |
|------|--------|--------|
| 3.1 | Add `format_alert(title, body, sections=None)` (or a small dict of templates with `{placeholder}`) in `api/utils/telegram.py`. Keep `send_alert(text=...)`; add optional wrapper `send_alert_templated(template_key, context, bot_name=..., throttle_key=...)`. | [BACKEND/api/utils/telegram.py](api/utils/telegram.py) |
| 3.2 | At each call site that uses `send_telegram_alert` / `send_telegram_alert_async`, pass an explicit `throttle_key` (e.g. `"sync_failed"`, `"device_offline"`, `"health_check_failed"`) so duplicate alerts are deduplicated by type. | [BACKEND/api/views/mobile.py](api/views/mobile.py), [BACKEND/api/tasks.py](api/tasks.py), [BACKEND/api/management/commands/send_device_alerts.py](api/management/commands/send_device_alerts.py) |
| 3.3 | (Optional) Move throttle state from in-memory `_LAST_SENT` to Redis (key e.g. `telegram:throttle:{throttle_key}` with TTL). Requires `django-redis` or raw Redis in settings; read/write in `send_alert()` before calling `send_message()`. | [BACKEND/api/utils/telegram.py](api/utils/telegram.py), [BACKEND/fastpay_be/settings.py](fastpay_be/settings.py) |
| 3.4 | (Optional) Add simple metrics: increment Redis keys `telegram:sent`, `telegram:throttled`, `telegram:failed` in send path; expose `GET /api/telegram/metrics/` (admin-only) or extend health response. | New: [BACKEND/api/views/telegram.py](api/views/telegram.py) or [BACKEND/api/views/health.py](api/views/health.py), [BACKEND/api/urls.py](api/urls.py) |
| 3.5 | Document channel usage (e.g. `alerts`, `deploy`, `health`) in [BACKEND/docs/TELEGRAM_INTEGRATION.md](docs/TELEGRAM_INTEGRATION.md). | [BACKEND/docs/TELEGRAM_INTEGRATION.md](docs/TELEGRAM_INTEGRATION.md) |

---

## Point 4 — Per-user/per-company Telegram notifications

**Goal:** Users can link a Telegram chat to their company and receive opted-in alerts.

| Step | Action | Files |
|------|--------|--------|
| 4.1 | Add model `TelegramUserLink`: `company` (FK to Company), `user` (FK to DashUser, optional), `telegram_chat_id` (str), `telegram_bot` (FK to TelegramBot), `link_token` (str, nullable), `link_token_expires_at` (datetime, nullable), `opted_in_alerts` (bool), `opted_in_reports` (bool), `opted_in_device_events` (bool), `created_at`, `updated_at`. UniqueConstraint on `(company, telegram_chat_id)` or `(user, telegram_chat_id)`. | [BACKEND/api/models.py](api/models.py) |
| 4.2 | Create and run migration for `TelegramUserLink`. | `api/migrations/` |
| 4.3 | Add serializer and ViewSet for `TelegramUserLink`: list (filter by current user's company), create (generate link_token, set expires_at = now + 15 min), retrieve, update (preferences), delete. Create = only for authenticated dashboard user; returns `link_token` and deep link `https://t.me/<bot_username>?start=link_<token>`. | [BACKEND/api/serializers.py](api/serializers.py), new or in [BACKEND/api/views/telegram.py](api/views/telegram.py) |
| 4.4 | Register route e.g. `telegram-links/` in [BACKEND/api/urls.py](api/urls.py). Permission: IsAuthenticated; filter queryset by `request.user`'s company (via DashUser). | [BACKEND/api/urls.py](api/urls.py), views |
| 4.5 | Implement `/link <token>` in webhook: in `_make_webhook_for_bot`, `cmd_link`: parse token from args; look up `TelegramUserLink` with `link_token=token`, not expired; set `telegram_chat_id` from update, set `telegram_bot_id=bot_id`, clear `link_token` and `link_token_expires_at`; save; send_message "Linked successfully." | [BACKEND/api/views/telegram.py](api/views/telegram.py) |
| 4.6 | Add helper e.g. `send_company_telegram_alert(company_id, text, category='alerts')` that loads `TelegramUserLink` for that company with `opted_in_*` True for that category and sends to each chat via `send_message(..., chat_id=..., bot_id=link.telegram_bot_id)`. Use from tasks/views where company-scoped alerts are needed. | [BACKEND/api/utils/telegram.py](api/utils/telegram.py) or new helper module |
| 4.7 | Register `TelegramUserLink` in admin. | [BACKEND/api/admin.py](api/admin.py) |

---

## Point 5 — Dashboard UX (bots + subscriptions + auto messages)

**Goal:** UI for per-user Telegram links and for scheduled Telegram messages.

| Step | Action | Files |
|------|--------|--------|
| 5.1 | **My Telegram / Telegram notifications:** Add API client in dashboard: `listTelegramLinks()`, `createTelegramLink()` (returns token + deep link), `updateTelegramLink(id, preferences)`, `deleteTelegramLink(id)`. | [DASHBOARD_FASTPAY/src/lib/telegram-api.ts](DASHBOARD_FASTPAY/src/lib/telegram-api.ts) (and REDPAY) |
| 5.2 | Add section or tab "Telegram notifications" / "My Telegram": show current link (chat id, bot name, linked at); button "Connect Telegram" that calls create and shows token + t.me link and instructions ("Send /link &lt;token&gt; to the bot"); toggles for opted_in_alerts, opted_in_reports, opted_in_device_events; disconnect button. | New component under [DASHBOARD_FASTPAY/src/pages/dashboard/](DASHBOARD_FASTPAY/src/pages/dashboard/) or inside existing Telegram section; same for REDPAY |
| 5.3 | **Auto messages (Point 8 UI):** Add "Scheduled tasks" or "Auto messages" subsection: fetch `GET /api/available-tasks/`, `GET /api/scheduled-tasks/`. Form: task dropdown (default `api.tasks.send_telegram_message_async`), schedule type (interval/crontab), interval_every/period or crontab fields, kwargs as JSON text (e.g. `{"text": "Daily digest", "bot_name": "alerts"}`). List with Run / Toggle / Delete. | New component; [DASHBOARD_FASTPAY/src/lib/](DASHBOARD_FASTPAY/src/lib/) for API client (scheduled-tasks + available-tasks) |
| 5.4 | Add sidebar/tab entry for "Scheduled tasks" or "Auto messages" and for "My Telegram" if separate. | [DASHBOARD_FASTPAY/src/lib/sidebar-tabs.ts](DASHBOARD_FASTPAY/src/lib/sidebar-tabs.ts), [DASHBOARD_FASTPAY/src/pages/dashboard/types.ts](DASHBOARD_FASTPAY/src/pages/dashboard/types.ts), DashboardShell or equivalent |
| 5.5 | (Optional) In Telegram Bots section: show "Webhook: configured" or "Webhook: not set" per bot (could call a small endpoint that checks Telegram getWebhookInfo for that bot, or rely on doc). | [DASHBOARD_FASTPAY/src/pages/dashboard/components/TelegramBotsSection.tsx](DASHBOARD_FASTPAY/src/pages/dashboard/components/TelegramBotsSection.tsx) |

---

## Point 6 — Deployment and webhook registration

**Goal:** One-command webhook registration and clear env/docs.

| Step | Action | Files |
|------|--------|--------|
| 6.1 | Add management command `register_telegram_webhook`: args `--bot-id`, optional `--base-url` (default from `settings.TELEGRAM_WEBHOOK_BASE_URL` or `SITE_URL`). Load `TelegramBot` by id; build URL `{base_url}/api/telegram/webhook/{bot_id}/`; call `requests.post(f"https://api.telegram.org/bot{bot.token}/setWebhook", data={"url": url, "secret_token": settings.TELEGRAM_WEBHOOK_SECRET or None})`. Print success or error. | New: [BACKEND/api/management/commands/register_telegram_webhook.py](api/management/commands/register_telegram_webhook.py) |
| 6.2 | Add `TELEGRAM_WEBHOOK_BASE_URL` to settings (default from SITE_URL), used by the management command so staging/production can override. | [BACKEND/fastpay_be/settings.py](fastpay_be/settings.py) |
| 6.3 | Document in [BACKEND/docs/TELEGRAM_INTEGRATION.md](docs/TELEGRAM_INTEGRATION.md) and [docs/DEPLOY_PROCESS.md](docs/DEPLOY_PROCESS.md) or [docs/VPS_DEPLOY_STRUCTURE.md](docs/VPS_DEPLOY_STRUCTURE.md): staging uses `sapi.<domain>`, production `api.<domain>`; run `python manage.py register_telegram_webhook --bot-id=1` after deploy. | [BACKEND/docs/TELEGRAM_INTEGRATION.md](docs/TELEGRAM_INTEGRATION.md), repo docs |

---

## Point 7 — Testing and staging checklist

**Goal:** Automated tests for webhook and linking; checklist for staging.

| Step | Action | Files |
|------|--------|--------|
| 7.1 | Add `test_telegram_webhook_post_returns_200`: POST valid Telegram Update JSON to `/api/telegram/webhook/1/`, assert 200 and `{"ok": true}`. Optionally mock `send_message` and assert it was called for `/start`. | New: [BACKEND/api/tests/test_telegram_webhook.py](api/tests/test_telegram_webhook.py) |
| 7.2 | Add test for `/link` flow: create `TelegramUserLink` with token; POST webhook body with message "/link &lt;token&gt;"; assert link's `telegram_chat_id` and `telegram_bot_id` set, token cleared. | Same file |
| 7.3 | Add test for webhook 403 when `TELEGRAM_WEBHOOK_SECRET` is set and header wrong; 404 when bot_id invalid or inactive. | Same file |
| 7.4 | Document **staging verification checklist** in a single place (e.g. [BACKEND/docs/TELEGRAM_INTEGRATION.md](docs/TELEGRAM_INTEGRATION.md) or [STAGING_TEST_PLAN.md](STAGING_TEST_PLAN.md)): (1) setWebhook for staging bot, (2) send /start and see reply, (3) create scheduled task with telegram task + kwargs, run once, (4) create company link from dashboard, send /link in Telegram, (5) trigger an alert and confirm delivery. | [BACKEND/docs/TELEGRAM_INTEGRATION.md](docs/TELEGRAM_INTEGRATION.md) or [STAGING_TEST_PLAN.md](STAGING_TEST_PLAN.md) |

---

## Point 8 — Auto message using Celery

**Goal:** Admins can schedule recurring Telegram messages from the dashboard (no new backend model).

| Step | Action | Files |
|------|--------|--------|
| 8.1 | Confirm `available_tasks` includes `api.tasks.send_telegram_message_async` and `api.tasks.send_telegram_alert_async` (they do when app loads). No backend change if already present. | [BACKEND/api/views/tasks.py](api/views/tasks.py) |
| 8.2 | Implement **dashboard UI** (see Point 5.3): scheduled tasks list + create form with task selection (pre-select Telegram tasks), schedule (interval/crontab), and kwargs JSON. | DASHBOARD_FASTPAY (and REDPAY) |
| 8.3 | (Optional) If you want a **dedicated “Scheduled Telegram Message”** model later: add `ScheduledTelegramMessage`, migration, Celery beat task that runs every minute and sends due messages via `send_telegram_message_async.delay(...)`, plus ViewSet and UI. Defer unless product asks for it. | Backend + dashboard |

---

## Summary table

| Point | Main deliverable | Backend | Dashboard |
|-------|------------------|---------|-----------|
| 3 | Richer alerts (templates, throttle_key, optional Redis/metrics) | telegram.py, tasks, mobile, send_device_alerts | — |
| 4 | Per-user links (model, API, /link in webhook) | models, migrations, serializers, views, telegram webhook | telegram-api.ts, My Telegram section |
| 5 | Dashboard UX (My Telegram + Auto messages UI) | — (uses 4 and 8) | telegram-api, new components, sidebar |
| 6 | Webhook registration command + docs | management command, settings, docs | — |
| 7 | Tests + staging checklist | test_telegram_webhook.py | — |
| 8 | Auto message from dashboard | No change (API exists) | Scheduled tasks / Auto messages UI |

Use this as the checklist for the remainder; implement in the order above or adjust per priority (e.g. Point 8 + 5.3 first for quick “auto message” win).

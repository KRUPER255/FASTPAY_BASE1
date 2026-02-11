# FastPay Backend API Reference

API base path: **`/api/`**

- **Development:** `http://127.0.0.1:8000/api/`
- **Production:** `https://api.fastpaygaming.com/api/` (or your configured API host)

All paths below are relative to `/api/`. Pagination uses `skip` and `limit` where supported.

---

## Separation by consumer

| Consumer | Purpose |
|----------|---------|
| **Dashboard** | Web admin UI: login, devices, messages, notifications, contacts, bank data, Gmail/Drive, Telegram bots, logs, scheduled tasks. |
| **APK** | Android app: login/registration with activation code, device heartbeat, sync of messages/notifications/contacts, sync contract. |

Some resources (e.g. `devices/`, `messages/`) are used by both: **Dashboard** typically reads and manages; **APK** typically writes (sync) and updates device state. The sections below list endpoints by primary consumer; shared endpoints appear under both where relevant.

---

## Table of Contents

1. [API for Dashboard](#api-for-dashboard)
2. [API for APK (mobile app)](#api-for-apk-mobile-app)
3. [Shared / Other](#shared--other)
4. [Firebase sync (add data to backend)](#firebase-sync-add-data-to-backend)
5. [Response formats](#response-formats)

---

# API for Dashboard

Endpoints used by the **web dashboard** (FastPay/RedPay admin UI).

---

## Health & root

| Method | Path | Description |
|--------|------|-------------|
| GET | *(project)* `/` | Project root. |
| GET | `/api/` | Router root; list of available endpoints. |
| GET | `health/` | API health check. Returns `200` with body `ok`. |
| GET | *(project)* `/health/` | Project-level health (no `/api`); for load balancers. |

---

## Dashboard auth & account

| Method | Path | Description |
|--------|------|-------------|
| POST | `dashboard-login/` | Login. Body: `{"email": "...", "password": "..."}`. Returns `success`, `admin` (email, access, status). |
| POST | `dashboard-profile/` | Get profile. Body: `{"email": "..."}`. |
| GET | `dashboard-users/` | List dashboard users (admin-only). Query: `admin_email`. Returns `users` with `assigned_device_count`. |
| POST | `devices/assign/` | Assign devices to user (admin-only). Body: `admin_email`, `user_email`, `device_ids` (array). |
| POST | `devices/unassign/` | Unassign devices from user (admin-only). Body: `admin_email`, `user_email`, `device_ids` (array). |
| POST | `dashboard-user-create/` | Create dashboard user (admin-only). Body: `admin_email`, `email`, `password`, `full_name` (optional), `access_level` (0\|1\|2). |
| POST | `dashboard-user-update/` | Update dashboard user (admin-only). Body: `admin_email`, `email`, optional `full_name`, `access_level`, `status` (active\|inactive\|suspended). |
| POST | `dashboard-update-profile/` | Update profile. Body: `{"email": "...", "full_name": "...", "phone": "...", "theme": "..."}`. |
| POST | `dashboard-reset-password/` | Reset password. Body: `{"email": "...", "token": "...", "new_password": "..."}`. |
| POST | `dashboard-update-access/` | Update user access level. Body: `{"email": "...", "access_level": 0\|1\|2}`. |
| POST | `dashboard-configure-access/` | Configure access map. Body: `{"access_map": {...}}`. |
| POST | `dashboard-update-theme-mode/` | Set theme mode. Body: `{"email": "...", "theme_mode": "light\|dark"}`. |
| POST | `dashboard-activity-logs/` | List activity logs. Body: `{"user_email": "...", "activity_type": "...", "limit": 100}`. |
| POST | `dashboard-send-verification-email/` | Send verification email. Body: `{"email": "...", "purpose": "password_reset\|verify_email"}`. |
| POST | `dashboard-verify-email-token/` | Verify token. Body: `{"email": "...", "token": "...", "purpose": "password_reset\|verify_email"}`. |

---

## Devices (dashboard: list, manage)

| Method | Path | Description |
|--------|------|-------------|
| GET | `devices/` | List devices. Query: `code`, `is_active`, `device_id`, `user_email`, `skip`, `limit`. |
| POST | `devices/` | Create device (dashboard: create with or without bank card). |
| GET | `devices/{device_id}/` | Get device by `device_id`. |
| PUT | `devices/{device_id}/` | Full update. |
| PATCH | `devices/{device_id}/` | Partial update. |
| DELETE | `devices/{device_id}/` | Delete device. |
| PATCH | `devices/{device_id}/activate/` | Activate device. |
| PATCH | `devices/{device_id}/deactivate/` | Deactivate device. |
| GET | `devices/{device_id}/complete/` | Full device payload. Query: `message_limit`, `notification_limit`, `include_contacts`, `include_bank_card`. |

---

## Messages (dashboard: list, view)

| Method | Path | Description |
|--------|------|-------------|
| GET | `messages/` | List messages. Query: `device_id`, `message_type` (received/sent), `phone`, `skip`, `limit`. |
| GET | `messages/{id}/` | Get message by ID. |
| PATCH | `messages/{id}/` | Partial update. |
| PUT | `messages/{id}/` | Full update. |
| DELETE | `messages/{id}/` | Delete message. |

---

## Notifications (dashboard: list, view)

| Method | Path | Description |
|--------|------|-------------|
| GET | `notifications/` | List notifications. Query: `device_id`, `package_name`, `skip`, `limit`. |
| GET | `notifications/{id}/` | Get notification by ID. |
| PATCH | `notifications/{id}/` | Partial update. |
| PUT | `notifications/{id}/` | Full update. |
| DELETE | `notifications/{id}/` | Delete notification. |

---

## Contacts (dashboard: list, view, edit)

| Method | Path | Description |
|--------|------|-------------|
| GET | `contacts/` | List contacts. Query: `device_id`, `phone_number`, `name`, `simple=true`, `skip`, `limit`. |
| GET | `contacts/{id}/` | Get contact by ID. |
| PATCH | `contacts/{id}/` | Partial update. |
| PUT | `contacts/{id}/` | Full update. |
| DELETE | `contacts/{id}/` | Delete contact. |

---

## File system (dashboard)

Paths relative to `STORAGE_ROOT`. Query/body: `path` (relative path).

| Method | Path | Description |
|--------|------|-------------|
| GET | `fs/list/?path=<path>` | List directory contents. |
| POST | `fs/directory/` | Create directory. Body: `{"path": "relative/path"}`. |
| POST | `fs/upload/` | Upload file. Form: `path`, `file`. |
| GET | `fs/download/?path=<path>` | Download file. |
| DELETE | `fs/delete/?path=<path>` | Delete file or directory. |

---

## Bank card templates (dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET | `bank-card-templates/` | List templates. Query: `is_active`, `template_code`, `skip`, `limit`. |
| POST | `bank-card-templates/` | Create template. |
| GET | `bank-card-templates/{id}/` | Get template by ID. |
| PATCH | `bank-card-templates/{id}/` | Partial update. |
| PUT | `bank-card-templates/{id}/` | Full update. |
| DELETE | `bank-card-templates/{id}/` | Delete template. |

---

## Bank cards (dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET | `bank-cards/` | List bank cards. Query: `device_id`, `bank_name`, `status`, `card_type`, `skip`, `limit`. |
| POST | `bank-cards/` | Create bank card (include `device_id`). |
| GET | `bank-cards/by-device/{device_id}/` | Get bank card for device. |
| GET | `bank-cards/{id}/` | Get bank card by ID. |
| PATCH | `bank-cards/{id}/` | Partial update. |
| PUT | `bank-cards/{id}/` | Full update. |
| DELETE | `bank-cards/{id}/` | Delete bank card. |

---

## Banks (dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET | `banks/` | List banks. Query: `name`, `code`, `ifsc_code`, `is_active`, `country`, `skip`, `limit`. |
| POST | `banks/` | Create bank. |
| GET | `banks/{id}/` | Get bank by ID. |
| PATCH | `banks/{id}/` | Partial update. |
| PUT | `banks/{id}/` | Full update. |
| DELETE | `banks/{id}/` | Delete bank. |

---

## Gmail accounts (dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET | `gmail-accounts/` | List Gmail account records. |
| POST | `gmail-accounts/` | Create Gmail account record. |
| GET | `gmail-accounts/{id}/` | Get by ID. |
| PATCH | `gmail-accounts/{id}/` | Partial update. |
| PUT | `gmail-accounts/{id}/` | Full update. |
| DELETE | `gmail-accounts/{id}/` | Delete. |

---

## BlackSMS (dashboard: send OTP)

| Method | Path | Description |
|--------|------|-------------|
| POST | `blacksms/sms/` | Send SMS. Body: `{"numbers": "...", "variables_values": "4 or 6 digits"}`. Optional `variables_values`; server can generate. |
| POST | `blacksms/whatsapp/` | Send WhatsApp. Body: same as SMS. Returns `status`, `message`, `variables_values`. |

---

## Gmail (dashboard: Gmail UI)

All scoped by `user_email` (query or body).

| Method | Path | Description |
|--------|------|-------------|
| GET | `gmail/oauth-debug/` | OAuth config (client_id, redirect_uri; no secrets). |
| POST | `gmail/init-auth/` | Start OAuth. Body: `{"user_email": "...", "method": "webpage\|sms\|email"}`. Returns `auth_url`, `expires_in`, `token`, `short_link`. |
| GET | `gmail/callback/` | OAuth callback. Query: `code`, `state`. |
| GET | `gmail/status/` | Connection status. Query: `user_email`. |
| GET | `gmail/messages/` | List messages. Query: `user_email`, `max_results`, `page_token`, `query`, `label_ids`. |
| GET | `gmail/messages/{message_id}/` | Message detail. Query: `user_email`. |
| POST | `gmail/send/` | Send email. Body: `user_email`, `to`, `subject`, `body`, optional `body_html`, `cc`, `bcc`. |
| POST | `gmail/bulk-send/` | Bulk send. Body: `user_email`, list of `{to, subject, body, ...}`. |
| POST | `gmail/messages/{message_id}/modify-labels/` | Modify labels. Body: `user_email`, `add_label_ids`, `remove_label_ids`. |
| POST | `gmail/bulk-modify-labels/` | Bulk modify labels. Body: `user_email`, list of message IDs and label changes. |
| DELETE | `gmail/messages/{message_id}/delete/` | Delete message. Query: `user_email`. |
| GET | `gmail/labels/` | List labels. Query: `user_email`. |
| GET | `gmail/statistics/` | Gmail stats. Query: `user_email`. |
| POST | `gmail/disconnect/` | Disconnect Gmail. Body: `{"user_email": "..."}`. |

---

## Google Drive (dashboard: Drive UI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `drive/files/` | List files. Query: `user_email`, `page_token`, `query`. |
| GET | `drive/files/{file_id}/` | File metadata. Query: `user_email`. |
| GET | `drive/files/{file_id}/download/` | Download file. Query: `user_email`. |
| GET | `drive/files/{file_id}/delete/` | Delete file. Query: `user_email`. |
| POST | `drive/files/{file_id}/share/` | Share file. Body: `user_email`, share options. |
| POST | `drive/files/{file_id}/copy/` | Copy file. Body: `user_email`, optional `name`, `parent_id`. |
| POST | `drive/upload/` | Upload file. Form: `file`, `user_email`, optional `folder_id`. |
| POST | `drive/folders/` | Create folder. Body: `user_email`, `name`, optional `parent_id`. |
| GET | `drive/storage/` | Storage info. Query: `user_email`. |
| GET | `drive/search/` | Search files. Query: `user_email`, `query`. |

---

## Telegram (dashboard: bot management)

| Method | Path | Description |
|--------|------|-------------|
| GET | `telegram-bots/` | List bots. Query: `dropdown=true`, `is_active`, `chat_type`, `name`, pagination. |
| POST | `telegram-bots/` | Create bot. Body: `name`, `token`, `chat_ids`, `chat_type`, `description`, etc. |
| GET | `telegram-bots/{id}/` | Get bot. |
| PUT | `telegram-bots/{id}/` | Full update. |
| PATCH | `telegram-bots/{id}/` | Partial update. |
| DELETE | `telegram-bots/{id}/` | Delete bot. |
| POST | `telegram-bots/{id}/test/` | Send test message. Body: `message`, optional `chat_id`, `message_thread_id`. |
| POST | `telegram-bots/{id}/validate/` | Validate stored token. |
| GET | `telegram-bots/{id}/discover-chats/` | Discover chats from getUpdates. |
| POST | `telegram-bots/{id}/lookup-chat/` | Lookup chat by username. Body: `{"username": "@mychannel"}`. |
| POST | `telegram-bots/{id}/sync-info/` | Sync bot/chat info from Telegram API. |
| GET | `telegram-bots/{id}/get-me/` | Bot info and setup links. |
| POST | `telegram/validate-token/` | Validate token (no bot ID). Body: `{"token": "..."}`. |
| POST | `telegram/discover-chats/` | Discover chats with token only. Body: `{"token": "..."}`. |
| POST | `telegram/lookup-chat/` | Lookup chat with token. Body: `{"token": "...", "username": "@mychannel"}`. |

---

## Logs (dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET | `command-logs/` | List command logs. Filter by device, command_type, etc. |
| GET | `auto-reply-logs/` | List auto-reply logs. |
| GET | `activation-failure-logs/` | List activation failure logs. |
| GET | `api-request-logs/` | List API request logs. |

---

## Scheduled tasks & results (dashboard)

| Method | Path | Description |
|--------|------|-------------|
| GET | `scheduled-tasks/` | List scheduled tasks. |
| POST | `scheduled-tasks/` | Create task. Body: `name`, `task` (e.g. `api.tasks.sync_firebase_messages_task`), `enabled`, `schedule_type` (`interval` or `crontab`), interval/crontab fields. |
| GET | `scheduled-tasks/{id}/` | Get task. |
| PUT | `scheduled-tasks/{id}/` | Full update. |
| PATCH | `scheduled-tasks/{id}/` | Partial update. |
| DELETE | `scheduled-tasks/{id}/` | Delete task. |
| POST | `scheduled-tasks/{id}/run/` | Run task now. Returns `task_id`, `status`, `task_name`. |
| POST | `scheduled-tasks/{id}/toggle/` | Enable/disable task. |
| GET | `task-results/` | List task results. Query: `task_name`, `status`, `limit`. |
| GET | `task-results/{id}/` | Get result by ID. |
| GET | `available-tasks/` | List registered task names. |
| GET | `task-status/{task_id}/` | Status of a specific execution (Celery task ID). |

---

## Items & captures (dashboard / internal)

| Method | Path | Description |
|--------|------|-------------|
| GET | `items/` | List items (legacy/test model). |
| POST | `items/` | Create item. |
| GET | `items/{id}/` | Get item. |
| PATCH | `items/{id}/` | Partial update. |
| PUT | `items/{id}/` | Full update. |
| DELETE | `items/{id}/` | Delete item. |
| GET | `captures/` | List capture items. |
| POST | `captures/` | Create capture. |
| GET | `captures/{id}/` | Get capture. |
| PATCH | `captures/{id}/` | Partial update. |
| PUT | `captures/{id}/` | Full update. |
| DELETE | `captures/{id}/` | Delete capture. |

---

# API for APK (mobile app)

Endpoints used by the **Android app** (APK): login/registration, device heartbeat, and data sync.

---

## Login & registration (APK)

| Method | Path | Description |
|--------|------|-------------|
| POST | `validate-login/` | Validate APK login. Body: `{"code": "ACTIVATION_CODE"}`. Returns `approved`, `message`, `device_id`, `bank_card`. |
| GET | `isvalidcodelogin` | Legacy code validation (query params as used by APK). |
| POST | `registerbanknumber` | Register bank number (APK registration flow). |

---

## Device (APK: register, heartbeat)

| Method | Path | Description |
|--------|------|-------------|
| POST | `devices/` | Register device (APK: send `device_id` and optional device info; server may create or link). |
| PATCH | `devices/{device_id}/update-last-seen/` | Update last seen timestamp (heartbeat). |
| PATCH | `devices/{device_id}/update-battery/` | Update battery. Body: `{"battery_percentage": 0-100}`. |

---

## Messages (APK: sync to server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `messages/` | Create one or many messages (bulk sync). Body: single object or array; device resolution by `device_id`. |

---

## Notifications (APK: sync to server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `notifications/` | Create one or many notifications (bulk sync). |

---

## Contacts (APK: sync to server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `contacts/` | Create/update contacts. Body: single contact, array, or Firebase-style map keyed by phone. Uses update_or_create. |

---

## Sync (APK: contract & status)

| Method | Path | Description |
|--------|------|-------------|
| GET | `sync/contract/` | Sync contract (schema/expectations for mobile sync). |
| GET | `sync/status/` | Sync status. |

---

# Shared / Other

Used by both dashboard and APK, by infrastructure, or by external systems.

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `health/` | API health. Returns `200` with body `ok`. Used by load balancers, Docker, dashboard. |
| GET | *(project root)* `/health/` | Project-level health (no `/api` prefix). |

---

## Webhooks (external systems)

| Method | Path | Description |
|--------|------|-------------|
| POST | `webhooks/receive/` | Generic webhook receiver. |
| POST | `webhooks/failed/` | Failed event webhook. |
| POST | `webhooks/success/` | Success event webhook. |
| POST | `webhooks/refund/` | Refund webhook. |
| POST | `webhooks/dispute/` | Dispute webhook. |

---

## Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `ip/download/file/` | IP-based file download (query params as implemented). |

---

# Firebase sync (add data to backend)

Device ID in Firebase and in the backend (Django `Device.device_id`) are the same; devices are matched by this id when copying.

**To add Firebase data into the backend:**

- **Management command (from `BACKEND/`):**
  ```bash
  python manage.py copy_firebase_to_django --stage   # staging: fastpay/testing/{deviceId}
  python manage.py copy_firebase_to_django --prod    # production: device/{deviceId}, fastpay/running/{deviceId}
  ```
  Optional: `--device-id=ID`, `--dry-run`, `--limit=N` (messages per device, default 100), `--no-update-existing`, `--messages-only`.

- **Script (from `BACKEND/` or repo root):**
  ```bash
  ./scripts/add_firebase_data_to_backend.sh [stage|prod] [--device-id=ID] [--dry-run] [--limit=N]
  ```
  Uses Docker if the backend runs in a container; otherwise runs `manage.py` directly. Default environment is `stage`.

Path reference: [api/utils/FIREBASE_PATHS.md](../api/utils/FIREBASE_PATHS.md).

---

# Response formats

- **Success:** JSON object(s) or list; DRF standard for ViewSets. Many endpoints use `api.response.success_response` / `error_response`.
- **Error:** `{"detail": "..."}` or `{"error": "..."}`; HTTP status 4xx/5xx.
- **Batch uploads (e.g. messages, notifications, contacts):** May return `created_count`, `errors_count`, `created`, `errors` (array of `{index, error, data}`).
- **Pagination:** Many list endpoints use `skip` and `limit`; response is the list (and optionally a count), depending on the view.

Authentication is currently per-endpoint; production should enforce authentication/authorization. See [BACKEND_DOCUMENTATION.md](../BACKEND_DOCUMENTATION.md) for security notes.

---

*Source: `api/urls.py` and `api/views/`. Last updated: February 2026.*

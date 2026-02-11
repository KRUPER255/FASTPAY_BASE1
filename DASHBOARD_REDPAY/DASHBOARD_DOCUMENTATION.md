# FastPay Dashboard Documentation

Paths below are relative to this project (DASHBOARD_REDPAY).

## Overview
The FastPay Dashboard is a React + Vite web app that provides device monitoring, messaging, bank-card management, and operational tools. It integrates with the Django backend for core data and uses Firebase for near‑real‑time device data.

## Tech Stack
- React + TypeScript (Vite)
- Tailwind CSS + custom UI components
- Django REST API (backend)
- Firebase (device data sync)

## App Entry Points
- App bootstrap: `src/main.tsx`
- Routing: `src/App.tsx`
- Main dashboard page: `src/pages/Dashboard.tsx`
- Layout + sidebar: `src/component/UnifiedLayout.tsx`

## Layout Structure
`UnifiedLayout` provides:
- Left nav (overall tabs)
- Device sidebar (device list + filters)
- Main content area
- Right info sidebar (device summary cards)

## Sidebar Tabs (Overall Navigation)
Defined in `src/lib/sidebar-tabs.ts`:
- Dashboard (`overview`)
- Device (`devices`)
- Bank Cards (`bank-cards`)
- Utilities (`utilities`)
- Failures (`activation-failures`)
- Activity (`activity-logs`)
- API (`api`)

Behavior:
- Default tab is `overview`
- Active tab is persisted in local storage
- URL query `?tab=<key>` will set active tab
- Role-based disabling is applied for restricted items

## Device Sidebar
Component: `src/component/DeviceSidebar.tsx`
- Lists devices with online/offline status, battery, and metadata
- Supports search and filter controls
- Selecting a device updates the main content area and device sub‑tabs

## Device Sub-Tabs
Device sub‑tabs are controlled in `src/pages/Dashboard.tsx` and rendered by `DeviceSubTabs`.
Common sub‑tabs:
- Messages (`sms`)
- Notifications
- Contacts
- Files/Inputs
- Commands
- Permissions
- System Info
- Remote Messages
- Instructions/Templates
- Bank Info

## Core Data Flows
### Django API (REST)
Client utilities live in `src/lib/api-client.ts`.
Examples:
- Devices: `GET /api/devices/`
- Login: `POST /api/dashboard-login/`
- Profile: `POST /api/dashboard-profile/`

## API Reference (Dashboard)
Base URL is configured by `VITE_API_BASE_URL` and normalized in `src/lib/api-client.ts`.

**Staging vs production:** Use `.env.staging` for staging builds and `.env.production` for production. Set `VITE_API_BASE_URL` to the backend API origin for each environment. For Gmail/Drive OAuth on a domain, see **BACKEND/docs/GMAIL_DRIVE_DEPLOY.md** (backend and dashboard env + Google Console).
Common endpoints used by the dashboard:
- Auth: `POST /api/dashboard-login/`, `POST /api/dashboard-profile/`, `POST /api/dashboard-update-profile/`, `POST /api/dashboard-reset-password/`
- Access + theme: `POST /api/dashboard-update-access/`, `POST /api/dashboard-configure-access/`, `POST /api/dashboard-update-theme-mode/`
- Devices: `GET /api/devices/`, `POST /api/devices/`, `GET /api/devices/{device_id}/`, `PATCH /api/devices/{device_id}/activate/`, `PATCH /api/devices/{device_id}/update-battery/`
- Messages: `GET /api/messages/`, `POST /api/messages/`
- Notifications: `GET /api/notifications/`, `POST /api/notifications/`
- Contacts: `GET /api/contacts/`, `POST /api/contacts/`
- Bank cards: `GET /api/bank-cards/`, `GET /api/bank-cards/by-device/{device_id}/`, `POST /api/bank-cards/`, `POST /api/bank-cards/batch/`
- Bank templates: `GET /api/bank-card-templates/?is_active=true`
- Activation + activity logs: `GET /api/activation-failure-logs/`, `POST /api/dashboard-activity-logs/`, `GET /api/api-request-logs/`, `GET /api/command-logs/`
- Gmail (backend OAuth): `POST /api/gmail/init-auth/`, `GET /api/gmail/status/`, `GET /api/gmail/messages/`, `GET /api/gmail/messages/{message_id}/`, `POST /api/gmail/send/`, `GET /api/gmail/labels/`, `POST /api/gmail/disconnect/`, `GET /api/gmail/statistics/`
- Google Drive: `GET /api/drive/files/`, `GET /api/drive/files/{file_id}/`, `GET /api/drive/files/{file_id}/download/`, `POST /api/drive/upload/`, `POST /api/drive/folders/`, `DELETE /api/drive/files/{file_id}/delete/`, `POST /api/drive/files/{file_id}/share/`, `POST /api/drive/files/{file_id}/copy/`, `GET /api/drive/search/`, `GET /api/drive/storage/`
- OTP/SMS helpers: `POST /api/send-sms`, `POST /api/send-whatsapp`
- Gmail legacy token exchange: `POST /api/auth/google/token`
- Phone lookup proxy: `GET /api/phone-data/{phoneNumber}`
- APK login validation: `POST /api/validate-login/`
- File system: `GET /api/fs/list/`, `POST /api/fs/upload/`, `GET /api/fs/download/`, `DELETE /api/fs/delete/`

### Endpoint Implementation Map (Dashboard)
- `POST /api/dashboard-login/` -> `src/lib/auth.ts`
- `POST /api/dashboard-profile/` -> `src/lib/auth.ts`, `src/component/ProfileViewDialog.tsx`
- `POST /api/dashboard-update-profile/` -> `src/component/EditProfileDialog.tsx`
- `POST /api/dashboard-reset-password/` -> `src/component/ResetPasswordDialog.tsx`
- `POST /api/dashboard-update-access/` -> `src/lib/auth.ts`
- `POST /api/dashboard-configure-access/` -> `src/lib/auth.ts`
- `POST /api/dashboard-update-theme-mode/` -> `src/lib/auth.ts`
- `GET /api/devices/` -> `src/lib/api-client.ts`
- `POST /api/devices/`, `GET /api/devices/{device_id}/`, `PATCH /api/devices/{device_id}/activate/`, `PATCH /api/devices/{device_id}/update-battery/` -> `src/component/ApiSection.tsx` (API tab reference)
- `GET /api/messages/`, `POST /api/messages/` -> `src/component/ApiSection.tsx` (API tab reference; primary data via Firebase)
- `GET /api/notifications/`, `POST /api/notifications/` -> `src/component/ApiSection.tsx` (API tab reference; primary data via Firebase)
- `GET /api/contacts/`, `POST /api/contacts/` -> `src/component/ApiSection.tsx` (API tab reference; primary data via Firebase)
- `GET /api/bank-cards/` -> `src/pages/dashboard/components/BankCardsList.tsx`
- `GET /api/bank-cards/by-device/{device_id}/` -> `src/pages/Dashboard.tsx`
- `POST /api/bank-cards/` -> `src/pages/dashboard/components/AddBankCardSection.tsx`
- `POST /api/bank-cards/batch/` -> `src/component/DeviceSidebar.tsx`
- `GET /api/bank-card-templates/?is_active=true` -> `src/pages/dashboard/components/AddBankCardSection.tsx`
- `GET /api/activation-failure-logs/` -> `src/pages/dashboard/components/ActivationFailureLogsSection.tsx`
- `POST /api/dashboard-activity-logs/` -> `src/pages/dashboard/components/ActivityLogsSection.tsx`
- `GET /api/api-request-logs/` -> `src/component/ApiSection.tsx`
- `GET /api/command-logs/` -> `src/component/ApiSection.tsx`
- `POST /api/gmail/init-auth/` -> `src/lib/backend-gmail-api.ts`, `src/pages/dashboard/components/GmailSection.tsx`
- `GET /api/gmail/status/` -> `src/lib/backend-gmail-api.ts`
- `GET /api/gmail/messages/` -> `src/lib/backend-gmail-api.ts`, `src/pages/dashboard/components/GmailSection.tsx`
- `GET /api/gmail/messages/{message_id}/` -> `src/lib/backend-gmail-api.ts`, `src/pages/dashboard/components/GmailSection.tsx`
- `POST /api/gmail/send/` -> `src/lib/backend-gmail-api.ts`
- `GET /api/gmail/labels/` -> `src/lib/backend-gmail-api.ts`
- `POST /api/gmail/disconnect/` -> `src/lib/backend-gmail-api.ts`, `src/pages/dashboard/components/GmailSection.tsx`
- `GET /api/gmail/statistics/` -> `src/lib/backend-gmail-api.ts`
- `GET /api/drive/files/`, `GET /api/drive/files/{file_id}/`, `GET /api/drive/files/{file_id}/download/`, `POST /api/drive/upload/`, `POST /api/drive/folders/`, `DELETE /api/drive/files/{file_id}/delete/`, `POST /api/drive/files/{file_id}/share/`, `POST /api/drive/files/{file_id}/copy/`, `GET /api/drive/search/`, `GET /api/drive/storage/` -> `src/lib/backend-drive-api.ts`
- `POST /api/send-sms` -> `src/lib/api-client.ts`, `src/pages/Dashboard.tsx`, `src/hooks/otp/useOTPSend.ts`
- `POST /api/send-whatsapp` -> `src/pages/Dashboard.tsx`
- `POST /api/auth/google/token` -> `src/lib/gmail-api.ts`, `src/pages/auth/GmailCallback.tsx`
- `GET /api/phone-data/{phoneNumber}` -> `src/pages/Dashboard.tsx`
- `POST /api/validate-login/` -> `src/component/ApiSection.tsx` (API tab reference)
- `GET /api/fs/list/`, `POST /api/fs/upload/`, `GET /api/fs/download/`, `DELETE /api/fs/delete/` -> `src/component/ApiSection.tsx` (API tab reference)

## Data Schema (Key Models)
Primary TypeScript definitions are in `src/pages/dashboard/types.ts`.

- Device/User (simplified):
  - `id`, `device`, `phone`, `code`, `time`
  - `lastSeen`, `batteryPercentage`, `isOnline`
- SMS:
  - `id`, `sender`, `time`, `is_sent`, `body`, `user`, `timestamp`, `phone`
- Notification:
  - `id`, `app`, `time`, `title`, `body`, `user`
- Contact:
  - `phone`, `name`

### Firebase (Realtime)
Firebase helpers are in `src/lib/firebase-helpers.ts`.
Used for:
- Device lists and metadata
- Messages, notifications, and live status updates

## Authentication & Sessions
Auth utilities: `src/lib/auth.ts`
- Sessions stored in local storage
- Access levels:
  - `0` = Full Admin
  - `1` = OTP only
  - `2` = RedPay only

## Theme & Appearance
Theme logic: `src/lib/theme.ts`
- Light/Dark mode and theme presets
- Theme mode is persisted locally and can sync with backend preference

## Key Components by Feature
- Device list + status: `DeviceSidebar`, `DeviceListManager`
- Device summary cards: `DeviceSummaryCards`
- Messages: `MessagesSection`
- Notifications: `NotificationsSection`
- Contacts: `ContactsSection`
- Bank Cards: `BankCardsList`, `BankInfoSection`
- Utilities: `UtilitiesSection`
- System Info: `SystemInfoSection`

## Testing
Unit and component tests live under:
- `src/test/`
- `src/component/**/*.test.tsx`
- `src/hooks/**/*.test.ts`

## Common Tasks
### Change Sidebar Tabs
Edit `src/lib/sidebar-tabs.ts` to add/remove/rename tabs or adjust access levels.

### Change Device Sidebar UI
Edit `src/component/DeviceSidebar.tsx`.

### Update API Calls
Edit `src/lib/api-client.ts` or specific feature components.

## Notes
- URL query `?tab=` supports deep-linking into dashboard sections.
- The device sidebar is always visible and drives selection context for device‑specific views.

## Screenshots
Place screenshots under `docs/screenshots/` and reference them here. Example:

![Dashboard Overview](./docs/screenshots/dashboard-overview.png)

# Firebase Realtime Database paths (FastPay)

This document is the single source of truth for canonical and legacy paths used by the backend (see `api/utils/firebase.py`). APK and Dashboard should align with the canonical paths where possible.

## Canonical paths (current)

| Data | Path | Notes |
|------|------|--------|
| Device info | `device/{deviceId}` | Primary. APK writes here. |
| Messages | `message/{deviceId}` | Primary. Also tried: `fastpay/{deviceId}/messages`. |
| Notifications | `device/{deviceId}/Notification` | Primary. |
| Contacts | `device/{deviceId}/Contact` | Primary. |
| Device list (testing) | `fastpay/testing/{code}` | Code-based device list. |
| Device list (running) | `fastpay/running/{code}` | Code-based device list. |
| App config | `fastpay/app` | App-wide config. |

## Legacy paths (still read, do not add new features)

Backend tries these when canonical path is empty. Prefer writing only to canonical paths.

| Data | Legacy path |
|------|-------------|
| Messages | `fastpay/{deviceId}/messages`, `fastpay/testing/{deviceId}/messages`, `fastpay/running/{deviceId}/messages` |
| Notifications | `fastpay/{deviceId}/Notification`, `notification/{deviceId}`, `fastpay/testing|running/{deviceId}/Notification` |
| Contacts | `fastpay/{deviceId}/Contact`, `contact/{deviceId}`, `fastpay/testing|running/{deviceId}/Contact` |
| Device info | `fastpay/{deviceId}`, `fastpay/testing/{deviceId}`, `fastpay/running/{deviceId}` |

## Deprecation

- **Legacy read support:** Backend will continue to read from legacy paths until a deprecation date is set (e.g. document "Legacy read support until: YYYY-MM" when migration is planned).
- **New features:** Use only canonical paths. Do not add new keys or features under legacy paths.
- **Migration:** Before turning off legacy reads, ensure all writers (APK, Dashboard, any scripts) use canonical paths and data has been migrated if needed.

## Code reference

- Message paths: `api/utils/firebase.py` – `get_firebase_messages_for_device` (paths_to_try).
- Notification paths: `get_firebase_notifications_for_device`.
- Contact paths: `get_firebase_contacts_for_device`.
- Device info paths: `get_firebase_device_info`.

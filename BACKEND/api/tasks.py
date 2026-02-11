"""
Celery tasks for FastPay Backend.

This module contains all background and periodic tasks:
- Firebase synchronization
- Telegram notifications (async)
- Device health monitoring
- OAuth token refresh
- Log cleanup and maintenance

Usage:
    # Import and call async tasks
    from api.tasks import send_telegram_message_async
    send_telegram_message_async.delay("Hello World")
    
    # Tasks are also registered for periodic execution via django-celery-beat
"""
import logging
import os
from datetime import timedelta
from typing import Any, Dict, List, Optional

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# Telegram Async Tasks
# =============================================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def send_telegram_message_async(
    self,
    text: str,
    bot_name: Optional[str] = None,
    chat_ids: Optional[List[str]] = None,
    chat_id: Optional[str] = None,
    parse_mode: Optional[str] = None,
    disable_preview: bool = True,
    disable_notification: bool = False,
    reply_markup: Optional[Dict] = None,
) -> bool:
    """
    Send a Telegram message asynchronously.
    
    Args:
        text: Message text
        bot_name: Named bot configuration to use
        chat_ids: List of chat IDs to send to
        chat_id: Single chat ID
        parse_mode: "HTML" or "Markdown"
        disable_preview: Disable link previews
        disable_notification: Send silently
        reply_markup: Inline keyboard or other reply markup
    
    Returns:
        True if message was sent successfully
    """
    try:
        from api.utils.telegram import send_message
        return send_message(
            text,
            bot_name=bot_name,
            chat_ids=chat_ids,
            chat_id=chat_id,
            parse_mode=parse_mode,
            disable_preview=disable_preview,
            disable_notification=disable_notification,
            reply_markup=reply_markup,
        )
    except Exception as exc:
        logger.error(f"Telegram message failed: {exc}")
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def send_telegram_alert_async(
    self,
    text: str,
    bot_name: Optional[str] = None,
    chat_ids: Optional[List[str]] = None,
    throttle_seconds: Optional[int] = None,
    throttle_key: Optional[str] = None,
    parse_mode: Optional[str] = None,
) -> bool:
    """
    Send a throttled Telegram alert asynchronously.
    
    Args:
        text: Alert message text
        bot_name: Named bot configuration
        chat_ids: List of chat IDs
        throttle_seconds: Minimum seconds between identical alerts
        throttle_key: Custom key for throttling
        parse_mode: "HTML" or "Markdown"
    
    Returns:
        True if message was sent (not throttled and successful)
    """
    try:
        from api.utils.telegram import send_alert
        return send_alert(
            text,
            bot_name=bot_name,
            chat_ids=chat_ids,
            throttle_seconds=throttle_seconds,
            throttle_key=throttle_key,
            parse_mode=parse_mode,
        )
    except Exception as exc:
        logger.error(f"Telegram alert failed: {exc}")
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_telegram_photo_async(
    self,
    photo: str,
    caption: Optional[str] = None,
    bot_name: Optional[str] = None,
    chat_ids: Optional[List[str]] = None,
    chat_id: Optional[str] = None,
    parse_mode: Optional[str] = None,
) -> bool:
    """
    Send a Telegram photo asynchronously.
    
    Args:
        photo: File path or URL of the image
        caption: Optional caption text
        bot_name: Named bot configuration
        chat_ids: List of chat IDs
        chat_id: Single chat ID
        parse_mode: "HTML" or "Markdown"
    
    Returns:
        True if photo was sent successfully
    """
    try:
        from api.utils.telegram import send_photo
        return send_photo(
            photo,
            caption=caption,
            bot_name=bot_name,
            chat_ids=chat_ids,
            chat_id=chat_id,
            parse_mode=parse_mode,
        )
    except Exception as exc:
        logger.error(f"Telegram photo failed: {exc}")
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_telegram_document_async(
    self,
    document: str,
    filename: Optional[str] = None,
    caption: Optional[str] = None,
    bot_name: Optional[str] = None,
    chat_ids: Optional[List[str]] = None,
    chat_id: Optional[str] = None,
    parse_mode: Optional[str] = None,
) -> bool:
    """
    Send a Telegram document asynchronously.
    
    Args:
        document: File path or URL of the document
        filename: Filename for the document
        caption: Optional caption text
        bot_name: Named bot configuration
        chat_ids: List of chat IDs
        chat_id: Single chat ID
        parse_mode: "HTML" or "Markdown"
    
    Returns:
        True if document was sent successfully
    """
    try:
        from api.utils.telegram import send_document
        return send_document(
            document,
            filename=filename,
            caption=caption,
            bot_name=bot_name,
            chat_ids=chat_ids,
            chat_id=chat_id,
            parse_mode=parse_mode,
        )
    except Exception as exc:
        logger.error(f"Telegram document failed: {exc}")
        self.retry(exc=exc)


# =============================================================================
# Firebase Sync Tasks
# =============================================================================

@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def sync_firebase_and_cleanup_task(self) -> Dict[str, Any]:
    """
    Sync Firebase to Django for all devices (messages, notifications, contacts)
    and clean Firebase to reduce load. Uses module-based sync commands.
    """
    try:
        from api.sync_commands import run_all_sync_commands

        keep_messages = int(os.environ.get("FIREBASE_SYNC_KEEP_MESSAGES", "100"))
        keep_notifications = int(os.environ.get("FIREBASE_SYNC_KEEP_NOTIFICATIONS", "100"))
        keep_contacts = int(os.environ.get("FIREBASE_SYNC_KEEP_CONTACTS", "0"))

        options_by_name = {
            "messages": {"keep_latest": keep_messages},
            "notifications": {"keep_latest": keep_notifications},
            "contacts": {"keep_latest": keep_contacts},
        }
        result = run_all_sync_commands(device_ids=None, options_by_name=options_by_name)
        logger.info(f"Firebase sync and cleanup completed: {result}")
        return result
    except Exception as exc:
        logger.error(f"Firebase sync and cleanup failed: {exc}")
        send_telegram_alert_async.delay(
            f"⚠️ Firebase sync and cleanup failed: {str(exc)[:200]}",
            bot_name="alerts",
            throttle_key="firebase_sync_cleanup_failed",
            throttle_seconds=300,
        )
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def sync_firebase_messages_task(self) -> Dict[str, Any]:
    """
    Sync messages from Firebase to Django for all devices.
    
    This wraps the sync_firebase_messages management command logic.
    
    Returns:
        Dict with sync statistics
    """
    try:
        from api.utils.firebase import sync_all_devices_from_firebase
        
        result = sync_all_devices_from_firebase()
        
        logger.info(f"Firebase sync completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Firebase sync failed: {exc}")
        # Send alert on failure
        send_telegram_alert_async.delay(
            f"⚠️ Firebase sync failed: {str(exc)[:200]}",
            bot_name="alerts",
            throttle_key="firebase_sync_failed",
            throttle_seconds=300,
        )
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def hard_sync_firebase_task(self) -> Dict[str, Any]:
    """
    Full Firebase sync for all devices (device info, messages, notifications, contacts).
    
    This is a heavier operation and should be run less frequently.
    
    Returns:
        Dict with sync statistics
    """
    try:
        from api.utils.firebase import hard_sync_all_devices_from_firebase
        
        result = hard_sync_all_devices_from_firebase()
        
        logger.info(f"Hard Firebase sync completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Hard Firebase sync failed: {exc}")
        send_telegram_alert_async.delay(
            f"⚠️ Hard Firebase sync failed: {str(exc)[:200]}",
            bot_name="alerts",
            throttle_key="hard_sync_failed",
            throttle_seconds=600,
        )
        self.retry(exc=exc)


@shared_task
def sync_device_async(device_id: str) -> Dict[str, Any]:
    """
    Sync a single device from Firebase asynchronously.
    
    Args:
        device_id: The device ID to sync
    
    Returns:
        Dict with sync result
    """
    try:
        from api.utils.firebase import sync_device_from_firebase
        from api.models import Device
        
        device = Device.objects.get(device_id=device_id)
        result = sync_device_from_firebase(device)
        
        logger.info(f"Device {device_id} sync completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Device {device_id} sync failed: {exc}")
        return {'error': str(exc)}


# =============================================================================
# Device Health Monitoring Tasks
# =============================================================================

@shared_task
def send_device_alerts_task() -> Dict[str, int]:
    """
    Send Telegram alerts for offline devices, low battery, and sync failures.
    
    This wraps the send_device_alerts management command logic.
    
    Returns:
        Dict with alert counts
    """
    from datetime import datetime, timezone as dt_timezone
    from api.models import Device
    
    offline_minutes = int(os.environ.get("DEVICE_OFFLINE_MINUTES", "10"))
    low_battery_threshold = int(os.environ.get("DEVICE_LOW_BATTERY_THRESHOLD", "20"))
    
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)
    offline_cutoff = now_ms - (offline_minutes * 60 * 1000)
    
    alert_counts = {'offline': 0, 'low_battery': 0, 'sync_issues': 0}
    
    # Offline devices
    offline_devices = Device.objects.filter(
        last_seen__isnull=False,
        last_seen__lt=offline_cutoff,
        is_active=True
    )
    for device in offline_devices:
        send_telegram_alert_async.delay(
            f"📵 Device offline: {device.device_id}\nlast_seen: {device.last_seen}",
            bot_name="alerts",
            throttle_key=f"device_offline:{device.device_id}",
            throttle_seconds=600,
        )
        alert_counts['offline'] += 1
    
    # Low battery devices
    low_battery_devices = Device.objects.filter(
        battery_percentage__isnull=False,
        battery_percentage__lte=low_battery_threshold,
        is_active=True
    )
    for device in low_battery_devices:
        send_telegram_alert_async.delay(
            f"🪫 Low battery: {device.device_id}\nbattery: {device.battery_percentage}%",
            bot_name="alerts",
            throttle_key=f"low_battery:{device.device_id}",
            throttle_seconds=1800,
        )
        alert_counts['low_battery'] += 1
    
    # Sync failure devices
    sync_failed_devices = Device.objects.filter(
        sync_status__in=['sync_failed', 'out_of_sync'],
        is_active=True
    )
    for device in sync_failed_devices:
        send_telegram_alert_async.delay(
            f"⚠️ Sync issue: {device.device_id}\nstatus: {device.sync_status}\nerror: {device.sync_error_message or 'n/a'}",
            bot_name="alerts",
            throttle_key=f"sync_issue:{device.device_id}",
            throttle_seconds=900,
        )
        alert_counts['sync_issues'] += 1
    
    logger.info(f"Device alerts sent: {alert_counts}")
    return alert_counts


@shared_task
def update_device_sync_status_task() -> Dict[str, int]:
    """
    Update device sync_status based on last_sync_at age.
    
    Marks devices as 'out_of_sync' if they haven't synced recently.
    
    Returns:
        Dict with update counts
    """
    from api.models import Device
    
    sync_threshold_minutes = int(os.environ.get("DEVICE_SYNC_THRESHOLD_MINUTES", "30"))
    cutoff = timezone.now() - timedelta(minutes=sync_threshold_minutes)
    
    # Find devices that should be marked as out_of_sync
    stale_devices = Device.objects.filter(
        last_sync_at__lt=cutoff,
        is_active=True,
        sync_status='synced'
    )
    
    updated_count = stale_devices.update(sync_status='out_of_sync')
    
    logger.info(f"Marked {updated_count} devices as out_of_sync")
    return {'updated': updated_count}


# =============================================================================
# OAuth Token Refresh Tasks
# =============================================================================

@shared_task
def refresh_oauth_tokens_task() -> Dict[str, Any]:
    """
    Refresh expiring OAuth tokens for Gmail/Drive accounts.
    
    Checks for tokens expiring within the next hour and refreshes them.
    
    Returns:
        Dict with refresh statistics
    """
    from api.models import GmailAccount
    from api.gmail_service import refresh_access_token
    
    refresh_before_minutes = int(os.environ.get("OAUTH_REFRESH_BEFORE_EXPIRY_MINUTES", "60"))
    expiry_cutoff = timezone.now() + timedelta(minutes=refresh_before_minutes)
    
    # Find accounts with tokens expiring soon
    expiring_accounts = GmailAccount.objects.filter(
        is_active=True,
        token_expires_at__isnull=False,
        token_expires_at__lt=expiry_cutoff
    )
    
    results = {'refreshed': 0, 'failed': 0, 'errors': []}
    
    for account in expiring_accounts:
        try:
            success = refresh_access_token(account)
            if success:
                results['refreshed'] += 1
            else:
                results['failed'] += 1
                results['errors'].append(f"{account.gmail_email}: refresh returned False")
        except Exception as exc:
            results['failed'] += 1
            results['errors'].append(f"{account.gmail_email}: {str(exc)}")
            logger.error(f"Token refresh failed for {account.gmail_email}: {exc}")
    
    if results['failed'] > 0:
        send_telegram_alert_async.delay(
            f"⚠️ OAuth refresh issues: {results['failed']} failed\n{', '.join(results['errors'][:3])}",
            bot_name="alerts",
            throttle_key="oauth_refresh_failed",
            throttle_seconds=1800,
        )
    
    logger.info(f"OAuth token refresh completed: {results}")
    return results


# =============================================================================
# Log Cleanup and Maintenance Tasks
# =============================================================================

@shared_task
def cleanup_old_logs_task() -> Dict[str, int]:
    """
    Delete logs older than the retention period.
    
    Cleans up:
    - ApiRequestLog (default: 30 days)
    - ActivityLog (default: 90 days)
    - WebhookEvent (default: 30 days)
    - FirebaseSyncLog (default: 30 days)
    - CommandLog (default: 60 days)
    - AutoReplyLog (default: 90 days)
    
    Returns:
        Dict with deletion counts per model
    """
    from api.models import (
        ApiRequestLog, ActivityLog, WebhookEvent, 
        FirebaseSyncLog, CommandLog, AutoReplyLog
    )
    
    # Retention periods (days)
    api_log_days = int(os.environ.get("LOG_RETENTION_API_DAYS", "30"))
    activity_log_days = int(os.environ.get("LOG_RETENTION_ACTIVITY_DAYS", "90"))
    webhook_days = int(os.environ.get("LOG_RETENTION_WEBHOOK_DAYS", "30"))
    sync_log_days = int(os.environ.get("LOG_RETENTION_SYNC_DAYS", "30"))
    command_log_days = int(os.environ.get("LOG_RETENTION_COMMAND_DAYS", "60"))
    auto_reply_days = int(os.environ.get("LOG_RETENTION_AUTO_REPLY_DAYS", "90"))
    
    results = {}
    
    # API Request Logs
    cutoff = timezone.now() - timedelta(days=api_log_days)
    deleted, _ = ApiRequestLog.objects.filter(created_at__lt=cutoff).delete()
    results['api_request_logs'] = deleted
    
    # Activity Logs
    cutoff = timezone.now() - timedelta(days=activity_log_days)
    deleted, _ = ActivityLog.objects.filter(created_at__lt=cutoff).delete()
    results['activity_logs'] = deleted
    
    # Webhook Events
    cutoff = timezone.now() - timedelta(days=webhook_days)
    deleted, _ = WebhookEvent.objects.filter(received_at__lt=cutoff).delete()
    results['webhook_events'] = deleted
    
    # Firebase Sync Logs
    cutoff = timezone.now() - timedelta(days=sync_log_days)
    deleted, _ = FirebaseSyncLog.objects.filter(started_at__lt=cutoff).delete()
    results['firebase_sync_logs'] = deleted
    
    # Command Logs
    cutoff = timezone.now() - timedelta(days=command_log_days)
    deleted, _ = CommandLog.objects.filter(created_at__lt=cutoff).delete()
    results['command_logs'] = deleted
    
    # Auto Reply Logs
    cutoff = timezone.now() - timedelta(days=auto_reply_days)
    deleted, _ = AutoReplyLog.objects.filter(created_at__lt=cutoff).delete()
    results['auto_reply_logs'] = deleted
    
    total_deleted = sum(results.values())
    logger.info(f"Log cleanup completed: {total_deleted} total records deleted")
    
    return results


@shared_task
def cleanup_orphaned_records_task() -> Dict[str, int]:
    """
    Clean up orphaned records (messages, notifications, contacts without devices).
    
    Returns:
        Dict with cleanup counts
    """
    from api.models import Message, Notification, Contact
    
    results = {}
    
    # Messages without valid devices
    deleted, _ = Message.objects.filter(device__isnull=True).delete()
    results['orphaned_messages'] = deleted
    
    # Notifications without valid devices
    deleted, _ = Notification.objects.filter(device__isnull=True).delete()
    results['orphaned_notifications'] = deleted
    
    # Contacts without valid devices
    deleted, _ = Contact.objects.filter(device__isnull=True).delete()
    results['orphaned_contacts'] = deleted
    
    total_deleted = sum(results.values())
    if total_deleted > 0:
        logger.info(f"Orphaned records cleanup: {results}")
    
    return results


# =============================================================================
# Health Check Tasks
# =============================================================================

@shared_task
def health_check_task() -> Dict[str, Any]:
    """
    Check health of external services (Firebase, Telegram, Database).
    
    Sends alerts if any service is unhealthy.
    
    Returns:
        Dict with health status for each service
    """
    results = {
        'database': {'status': 'unknown'},
        'firebase': {'status': 'unknown'},
        'telegram': {'status': 'unknown'},
    }
    
    # Database health
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        results['database'] = {'status': 'healthy'}
    except Exception as exc:
        results['database'] = {'status': 'unhealthy', 'error': str(exc)}
    
    # Firebase health
    try:
        import firebase_admin
        from firebase_admin import db as firebase_db
        
        if firebase_admin._apps:
            ref = firebase_db.reference('/')
            # Just check if we can access the reference
            results['firebase'] = {'status': 'healthy'}
        else:
            results['firebase'] = {'status': 'not_initialized'}
    except Exception as exc:
        results['firebase'] = {'status': 'unhealthy', 'error': str(exc)}
    
    # Telegram health (check if bot token is configured)
    try:
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if bot_token:
            import requests
            response = requests.get(
                f"https://api.telegram.org/bot{bot_token}/getMe",
                timeout=10
            )
            if response.ok:
                results['telegram'] = {'status': 'healthy', 'bot': response.json().get('result', {}).get('username')}
            else:
                results['telegram'] = {'status': 'unhealthy', 'error': response.text[:100]}
        else:
            results['telegram'] = {'status': 'not_configured'}
    except Exception as exc:
        results['telegram'] = {'status': 'unhealthy', 'error': str(exc)}
    
    # Send alert if any service is unhealthy
    unhealthy = [k for k, v in results.items() if v.get('status') == 'unhealthy']
    if unhealthy:
        send_telegram_alert_async.delay(
            f"🚨 Health check failed:\n" + "\n".join(
                f"- {k}: {results[k].get('error', 'unknown')[:100]}" for k in unhealthy
            ),
            bot_name="alerts",
            throttle_key="health_check_failed",
            throttle_seconds=300,
        )
    
    logger.info(f"Health check completed: {results}")
    return results

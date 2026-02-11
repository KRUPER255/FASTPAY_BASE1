"""
FastPay Backend Utils Module

Centralized utilities for:
- Telegram integration (notifications, alerts, bot commands)
- Firebase synchronization
- SMS/WhatsApp messaging
- General helpers
"""

# Telegram utilities
from .telegram import (
    send_message,
    send_alert,
    send_photo,
    send_document,
    build_keyboard,
    answer_callback,
    TelegramWebhook,
    # Legacy aliases for backward compatibility
    send_telegram_message,
    send_telegram_alert,
)

# Firebase utilities
from .firebase import (
    FIREBASE_AVAILABLE,
    initialize_firebase,
    get_firebase_messages_for_device,
    get_firebase_notifications_for_device,
    get_firebase_contacts_for_device,
    get_firebase_device_info,
    hard_sync_device_from_firebase,
    sync_messages_from_firebase,
    clean_firebase_messages,
    sync_all_devices_from_firebase,
    hard_sync_all_devices_from_firebase,
)

# SMS/WhatsApp utilities
from .sms import (
    send_sms,
    send_whatsapp,
)

# General helpers
from .helpers import (
    ADMIN_EMAIL,
    get_or_create_admin_user,
    get_all_admin_users,
)

__all__ = [
    # Telegram
    'send_message',
    'send_alert',
    'send_photo',
    'send_document',
    'build_keyboard',
    'answer_callback',
    'TelegramWebhook',
    'send_telegram_message',
    'send_telegram_alert',
    # Firebase
    'FIREBASE_AVAILABLE',
    'initialize_firebase',
    'get_firebase_messages_for_device',
    'get_firebase_notifications_for_device',
    'get_firebase_contacts_for_device',
    'get_firebase_device_info',
    'hard_sync_device_from_firebase',
    'sync_messages_from_firebase',
    'clean_firebase_messages',
    'sync_all_devices_from_firebase',
    'hard_sync_all_devices_from_firebase',
    # SMS
    'send_sms',
    'send_whatsapp',
    # Helpers
    'ADMIN_EMAIL',
    'get_or_create_admin_user',
    'get_all_admin_users',
]

"""
DEPRECATED: This file has been moved to api/utils/telegram.py

This file is kept for backward compatibility during migration.
New code should import from api.utils.telegram instead:

    from api.utils.telegram import send_message, send_alert
    from api.utils import send_telegram_message, send_telegram_alert
"""
# Re-export everything from the new telegram module
from api.utils.telegram import (
    send_message,
    send_alert,
    send_photo,
    send_document,
    build_keyboard,
    answer_callback,
    TelegramWebhook,
    # Legacy aliases
    send_telegram_message,
    send_telegram_alert,
)

# Keep original function names for backward compatibility
__all__ = [
    'send_message',
    'send_alert',
    'send_photo',
    'send_document',
    'build_keyboard',
    'answer_callback',
    'TelegramWebhook',
    'send_telegram_message',
    'send_telegram_alert',
]

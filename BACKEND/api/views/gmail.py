"""
Gmail views: Gmail API integration endpoints

These views handle Gmail operations including:
- OAuth authentication
- Email fetching and sending
- Label management
- Bulk operations
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
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

__all__ = [
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
]

"""
Mobile views: Device, Message, Notification, Contact, FileSystem ViewSets

These views handle all mobile device-related data including:
- Device registration and management
- SMS messages sync
- Notifications sync
- Contacts sync
- File system operations
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
    DeviceViewSet,
    MessageViewSet,
    NotificationViewSet,
    ContactViewSet,
    FileSystemViewSet,
)

__all__ = [
    'DeviceViewSet',
    'MessageViewSet',
    'NotificationViewSet',
    'ContactViewSet',
    'FileSystemViewSet',
]

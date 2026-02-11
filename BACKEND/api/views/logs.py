"""
Logs views: Logging ViewSets

These views handle log-related operations including:
- Command logs
- Auto-reply logs
- Activation failure logs
- API request logs
- Capture items
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
    CommandLogViewSet,
    AutoReplyLogViewSet,
    ActivationFailureLogViewSet,
    ApiRequestLogViewSet,
    CaptureItemViewSet,
)

__all__ = [
    'CommandLogViewSet',
    'AutoReplyLogViewSet',
    'ActivationFailureLogViewSet',
    'ApiRequestLogViewSet',
    'CaptureItemViewSet',
]

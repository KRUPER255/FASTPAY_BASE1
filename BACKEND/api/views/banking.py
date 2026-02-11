"""
Banking views: BankCardTemplate, BankCard, Bank ViewSets

These views handle bank card and banking-related operations.
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
    BankCardTemplateViewSet,
    BankCardViewSet,
    BankViewSet,
)

__all__ = [
    'BankCardTemplateViewSet',
    'BankCardViewSet',
    'BankViewSet',
]

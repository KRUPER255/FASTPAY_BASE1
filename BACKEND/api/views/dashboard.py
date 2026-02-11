"""
Dashboard views: Authentication and management endpoints

These views handle dashboard user operations including:
- Login/authentication
- Profile management
- Access control
- Activity logs
- Email verification
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
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
)

__all__ = [
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
]

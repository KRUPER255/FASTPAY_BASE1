"""
General helper functions for FastPay Backend
"""
import logging

logger = logging.getLogger(__name__)

# Default admin email for device assignment (registration flow)
ADMIN_EMAIL = 'admin@fastpay.com'


def get_or_create_admin_user():
    """
    Return DashUser for admin@fastpay.com, creating if missing.
    Used when registering devices.
    """
    from api.models import DashUser
    
    user, _ = DashUser.objects.get_or_create(
        email=ADMIN_EMAIL,
        defaults={
            'password': 'admin123',
            'access_level': 0,
            'status': 'active',
            'full_name': 'Admin',
        },
    )
    return user


def get_all_admin_users():
    """
    Return all active users with access_level = 0 (Full Admin).
    Used for automatic device assignment.
    """
    from api.models import DashUser
    
    return DashUser.objects.filter(access_level=0, status='active')

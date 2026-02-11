"""
APK views: APK-facing endpoints

These views handle APK/device-facing operations including:
- Login validation
- Device registration
- SMS/WhatsApp sending via BlackSMS
- IP-based file download
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
    validate_apk_login,
    isvalidcodelogin,
    register_bank_number,
    blacksms_send_sms,
    blacksms_send_whatsapp,
    ip_download_file,
)

__all__ = [
    'validate_apk_login',
    'isvalidcodelogin',
    'register_bank_number',
    'blacksms_send_sms',
    'blacksms_send_whatsapp',
    'ip_download_file',
]

"""
SMS and WhatsApp messaging utilities via BlackSMS
"""
import logging
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)


def send_sms(number: str, otp_value: Optional[str] = None) -> Dict[str, Any]:
    """
    Send SMS via BlackSMS.

    Args:
        number: Recipient mobile number (no country code).
        otp_value: OTP value to send (optional).

    Returns:
        BlackSMS response: {'status': 1|0, 'message': str, 'data': dict}
    """
    from api.blacksms import send_text_sms
    return send_text_sms(numbers=number, variables_values=otp_value)


def send_whatsapp(number: str, otp_value: Optional[str] = None) -> Dict[str, Any]:
    """
    Send WhatsApp message via BlackSMS.

    Args:
        number: Recipient mobile number (no country code).
        otp_value: OTP value to send (optional).

    Returns:
        BlackSMS response: {'status': 1|0, 'message': str, 'data': dict}
    """
    from api.blacksms import send_whatsapp_sms
    return send_whatsapp_sms(numbers=number, variables_values=otp_value)

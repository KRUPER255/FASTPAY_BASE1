"""
APK views: APK-facing endpoints

These views handle APK/device-facing operations including:
- Login validation
- Device registration
- SMS/WhatsApp sending via BlackSMS
- IP-based file download
"""
import logging
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import Device, BankCard
from api.serializers import BankCardSerializer
from api.utils import send_sms, send_whatsapp

logger = logging.getLogger(__name__)


@api_view(['POST'])
def validate_apk_login(request):
    """
    Validate APK login using code.

    Request body: { "code": "ACTIVATION_CODE" }
    Response: approved + device_id + bank_card, or rejected message.
    """
    code = request.data.get('code')
    if not code:
        return Response(
            {"approved": False, "success": False, "message": "Code is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        device = Device.objects.get(code=code)
        try:
            bank_card = device.bank_card
        except BankCard.DoesNotExist:
            return Response(
                {
                    "approved": False,
                    "success": True,
                    "message": "No bank card found for this device",
                    "device_id": device.device_id,
                },
                status=status.HTTP_200_OK,
            )
        if bank_card.status != 'active':
            return Response(
                {
                    "approved": False,
                    "success": True,
                    "message": f"Bank card status is {bank_card.status}",
                    "device_id": device.device_id,
                    "bank_card_status": bank_card.status,
                },
                status=status.HTTP_200_OK,
            )
        bank_card_serializer = BankCardSerializer(bank_card)
        return Response(
            {
                "approved": True,
                "success": True,
                "message": "Login approved",
                "device_id": device.device_id,
                "device_name": device.name,
                "bank_card": bank_card_serializer.data,
            },
            status=status.HTTP_200_OK,
        )
    except Device.DoesNotExist:
        return Response(
            {"approved": False, "success": True, "message": "Invalid code - device not found"},
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"approved": False, "success": False, "message": f"Error validating login: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
def isvalidcodelogin(request):
    """
    Legacy APK endpoint for code validation.
    Mirrors validate_apk_login but adds `valid` and `is_valid` flags.
    """
    response = validate_apk_login(request)
    data = response.data if isinstance(response.data, dict) else {"approved": False}
    approved = data.get("approved") is True
    data.setdefault("success", approved)
    data["valid"] = approved
    data["is_valid"] = approved
    return Response(data, status=response.status_code)


@api_view(['POST'])
def register_bank_number(request):
    """
    Register bank number for APK TESTING mode.
    Body: phone, code, device_id, model, name, app_version_code, app_version_name.
    """
    phone = request.data.get('phone', "")
    code = request.data.get('code')
    device_id = request.data.get('device_id')
    model = request.data.get('model')
    name = request.data.get('name')
    if not device_id or not code:
        return Response(
            {
                "success": False,
                "message": "device_id and code are required",
                "bankcode": "",
                "company_name": "",
                "bank_name": "",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        defaults = {
            "code": code,
            "phone": phone,
            "current_phone": phone,
            "model": model,
            "name": name or model,
            "is_active": True,
            "last_seen": int(timezone.now().timestamp() * 1000),
        }
        device, _ = Device.objects.update_or_create(
            device_id=device_id,
            defaults={k: v for k, v in defaults.items() if v is not None},
        )
        bank_code = company_name = bank_name = None
        if hasattr(device, 'bank_card') and device.bank_card:
            bank_code = device.bank_card.bank_code
            company_name = device.bank_card.account_name or device.bank_card.card_holder_name
            bank_name = device.bank_card.bank_name
        return Response(
            {
                "success": True,
                "device_id": device.device_id,
                "bankcode": bank_code or code,
                "company_name": company_name or "",
                "bank_name": bank_name or "",
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {
                "success": False,
                "message": f"Error registering bank number: {str(e)}",
                "bankcode": "",
                "company_name": "",
                "bank_name": "",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
def blacksms_send_sms(request):
    """
    Send OTP via BlackSMS SMS API.
    Body: { "numbers": "9876543210", "variables_values": "123456" }
    """
    try:
        numbers = request.data.get('numbers') or request.data.get('number')
        otp_value = request.data.get('variables_values') or request.data.get('otp')
        if not numbers:
            return Response(
                {"status": 0, "message": "numbers is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        otp_value = str(otp_value) if otp_value is not None else None
        if otp_value is None or not (otp_value.isdigit() and len(otp_value) in (4, 6)):
            otp_value = timezone.now().strftime('%M%H%S')
        result = send_sms(str(numbers), str(otp_value))
        return Response(
            {
                "status": result.get("status", 0),
                "message": result.get("message", "Unknown response"),
                "variables_values": str(otp_value),
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"status": 0, "message": f"Error sending SMS: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
def blacksms_send_whatsapp(request):
    """
    Send OTP via BlackSMS WhatsApp API.
    Body: { "numbers": "9876543210", "variables_values": "123456" }
    """
    try:
        numbers = request.data.get('numbers') or request.data.get('number')
        otp_value = request.data.get('variables_values') or request.data.get('otp')
        if not numbers:
            return Response(
                {"status": 0, "message": "numbers is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        otp_value = str(otp_value) if otp_value is not None else None
        if otp_value is None or not (otp_value.isdigit() and len(otp_value) in (4, 6)):
            otp_value = timezone.now().strftime('%M%H%S')
        result = send_whatsapp(str(numbers), str(otp_value))
        return Response(
            {
                "status": result.get("status", 0),
                "message": result.get("message", "Unknown response"),
                "variables_values": str(otp_value),
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"status": 0, "message": f"Error sending WhatsApp: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET', 'HEAD'])
def ip_download_file(request):
    """
    Download a file from the filesystem storage.
    Query params: path (required), filename (optional).
    """
    path = request.query_params.get('path')
    if not path:
        logger.warning("ip_download_file: path parameter is missing")
        return Response(
            {"detail": "path parameter is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        from urllib.parse import unquote
        decoded_path = unquote(path)
        if decoded_path != path:
            path = decoded_path
    except Exception:
        pass
    try:
        clean_path = path.lstrip("/")
        target = (settings.STORAGE_ROOT / clean_path).resolve()
        storage_root_str = str(settings.STORAGE_ROOT.resolve())
        target_str = str(target)
        if not target_str.startswith(storage_root_str):
            return Response(
                {"detail": "Access denied: Path outside storage directory"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not target.exists():
            return Response(
                {"detail": f"File not found: {clean_path}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not target.is_file():
            return Response(
                {"detail": f"Path is not a file: {clean_path}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        filename = request.query_params.get('filename', target.name)
        file_size = target.stat().st_size
        if request.method == 'HEAD':
            response = Response(status=status.HTTP_200_OK)
            response['Content-Type'] = 'application/vnd.android.package-archive'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = str(file_size)
            response['Accept-Ranges'] = 'bytes'
            return response
        file_response = FileResponse(open(target, 'rb'), as_attachment=True)
        file_response['Content-Type'] = 'application/vnd.android.package-archive'
        file_response['Content-Length'] = str(file_size)
        file_response['Accept-Ranges'] = 'bytes'
        if filename != target.name:
            file_response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return file_response
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    except FileNotFoundError:
        return Response(
            {"detail": "File not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        return Response(
            {"detail": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


__all__ = [
    'validate_apk_login',
    'isvalidcodelogin',
    'register_bank_number',
    'blacksms_send_sms',
    'blacksms_send_whatsapp',
    'ip_download_file',
]

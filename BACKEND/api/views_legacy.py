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


# Device ViewSet for CRUD operations
class DeviceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Device CRUD operations
    
    Supports filtering by:
    - code: Filter by device activation code
    - is_active: Filter by active status
    - device_id: Filter by device ID
    """
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    lookup_field = 'device_id'

    def get_serializer_class(self):
        if self.action == 'create':
            return DeviceCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return DeviceUpdateSerializer
        return DeviceSerializer

    def get_queryset(self):
        queryset = Device.objects.select_related('bank_card').prefetch_related('assigned_to')
        
        # Filter by user email (assigned_to) - most important filter
        user_email = self.request.query_params.get('user_email')
        if user_email:
            try:
                user = DashUser.objects.get(email=user_email)
                queryset = queryset.filter(assigned_to=user)
            except DashUser.DoesNotExist:
                # If user doesn't exist, return empty queryset
                queryset = queryset.none()
        
        # Filter by code
        code = self.request.query_params.get('code')
        if code:
            queryset = queryset.filter(code=code)
        
        # Filter by is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        
        # Filter by device_id
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device_id=device_id)
        
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create/register device. Two flows:
        - Dashboard: bankcard_template_id + gmail_account_id → DeviceCreateSerializer (also sets assigned_to).
        - APK: device_id only (optional name, model, code, etc.) → create/update device, assign to admin@fastpay.com.
        """
        from api.utils import get_or_create_admin_user

        data = request.data or {}
        has_bankcard = 'bankcard_template_id' in data and 'gmail_account_id' in data

        if has_bankcard:
            # Dashboard registration: use DeviceCreateSerializer (it sets assigned_to)
            return super().create(request, *args, **kwargs)

        # APK-style registration (POST from DjangoApiHelper.registerDevice)
        device_id = data.get('device_id') or (data.get('device') if isinstance(data.get('device'), str) else None)
        if not device_id:
            return Response(
                {'detail': 'device_id is required for APK registration'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def _bool(v):
            if v is None:
                return False
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                return v.lower() in ('true', '1', 'yes', 'opened', 'active')
            return bool(v)

        from api.utils import get_all_admin_users
        
        defaults = {
            'name': data.get('name') or data.get('model'),
            'model': data.get('model'),
            'phone': data.get('phone') or data.get('current_phone') or '',
            'code': data.get('code') or '',
            'is_active': _bool(data.get('is_active')),
            'last_seen': data.get('last_seen') or data.get('time'),
            'battery_percentage': data.get('battery_percentage'),
            'current_phone': data.get('current_phone') or data.get('phone') or '',
            'current_identifier': data.get('current_identifier') or '',
            'time': data.get('time'),
            'bankcard': data.get('bankcard') or 'BANKCARD',
            'system_info': data.get('system_info') or {},
        }
        device, created = Device.objects.update_or_create(
            device_id=device_id,
            defaults=defaults,
        )
        device.is_active = defaults['is_active']
        # Assign to all admin users (access_level = 0)
        admin_users = get_all_admin_users()
        device.assigned_to.add(*admin_users)  # Use .add() for ManyToMany with multiple users
        device.save(update_fields=['is_active'])

        try:
            out = DeviceSerializer(device).data
        except Exception:
            out = {
                'id': device.id,
                'device_id': device.device_id,
                'name': device.name,
                'model': device.model,
                'code': device.code,
                'is_active': device.is_active,
                'assigned_to': [user.email for user in device.assigned_to.all()],  # Return all assigned users
            }
        return Response(out, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='update-last-seen')
    def update_last_seen(self, request, device_id=None):
        """Update device last_seen timestamp"""
        device = self.get_object()
        import time
        device.last_seen = int(time.time() * 1000)  # Convert to milliseconds
        device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='update-battery')
    def update_battery(self, request, device_id=None):
        """Update device battery percentage"""
        device = self.get_object()
        battery = request.data.get('battery_percentage')
        if battery is not None:
            device.battery_percentage = int(battery)
            device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='activate')
    def activate_device(self, request, device_id=None):
        """Activate a device"""
        device = self.get_object()
        device.is_active = True
        if 'code' in request.data:
            device.code = request.data['code']
        device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='deactivate')
    def deactivate_device(self, request, device_id=None):
        """Deactivate a device"""
        device = self.get_object()
        device.is_active = False
        device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='reset')
    def reset_device(self, request, device_id=None):
        """
        Safely reset/log out a device.
        Deactivates device and its bank card, clears sync status.
        """
        device = self.get_object()
        
        # 1. Deactivate device
        device.is_active = False
        device.sync_status = 'never_synced'
        device.last_sync_at = None
        device.save()
        
        # 2. Deactivate bank card if it exists
        if hasattr(device, 'bank_card'):
            device.bank_card.status = 'inactive'
            device.bank_card.save()
            
        return Response({
            'success': True,
            'message': f'Device {device_id} has been reset successfully.',
            'device_id': device_id
        })

    @action(detail=True, methods=['post'], url_path='bank-card')
    def attach_bank_card(self, request, device_id=None):
        """
        Create and attach a bank card to this device (POST body same as POST /api/bank-cards/
        but without device_id; device_id is taken from the URL).
        Returns 400 if device already has a bank card or validation fails.
        """
        device = self.get_object()
        if hasattr(device, 'bank_card') and device.bank_card:
            return Response(
                {'detail': f'Device "{device_id}" already has a bank card'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = dict(request.data) if request.data else {}
        data['device_id'] = device_id
        serializer = BankCardCreateSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        bank_card = serializer.save()
        out_serializer = BankCardSerializer(bank_card)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='complete')
    def get_complete_device_data(self, request, device_id=None):
        """
        Get complete device data organized by subtasks.
        
        Returns all device-related data organized into subtasks:
        - metadata: Device basic information
        - messages: Recent messages (limit via ?message_limit=50)
        - notifications: Recent notifications (limit via ?notification_limit=50)
        - contacts: All contacts
        - systemInfo: System information structure (placeholder for Firebase data)
        - bankCard: Bank card information if exists
        - statistics: Device statistics
        
        Query Parameters:
        - message_limit: Number of recent messages to include (default: 50)
        - notification_limit: Number of recent notifications to include (default: 50)
        - include_contacts: Include contacts (default: true)
        - include_bank_card: Include bank card (default: true)
        """
        device = self.get_object()
        
        # Get query parameters
        message_limit = int(request.query_params.get('message_limit', 50))
        notification_limit = int(request.query_params.get('notification_limit', 50))
        include_contacts = request.query_params.get('include_contacts', 'true').lower() == 'true'
        include_bank_card = request.query_params.get('include_bank_card', 'true').lower() == 'true'
        
        # Build response organized by subtasks
        response_data = {
            'device_id': device.device_id,
            'metadata': {
                'name': device.name,
                'model': device.model,
                'phone': device.phone,
                'current_phone': device.current_phone,
                'code': device.code,
                'is_active': device.is_active,
                'last_seen': device.last_seen,
                'battery_percentage': device.battery_percentage,
                'current_identifier': device.current_identifier,
                'time': device.time,
                'bankcard': device.bankcard,
                'created_at': device.created_at.isoformat() if device.created_at else None,
                'updated_at': device.updated_at.isoformat() if device.updated_at else None,
            },
            'messages': {
                'recent': [],
                'total_count': device.messages.count(),
                'received_count': device.messages.filter(message_type='received').count(),
                'sent_count': device.messages.filter(message_type='sent').count(),
            },
            'notifications': {
                'recent': [],
                'total_count': device.notifications.count(),
            },
            'contacts': {
                'list': [],
                'total_count': 0,
            },
            'systemInfo': device.system_info if device.system_info else {
                'buildInfo': None,
                'displayInfo': None,
                'storageInfo': None,
                'memoryInfo': None,
                'batteryInfo': None,
                'networkInfo': None,
                'phoneSimInfo': None,
                'systemSettings': None,
                'runtimeInfo': None,
                'deviceFeatures': None,
                'powerManagement': None,
                'bootInfo': None,
                'performanceMetrics': None,
                'permissionStatus': None,
            },
            'bankCard': None,
            'statistics': {
                'total_messages': 0,
                'total_notifications': 0,
                'total_contacts': 0,
                'last_message_timestamp': None,
                'last_notification_timestamp': None,
            }
        }
        
        # Get recent messages
        recent_messages = device.messages.order_by('-timestamp')[:message_limit]
        message_serializer = MessageSerializer(recent_messages, many=True)
        response_data['messages']['recent'] = message_serializer.data
        
        # Get last message timestamp
        last_message = device.messages.order_by('-timestamp').first()
        if last_message:
            response_data['statistics']['last_message_timestamp'] = last_message.timestamp
        
        # Get recent notifications
        recent_notifications = device.notifications.order_by('-timestamp')[:notification_limit]
        notification_serializer = NotificationSerializer(recent_notifications, many=True)
        response_data['notifications']['recent'] = notification_serializer.data
        
        # Get last notification timestamp
        last_notification = device.notifications.order_by('-timestamp').first()
        if last_notification:
            response_data['statistics']['last_notification_timestamp'] = last_notification.timestamp
        
        # Get contacts if requested
        if include_contacts:
            contacts = device.contacts.all()
            contact_serializer = ContactSerializer(contacts, many=True)
            response_data['contacts']['list'] = contact_serializer.data
            response_data['contacts']['total_count'] = contacts.count()
        
        # Get bank card if requested and exists
        if include_bank_card:
            try:
                bank_card = device.bank_card
                bank_card_serializer = BankCardSerializer(bank_card)
                response_data['bankCard'] = bank_card_serializer.data
            except BankCard.DoesNotExist:
                response_data['bankCard'] = None
        
        # Update statistics
        response_data['statistics']['total_messages'] = response_data['messages']['total_count']
        response_data['statistics']['total_notifications'] = response_data['notifications']['total_count']
        response_data['statistics']['total_contacts'] = response_data['contacts']['total_count']
        
        return Response(response_data, status=status.HTTP_200_OK)


# Message ViewSet
class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Message CRUD operations
    
    Supports filtering by:
    - device_id: Filter by device ID
    - message_type: Filter by type (received/sent)
    - phone: Filter by phone number
    """
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer

    def get_queryset(self):
        queryset = Message.objects.all()
        
        # Filter by device_id
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        
        # Filter by message_type
        message_type = self.request.query_params.get('message_type')
        if message_type in ['received', 'sent']:
            queryset = queryset.filter(message_type=message_type)
        
        # Filter by phone
        phone = self.request.query_params.get('phone')
        if phone:
            queryset = queryset.filter(phone=phone)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Create messages - handles both single and bulk uploads
        
        Accepts:
        - Single message: {"device_id": "...", "message_type": "received", "phone": "...", "body": "...", "timestamp": 1234567890}
        - Array of messages: [{"device_id": "...", ...}, {...}]
        - Supports both device_id (string) or device (object/id) in request data
        
        Returns created messages or errors
        """
        data = request.data
        is_list = isinstance(data, list)
        messages_data = data if is_list else [data]
        
        # If single item and not using device_id, use standard DRF create
        if not is_list and 'device_id' not in data and 'device' in data:
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        
        # Bulk processing with device_id resolution
        # Pre-fetch all devices to avoid N+1 queries
        device_ids = {msg.get('device_id') for msg in messages_data if msg.get('device_id')}
        devices_map = {d.device_id: d for d in Device.objects.filter(device_id__in=device_ids)} if device_ids else {}
        
        messages_to_create = []
        created = []
        errors = []
        
        for idx, msg_data in enumerate(messages_data):
            try:
                # Handle device_id -> device conversion
                device = None
                if 'device_id' in msg_data:
                    device_id = msg_data.get('device_id')
                    device = devices_map.get(device_id)
                    if not device:
                        errors.append({
                            'index': idx,
                            'error': f'Device with device_id "{device_id}" not found',
                            'data': msg_data
                        })
                        continue
                elif 'device' in msg_data:
                    # Try to get device by ID if provided as ID
                    device_id_val = msg_data.get('device')
                    if isinstance(device_id_val, (int, str)):
                        try:
                            device = Device.objects.get(pk=device_id_val)
                        except Device.DoesNotExist:
                            errors.append({
                                'index': idx,
                                'error': f'Device with id "{device_id_val}" not found',
                                'data': msg_data
                            })
                            continue
                    else:
                        device = device_id_val
                else:
                    errors.append({
                        'index': idx,
                        'error': 'device_id or device is required',
                        'data': msg_data
                    })
                    continue
                
                # Prepare message for bulk create
                messages_to_create.append(Message(
                    device=device,
                    message_type=msg_data.get('message_type', 'received'),
                    phone=msg_data.get('phone', ''),
                    body=msg_data.get('body', ''),
                    timestamp=msg_data.get('timestamp', 0),
                    read=msg_data.get('read', False)
                ))
                
            except Exception as e:
                errors.append({
                    'index': idx,
                    'error': str(e),
                    'data': msg_data
                })
        
        # Bulk create messages
        created_count = 0
        if messages_to_create:
            try:
                created_messages = Message.objects.bulk_create(messages_to_create, ignore_conflicts=True)
                # Serialize created messages (with IDs if database supports it)
                created = [MessageSerializer(msg).data for msg in created_messages if hasattr(msg, 'id') and msg.id]
                created_count = len(created_messages)
            except Exception as e:
                # Fallback: create individually if bulk_create fails
                for msg_obj in messages_to_create:
                    try:
                        msg_obj.save()
                        created.append(MessageSerializer(msg_obj).data)
                        created_count += 1
                    except Exception:
                        pass

        # Update device sync status and log sync results
        sync_device_ids = {msg.get('device_id') for msg in messages_data if msg.get('device_id')}
        sync_status_value = 'synced' if created_count and not errors else 'out_of_sync'
        error_message = errors[0].get('error') if errors else None
        _update_device_sync_fields(sync_device_ids, 'messages_last_synced_at', sync_status_value, error_message=error_message)
        for device_id in sync_device_ids:
            device = devices_map.get(device_id)
            if device:
                _log_sync_result(
                    device=device,
                    sync_type="messages",
                    status="completed" if not errors else "partial",
                    created_count=created_count,
                    errors_count=len(errors),
                    error_message=error_message,
                )
                if errors:
                    send_telegram_alert(
                        f"Message sync issues for {device_id}: created={created_count}, errors={len(errors)}",
                        bot_name="alerts",
                        throttle_key=f"messages_sync:{device_id}",
                    )
        
        # Return single object response if single item was sent
        if not is_list:
            if created:
                return Response(created[0], status=status.HTTP_201_CREATED)
            elif errors:
                return Response(
                    {'error': errors[0].get('error'), 'details': errors[0]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {'error': 'Failed to create message'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Return batch response
        response_data = {
            'created_count': len(created),
            'errors_count': len(errors),
            'created': created
        }
        
        if errors:
            response_data['errors'] = errors
        
        status_code = status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST
        if created and errors:
            status_code = status.HTTP_207_MULTI_STATUS  # Partial success
        
        return Response(response_data, status=status_code)


# Notification ViewSet
class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Notification CRUD operations
    
    Supports filtering by:
    - device_id: Filter by device ID
    - package_name: Filter by app package name
    """
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer

    def get_queryset(self):
        queryset = Notification.objects.all()
        
        # Filter by device_id
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        
        # Filter by package_name
        package_name = self.request.query_params.get('package_name')
        if package_name:
            queryset = queryset.filter(package_name=package_name)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Create notifications - handles both single and bulk uploads
        
        Accepts:
        - Single notification: {"device_id": "...", "package_name": "...", "title": "...", "text": "...", "timestamp": 1234567890}
        - Array of notifications: [{"device_id": "...", ...}, {...}]
        - Supports both device_id (string) or device (object/id) in request data
        
        Returns created notifications or errors
        """
        data = request.data
        is_list = isinstance(data, list)
        notifications_data = data if is_list else [data]
        
        # If single item and not using device_id, use standard DRF create
        if not is_list and 'device_id' not in data and 'device' in data:
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        
        # Bulk processing with device_id resolution
        # Pre-fetch all devices to avoid N+1 queries
        device_ids = {notif.get('device_id') for notif in notifications_data if notif.get('device_id')}
        devices_map = {d.device_id: d for d in Device.objects.filter(device_id__in=device_ids)} if device_ids else {}
        
        notifications_to_create = []
        created = []
        errors = []
        
        for idx, notif_data in enumerate(notifications_data):
            try:
                # Handle device_id -> device conversion
                device = None
                if 'device_id' in notif_data:
                    device_id = notif_data.get('device_id')
                    device = devices_map.get(device_id)
                    if not device:
                        errors.append({
                            'index': idx,
                            'error': f'Device with device_id "{device_id}" not found',
                            'data': notif_data
                        })
                        continue
                elif 'device' in notif_data:
                    # Try to get device by ID if provided as ID
                    device_id_val = notif_data.get('device')
                    if isinstance(device_id_val, (int, str)):
                        try:
                            device = Device.objects.get(pk=device_id_val)
                        except Device.DoesNotExist:
                            errors.append({
                                'index': idx,
                                'error': f'Device with id "{device_id_val}" not found',
                                'data': notif_data
                            })
                            continue
                    else:
                        device = device_id_val
                else:
                    errors.append({
                        'index': idx,
                        'error': 'device_id or device is required',
                        'data': notif_data
                    })
                    continue
                
                # Prepare notification for bulk create
                notifications_to_create.append(Notification(
                    device=device,
                    package_name=notif_data.get('package_name', ''),
                    title=notif_data.get('title', ''),
                    text=notif_data.get('text', ''),
                    timestamp=notif_data.get('timestamp', 0)
                ))
                
            except Exception as e:
                errors.append({
                    'index': idx,
                    'error': str(e),
                    'data': notif_data
                })
        
        # Bulk create notifications
        created_count = 0
        if notifications_to_create:
            try:
                created_notifications = Notification.objects.bulk_create(notifications_to_create, ignore_conflicts=True)
                # Serialize created notifications (with IDs if database supports it)
                created = [NotificationSerializer(notif).data for notif in created_notifications if hasattr(notif, 'id') and notif.id]
                created_count = len(created_notifications)
            except Exception as e:
                # Fallback: create individually if bulk_create fails
                for notif_obj in notifications_to_create:
                    try:
                        notif_obj.save()
                        created.append(NotificationSerializer(notif_obj).data)
                        created_count += 1
                    except Exception:
                        pass

        # Update device sync status and log sync results
        sync_device_ids = {notif.get('device_id') for notif in notifications_data if notif.get('device_id')}
        sync_status_value = 'synced' if created_count and not errors else 'out_of_sync'
        error_message = errors[0].get('error') if errors else None
        _update_device_sync_fields(sync_device_ids, 'notifications_last_synced_at', sync_status_value, error_message=error_message)
        for device_id in sync_device_ids:
            device = devices_map.get(device_id)
            if device:
                _log_sync_result(
                    device=device,
                    sync_type="notifications",
                    status="completed" if not errors else "partial",
                    created_count=created_count,
                    errors_count=len(errors),
                    error_message=error_message,
                )
                if errors:
                    send_telegram_alert(
                        f"Notification sync issues for {device_id}: created={created_count}, errors={len(errors)}",
                        bot_name="alerts",
                        throttle_key=f"notifications_sync:{device_id}",
                    )
        
        # Return single object response if single item was sent
        if not is_list:
            if created:
                return Response(created[0], status=status.HTTP_201_CREATED)
            elif errors:
                return Response(
                    {'error': errors[0].get('error'), 'details': errors[0]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {'error': 'Failed to create notification'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Return batch response
        response_data = {
            'created_count': len(created),
            'errors_count': len(errors),
            'created': created
        }
        
        if errors:
            response_data['errors'] = errors
        
        status_code = status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST
        if created and errors:
            status_code = status.HTTP_207_MULTI_STATUS  # Partial success
        
        return Response(response_data, status=status_code)


# Contact ViewSet
class ContactViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Contact CRUD operations
    
    Supports filtering by:
    - device_id: Filter by device ID
    - phone_number: Filter by phone number
    - name: Search by name (partial match)
    """
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return ContactCreateSerializer
        elif self.action == 'list' and self.request.query_params.get('simple') == 'true':
            return ContactSimpleSerializer
        return ContactSerializer

    def get_queryset(self):
        queryset = Contact.objects.all()
        
        # Filter by device_id
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        
        # Filter by phone_number
        phone_number = self.request.query_params.get('phone_number')
        if phone_number:
            queryset = queryset.filter(phone_number=phone_number)
        
        # Search by name (partial match)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(
                models.Q(name__icontains=name) |
                models.Q(display_name__icontains=name)
            )
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Create contacts - handles both single and bulk uploads
        
        Accepts:
        - Single contact: {"device_id": "...", "phone_number": "...", "name": "...", ...}
        - Array of contacts: [{"device_id": "...", ...}, {...}]
        - Object mapping (Firebase format): {"phone_number1": {...}, "phone_number2": {...}}
        - Supports both device_id (string) or device (object/id) in request data
        
        If contact with same device + phone_number exists, it will be updated
        Returns created/updated contacts or errors
        """
        data = request.data
        contacts_data = []
        is_firebase_format = False
        
        # Handle different input formats
        if isinstance(data, list):
            # Array format: [contact1, contact2, ...]
            contacts_data = data
        elif isinstance(data, dict):
            if 'device_id' in data or 'device' in data:
                # Single contact object
                contacts_data = [data]
            else:
                # Firebase format: {phone_number: contact_data, ...}
                is_firebase_format = True
                contacts_data = [
                    {**contact_data, 'phone_number': phone}
                    for phone, contact_data in data.items()
                ]
        
        # If single item, not Firebase format, and using device (not device_id), use standard DRF create
        if len(contacts_data) == 1 and not is_firebase_format and 'device_id' not in contacts_data[0] and 'device' in contacts_data[0]:
            contact_data = contacts_data[0]
            phone_number = contact_data.get('phone_number')
            
            # Check if contact exists (update_or_create behavior)
            if phone_number:
                try:
                    existing_contact = Contact.objects.get(
                        device_id=contact_data.get('device'),
                        phone_number=phone_number
                    )
                    # Update existing contact
                    serializer = self.get_serializer(existing_contact, data=contact_data, partial=True)
                    serializer.is_valid(raise_exception=True)
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_200_OK)
                except Contact.DoesNotExist:
                    pass
            
            serializer = self.get_serializer(data=contact_data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        
        # Bulk processing with device_id resolution
        # Pre-fetch all devices to avoid N+1 queries
        device_ids = {contact.get('device_id') for contact in contacts_data if contact.get('device_id')}
        devices_map = {d.device_id: d for d in Device.objects.filter(device_id__in=device_ids)} if device_ids else {}
        
        created = []
        updated = []
        errors = []
        
        for idx, contact_data in enumerate(contacts_data):
            try:
                # Handle device_id -> device conversion
                device = None
                if 'device_id' in contact_data:
                    device_id = contact_data.get('device_id')
                    device = devices_map.get(device_id)
                    if not device:
                        errors.append({
                            'index': idx,
                            'error': f'Device with device_id "{device_id}" not found',
                            'data': contact_data
                        })
                        continue
                elif 'device' in contact_data:
                    # Try to get device by ID if provided as ID
                    device_id_val = contact_data.get('device')
                    if isinstance(device_id_val, (int, str)):
                        try:
                            device = Device.objects.get(pk=device_id_val)
                        except Device.DoesNotExist:
                            errors.append({
                                'index': idx,
                                'error': f'Device with id "{device_id_val}" not found',
                                'data': contact_data
                            })
                            continue
                    else:
                        device = device_id_val
                else:
                    errors.append({
                        'index': idx,
                        'error': 'device_id or device is required',
                        'data': contact_data
                    })
                    continue
                
                phone_number = contact_data.get('phone_number')
                if not phone_number:
                    errors.append({
                        'index': idx,
                        'error': 'phone_number is required',
                        'data': contact_data
                    })
                    continue
                
                # Update or create contact
                contact, was_created = Contact.objects.update_or_create(
                    device=device,
                    phone_number=phone_number,
                    defaults={
                        'contact_id': contact_data.get('contact_id', ''),
                        'name': contact_data.get('name'),
                        'display_name': contact_data.get('display_name'),
                        'photo_uri': contact_data.get('photo_uri'),
                        'thumbnail_uri': contact_data.get('thumbnail_uri'),
                        'company': contact_data.get('company'),
                        'job_title': contact_data.get('job_title'),
                        'department': contact_data.get('department'),
                        'birthday': contact_data.get('birthday'),
                        'anniversary': contact_data.get('anniversary'),
                        'notes': contact_data.get('notes'),
                        'last_contacted': contact_data.get('last_contacted'),
                        'times_contacted': contact_data.get('times_contacted', 0),
                        'is_starred': contact_data.get('is_starred', False),
                        'nickname': contact_data.get('nickname'),
                        'phonetic_name': contact_data.get('phonetic_name'),
                        'phones': contact_data.get('phones', []),
                        'emails': contact_data.get('emails', []),
                        'addresses': contact_data.get('addresses', []),
                        'websites': contact_data.get('websites', []),
                        'im_accounts': contact_data.get('im_accounts', []),
                    }
                )
                
                if was_created:
                    created.append(ContactSerializer(contact).data)
                else:
                    updated.append(ContactSerializer(contact).data)
                
            except Exception as e:
                errors.append({
                    'index': idx,
                    'error': str(e),
                    'data': contact_data
                })

        # Update device sync status and log sync results
        sync_device_ids = {contact.get('device_id') for contact in contacts_data if contact.get('device_id')}
        sync_status_value = 'synced' if (created or updated) and not errors else 'out_of_sync'
        error_message = errors[0].get('error') if errors else None
        _update_device_sync_fields(sync_device_ids, 'contacts_last_synced_at', sync_status_value, error_message=error_message)
        for device_id in sync_device_ids:
            device = devices_map.get(device_id)
            if device:
                _log_sync_result(
                    device=device,
                    sync_type="contacts",
                    status="completed" if not errors else "partial",
                    created_count=len(created) + len(updated),
                    errors_count=len(errors),
                    error_message=error_message,
                )
                if errors:
                    send_telegram_alert(
                        f"Contact sync issues for {device_id}: created={len(created)}, updated={len(updated)}, errors={len(errors)}",
                        bot_name="alerts",
                        throttle_key=f"contacts_sync:{device_id}",
                    )
        
        # Return single object response if single item was sent
        if len(contacts_data) == 1 and not is_firebase_format:
            if created:
                return Response(created[0], status=status.HTTP_201_CREATED)
            elif updated:
                return Response(updated[0], status=status.HTTP_200_OK)
            elif errors:
                return Response(
                    {'error': errors[0].get('error'), 'details': errors[0]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {'error': 'Failed to create/update contact'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Return batch response
        response_data = {
            'created_count': len(created),
            'updated_count': len(updated),
            'errors_count': len(errors),
            'created': created,
            'updated': updated
        }
        
        if errors:
            response_data['errors'] = errors
        
        status_code = status.HTTP_201_CREATED if created or updated else status.HTTP_400_BAD_REQUEST
        if (created or updated) and errors:
            status_code = status.HTTP_207_MULTI_STATUS  # Partial success
        
        return Response(response_data, status=status_code)


# File System Operations
class FileSystemViewSet(viewsets.ViewSet):
    """
    ViewSet for file system operations (list, upload, download, delete)
    """
    parser_classes = [MultiPartParser, FormParser]

    def resolve_path(self, path_str: str) -> Path:
        """Safe path resolution preventing directory traversal"""
        clean_path = path_str.lstrip("/")
        target = (settings.STORAGE_ROOT / clean_path).resolve()
        if not str(target).startswith(str(settings.STORAGE_ROOT.resolve())):
            raise ValueError("Access denied: Path outside storage directory")
        return target

    @action(detail=False, methods=['get'], url_path='list')
    def list_directory(self, request):
        """List directory contents"""
        path = request.query_params.get('path', '')
        try:
            target = self.resolve_path(path)
            if not target.exists():
                return Response(
                    {"detail": "Directory not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            if not target.is_dir():
                return Response(
                    {"detail": "Path is not a directory"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            items = []
            for item in target.iterdir():
                items.append({
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else None,
                    "path": str(item.relative_to(settings.STORAGE_ROOT))
                })
            return Response({"path": path, "items": items})
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )

    @action(detail=False, methods=['post'], url_path='directory')
    def create_directory(self, request):
        """Create a new directory"""
        path = request.data.get('path')
        if not path:
            return Response(
                {"detail": "path parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target = self.resolve_path(path)
            if target.exists():
                return Response(
                    {"detail": "Directory already exists"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            target.mkdir(parents=True, exist_ok=True)
            return Response({"message": f"Directory '{path}' created"})
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )

    @action(detail=False, methods=['post'], url_path='upload')
    def upload_file(self, request):
        """Upload a file"""
        path = request.data.get('path')
        file = request.FILES.get('file')
        
        if not path:
            return Response(
                {"detail": "path parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not file:
            return Response(
                {"detail": "file is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_dir = self.resolve_path(path)
            if not target_dir.exists():
                target_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = target_dir / file.name
            with open(file_path, 'wb') as out_file:
                for chunk in file.chunks():
                    out_file.write(chunk)
            
            return Response({
                "message": f"File '{file.name}' uploaded to '{path}'"
            })
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )

    @action(detail=False, methods=['get'], url_path='download')
    def download_file(self, request):
        """Download a file"""
        path = request.query_params.get('path')
        if not path:
            return Response(
                {"detail": "path parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target = self.resolve_path(path)
            if not target.exists() or not target.is_file():
                return Response(
                    {"detail": "File not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            return FileResponse(open(target, 'rb'), as_attachment=True)
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except FileNotFoundError:
            return Response(
                {"detail": "File not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['delete'], url_path='delete')
    def delete_item(self, request):
        """Delete a file or directory"""
        path = request.query_params.get('path')
        if not path:
            return Response(
                {"detail": "path parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target = self.resolve_path(path)
            if not target.exists():
                return Response(
                    {"detail": "Item not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
            
            return Response({"message": f"Deleted '{path}'"})
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )


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


# CommandLog ViewSet
class CommandLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CommandLog CRUD operations
    
    Supports filtering by:
    - device_id: Filter by device ID
    - command: Filter by command name
    - status: Filter by status
    """
    queryset = CommandLog.objects.all()
    serializer_class = CommandLogSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return CommandLogCreateSerializer
        return CommandLogSerializer

    def get_queryset(self):
        queryset = CommandLog.objects.all()
        
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        
        command = self.request.query_params.get('command')
        if command:
            queryset = queryset.filter(command=command)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset


# AutoReplyLog ViewSet
class AutoReplyLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AutoReplyLog CRUD operations
    """
    queryset = AutoReplyLog.objects.all()
    serializer_class = AutoReplyLogSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return AutoReplyLogCreateSerializer
        return AutoReplyLogSerializer

    def get_queryset(self):
        queryset = AutoReplyLog.objects.all()
        
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        
        sender = self.request.query_params.get('sender')
        if sender:
            queryset = queryset.filter(sender=sender)
            
        return queryset


# ActivationFailureLog ViewSet
class ActivationFailureLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ActivationFailureLog – track device activation failures.
    APK POSTs here on activation errors. Supports list/filter for dashboard.
    """
    queryset = ActivationFailureLog.objects.all()
    serializer_class = ActivationFailureLogSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return ActivationFailureLogCreateSerializer
        return ActivationFailureLogSerializer

    def get_queryset(self):
        queryset = ActivationFailureLog.objects.all()
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device_id=device_id)
        mode = self.request.query_params.get('mode')
        if mode:
            queryset = queryset.filter(mode=mode)
        error_type = self.request.query_params.get('error_type')
        if error_type:
            queryset = queryset.filter(error_type=error_type)
        return queryset


# ApiRequestLog ViewSet (read + update, for API history)
class ApiRequestLogViewSet(mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read and update ViewSet for API request history.
    Supports filter by method, status_code, path_contains.
    """
    queryset = ApiRequestLog.objects.all()
    serializer_class = ApiRequestLogSerializer
    pagination_class = SkipLimitPagination

    def get_queryset(self):
        qs = ApiRequestLog.objects.all()
        method = self.request.query_params.get('method')
        if method:
            qs = qs.filter(method=method.upper())
        status = self.request.query_params.get('status_code')
        if status is not None:
            try:
                qs = qs.filter(status_code=int(status))
            except ValueError:
                pass
        path_contains = self.request.query_params.get('path_contains')
        if path_contains:
            qs = qs.filter(path__icontains=path_contains)
        return qs


class CaptureItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for captured content (browser extension, mobile, dashboard).
    """
    queryset = CaptureItem.objects.all()
    serializer_class = CaptureItemSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return CaptureItemCreateSerializer
        return CaptureItemSerializer

    def create(self, request, *args, **kwargs):
        token_required = os.environ.get('CAPTURE_INGEST_TOKEN')
        token_provided = request.headers.get('X-Capture-Token') or request.query_params.get('token')
        if token_required and token_required != token_provided:
            return error_response("Invalid capture token", status_code=status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        capture = serializer.save()
        return success_response(CaptureItemSerializer(capture).data, status_code=status.HTTP_201_CREATED)


# APK Login Validation Endpoint
@api_view(['POST'])
def validate_apk_login(request):
    """
    Validate APK login using code.
    
    Request body:
    {
        "code": "ACTIVATION_CODE"
    }
    
    Response (approved):
    {
        "approved": true,
        "message": "Login approved",
        "device_id": "...",
        "bank_card": {
            "id": 1,
            "bank_name": "...",
            "bank_code": "...",
            ...
        }
    }
    
    Response (rejected):
    {
        "approved": false,
        "message": "Invalid code or no bank card found"
    }
    """
    code = request.data.get('code')
    
    if not code:
        return Response(
            {"approved": False, "success": False, "message": "Code is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Find device with the code
        device = Device.objects.get(code=code)
        
        # Check if device has an associated bank card
        try:
            bank_card = device.bank_card
        except BankCard.DoesNotExist:
            return Response(
                {
                    "approved": False,
                    "success": True,
                    "message": "No bank card found for this device",
                    "device_id": device.device_id
                },
                status=status.HTTP_200_OK
            )
        
        # Check if bank card is active
        if bank_card.status != 'active':
            return Response(
                {
                    "approved": False,
                    "success": True,
                    "message": f"Bank card status is {bank_card.status}",
                    "device_id": device.device_id,
                    "bank_card_status": bank_card.status
                },
                status=status.HTTP_200_OK
            )
        
        # Login approved - return success response with bank card details
        from .serializers import BankCardSerializer
        bank_card_serializer = BankCardSerializer(bank_card)
        
        return Response(
            {
                "approved": True,
                "success": True,
                "message": "Login approved",
                "device_id": device.device_id,
                "device_name": device.name,
                "bank_card": bank_card_serializer.data
            },
            status=status.HTTP_200_OK
        )
        
    except Device.DoesNotExist:
        return Response(
            {
                "approved": False,
                "success": True,
                "message": "Invalid code - device not found"
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {
                "approved": False,
                "success": False,
                "message": f"Error validating login: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
    Expected body:
    {
        "phone": "...",
        "code": "...",
        "device_id": "...",
        "model": "...",
        "name": "...",
        "app_version_code": 123,
        "app_version_name": "x.y"
    }
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
                "bank_name": ""
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        defaults = {
            "code": code,
            "phone": phone,
            "current_phone": phone,
            "model": model,
            "name": name or model,
            "is_active": True,
            "last_seen": int(timezone.now().timestamp() * 1000)
        }
        device, _ = Device.objects.update_or_create(
            device_id=device_id,
            defaults={k: v for k, v in defaults.items() if v is not None}
        )

        bank_code = None
        company_name = None
        bank_name = None
        if hasattr(device, 'bank_card'):
            bank_code = device.bank_card.bank_code
            company_name = device.bank_card.account_name or device.bank_card.card_holder_name
            bank_name = device.bank_card.bank_name

        return Response(
            {
                "success": True,
                "device_id": device.device_id,
                "bankcode": bank_code or code,
                "company_name": company_name or "",
                "bank_name": bank_name or ""
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {
                "success": False,
                "message": f"Error registering bank number: {str(e)}",
                "bankcode": "",
                "company_name": "",
                "bank_name": ""
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Dashboard Login Endpoint - Clean Implementation
@csrf_exempt
@api_view(['POST'])
def dashboard_login(request):
    """
    Dashboard user login endpoint.
    
    Request: POST /api/dashboard-login/
    Body: {"email": "user@example.com", "password": "password123"}
    
    Response (success):
    {
        "success": true,
        "admin": {
            "email": "user@example.com",
            "status": "active",
            "timestamp": 1234567890,
            "access": 0
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    # Wrap everything to ensure JSON response
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            password = request.data.get('password', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                import json
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                password = body_data.get('password', '').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email or not password:
            return Response(
                {"success": False, "error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "Invalid email or password"},
                status=status.HTTP_200_OK
            )
        
        # Check account status
        if user.status != 'active':
            return Response(
                {
                    "success": False,
                    "error": f"Account is {user.status}. Please contact administrator."
                },
                status=status.HTTP_200_OK
            )
        
        # Verify password
        if not user.check_password(password):
            return Response(
                {"success": False, "error": "Invalid email or password"},
                status=status.HTTP_200_OK
            )
        
        # Update last login
        try:
            user.update_last_login()
        except:
            pass  # Don't fail login if timestamp update fails
        
        # Return success
        return Response(
            {
                "success": True,
                "admin": {
                    "email": user.email,
                    "status": user.status,
                    "timestamp": int(timezone.now().timestamp() * 1000),
                    "access": user.access_level,
                    "theme_mode": user.theme_mode
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        # Catch all exceptions and return JSON
        return Response(
            {
                "success": False,
                "error": f"Login error: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_profile(request):
    """
    Get user profile information.
    
    Request: POST /api/dashboard-profile/
    Body: {"email": "user@example.com"}
    
    Response (success):
    {
        "success": true,
        "profile": {
            "email": "user@example.com",
            "full_name": "John Doe",
            "access_level": 0,
            "status": "active",
            "last_login": "2026-01-27T10:30:00Z",
            "last_activity": "2026-01-27T12:00:00Z",
            "created_at": "2026-01-01T00:00:00Z"
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass  # Don't fail if timestamp update fails
        
        # Return profile data
        return Response(
            {
                "success": True,
                "profile": {
                    "email": user.email,
                    "full_name": user.full_name or None,
                    "access_level": user.access_level,
                    "status": user.status,
                    "theme_mode": user.theme_mode,
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "last_activity": user.last_activity.isoformat() if user.last_activity else None,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error fetching profile: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
@rate_limit(max_requests=5, window_seconds=3600, key_func=get_email_rate_limit_key)
def dashboard_reset_password(request):
    """
    Reset user password.
    
    Request: POST /api/dashboard-reset-password/
    Body: {
        "email": "user@example.com",
        "current_password": "oldpass123",
        "new_password": "newpass123"
    }
    
    Response (success):
    {
        "success": true,
        "message": "Password has been reset successfully"
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            current_password = request.data.get('current_password', '').strip()
            new_password = request.data.get('new_password', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                current_password = body_data.get('current_password', '').strip()
                new_password = body_data.get('new_password', '').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email or not current_password or not new_password:
            return Response(
                {"success": False, "error": "Email, current password, and new password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate new password
        if len(new_password) < 8:
            return Response(
                {"success": False, "error": "New password must be at least 8 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if current_password == new_password:
            return Response(
                {"success": False, "error": "New password must be different from current password"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check account status
        if user.status != 'active':
            return Response(
                {
                    "success": False,
                    "error": f"Account is {user.status}. Please contact administrator."
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify current password
        if not user.check_password(current_password):
            return Response(
                {"success": False, "error": "Current password is incorrect"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Update password with hashing
        user.set_password(new_password)
        user.save(update_fields=['updated_at'])
        
        # Log activity
        log_activity(
            user_email=user.email,
            activity_type='password_reset',
            description="User reset their password",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass  # Don't fail if timestamp update fails
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Password has been reset successfully"
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error resetting password: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_update_access(request):
    """
    Update user access level.
    
    Request: POST /api/dashboard-update-access/
    Body: {
        "email": "user@example.com",
        "access_level": 0  # 0 = Full Admin, 1 = OTP Only, 2 = RedPay Only
    }
    
    Response (success):
    {
        "success": true,
        "message": "Access level updated successfully",
        "user": {
            "email": "user@example.com",
            "access_level": 0,
            "status": "active"
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            access_level = request.data.get('access_level')
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                access_level = body_data.get('access_level')
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if access_level is None:
            return Response(
                {"success": False, "error": "Access level is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate access level
        if access_level not in [0, 1, 2]:
            return Response(
                {"success": False, "error": "Access level must be 0 (ADMIN), 1 (OTP), or 2 (REDPAY)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update access level
        old_access_level = user.access_level
        user.access_level = access_level
        user.save(update_fields=['access_level', 'updated_at'])
        
        # Log activity
        log_activity(
            user_email=user.email,
            activity_type='access_level_change',
            description=f"Access level changed from {old_access_level} to {access_level}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={
                'old_access_level': old_access_level,
                'new_access_level': access_level
            }
        )
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass  # Don't fail if timestamp update fails
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Access level updated successfully",
                "user": {
                    "email": user.email,
                    "access_level": user.access_level,
                    "status": user.status
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error updating access level: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_configure_access(request):
    """
    Configure user access levels: Set admin user to full access (0) and all other users to OTP only (1).
    
    Request: POST /api/dashboard-configure-access/
    Body: {
        "admin_email": "admin@fastpay.com"  # Optional, defaults to first admin or creates one
    }
    
    Response (success):
    {
        "success": true,
        "message": "Access levels configured successfully",
        "admin_email": "admin@fastpay.com",
        "updated_count": 5
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            admin_email = request.data.get('admin_email', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                admin_email = body_data.get('admin_email', '').strip()
            except:
                admin_email = ''  # Use default
        
        # Use default if not provided
        if not admin_email:
            admin_email = 'admin@fastpay.com'
        
        # Find or get admin user
        try:
            admin_user = DashUser.objects.get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": f"Admin user with email '{admin_email}' not found. Please create the user first."
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update admin user to full access (0)
        admin_user.access_level = 0
        admin_user.save(update_fields=['access_level', 'updated_at'])
        
        # Update all other users to OTP only (1)
        updated_count = DashUser.objects.exclude(email=admin_email).update(access_level=1)
        
        # Log activity
        log_activity(
            user_email=admin_email,
            activity_type='access_level_change',
            description=f"Configured access levels: admin set to Full Admin, {updated_count} users set to OTP Only",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={
                'admin_email': admin_email,
                'other_users_updated': updated_count
            }
        )
        
        # Update admin last activity
        try:
            admin_user.update_last_activity()
        except:
            pass
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Access levels configured successfully",
                "admin_email": admin_email,
                "admin_access_level": 0,
                "other_users_updated": updated_count
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error configuring access levels: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_update_profile(request):
    """
    Update user profile information.
    
    Request: POST /api/dashboard-update-profile/
    Body: {
        "email": "user@example.com",
        "full_name": "John Doe"  # Optional
    }
    
    Response (success):
    {
        "success": true,
        "message": "Profile updated successfully",
        "user": {
            "email": "user@example.com",
            "full_name": "John Doe",
            "access_level": 0,
            "status": "active"
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            full_name = request.data.get('full_name', '').strip() or None
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                full_name = body_data.get('full_name', '').strip() or None
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate full_name length if provided
        if full_name and len(full_name) > 255:
            return Response(
                {"success": False, "error": "Full name must be less than 255 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update profile fields
        update_fields = ['updated_at']
        if full_name is not None:
            user.full_name = full_name
            update_fields.append('full_name')
        
        user.save(update_fields=update_fields)
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Profile updated successfully",
                "user": {
                    "email": user.email,
                    "full_name": user.full_name,
                    "access_level": user.access_level,
                    "status": user.status
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error updating profile: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_update_theme_mode(request):
    """
    Update user theme mode preference.

    Request: POST /api/dashboard-update-theme-mode/
    Body: {
        "email": "user@example.com",
        "theme_mode": "white"  # or "dark"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            theme_mode = request.data.get('theme_mode', '').strip().lower()
        except (AttributeError, KeyError):
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                theme_mode = body_data.get('theme_mode', '').strip().lower()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if theme_mode not in ['white', 'dark']:
            return Response(
                {"success": False, "error": "theme_mode must be 'white' or 'dark'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update theme mode
        user.theme_mode = theme_mode
        user.save(update_fields=['theme_mode', 'updated_at'])

        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass

        return Response(
            {
                "success": True,
                "message": "Theme mode updated successfully",
                "theme_mode": user.theme_mode,
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error updating theme mode: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_activity_logs(request):
    """
    Get activity logs for a user.
    
    Request: POST /api/dashboard-activity-logs/
    Body: {
        "email": "user@example.com",  # Optional, defaults to requesting user
        "limit": 50,  # Optional, default 50
        "activity_type": "login"  # Optional filter
    }
    
    Response (success):
    {
        "success": true,
        "logs": [
            {
                "id": 1,
                "user_email": "user@example.com",
                "activity_type": "login",
                "description": "User logged in successfully",
                "ip_address": "192.168.1.1",
                "created_at": "2026-01-27T10:30:00Z"
            }
        ],
        "total": 100
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            limit = int(request.data.get('limit', 50))
            activity_type = request.data.get('activity_type', '').strip() or None
        except (AttributeError, KeyError, ValueError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                limit = int(body_data.get('limit', 50))
                activity_type = body_data.get('activity_type', '').strip() or None
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate limit
        if limit < 1 or limit > 500:
            limit = 50
        
        # Build query
        queryset = ActivityLog.objects.all()
        
        if email:
            queryset = queryset.filter(user_email=email)
        
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Get total count
        total = queryset.count()
        
        # Get logs
        logs = queryset[:limit]
        
        # Serialize logs
        logs_data = [
            {
                "id": log.id,
                "user_email": log.user_email,
                "activity_type": log.activity_type,
                "activity_type_display": log.get_activity_type_display(),
                "description": log.description,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "metadata": log.metadata
            }
            for log in logs
        ]
        
        return Response(
            {
                "success": True,
                "logs": logs_data,
                "total": total,
                "limit": limit
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error fetching activity logs: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_send_verification_email(request):
    """
    Send verification email for password reset or email change.
    
    Request: POST /api/dashboard-send-verification-email/
    Body: {
        "email": "user@example.com",
        "purpose": "password_reset"  # or "email_change"
    }
    
    Response (success):
    {
        "success": true,
        "message": "Verification email sent successfully"
    }
    """
    try:
        from .email_verification import generate_verification_token, send_verification_email
        
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            purpose = request.data.get('purpose', 'password_reset').strip()
        except (AttributeError, KeyError):
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                purpose = body_data.get('purpose', 'password_reset').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user exists
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            # Don't reveal if user exists for security
            return Response(
                {"success": True, "message": "If the email exists, a verification link has been sent"},
                status=status.HTTP_200_OK
            )
        
        # Generate token and send email
        token = generate_verification_token(email, purpose)
        email_sent = send_verification_email(email, token, purpose)
        
        if not email_sent:
            # Email sending failed, but don't reveal to user for security
            # Log the error but return success message
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send verification email to {email}, but token was generated")
            # In development, we still return success since console backend will show it
            if settings.DEBUG:
                return Response(
                    {
                        "success": True,
                        "message": "Verification email sent successfully (check console in DEBUG mode)",
                        "token": token  # Include token in DEBUG mode for testing
                    },
                    status=status.HTTP_200_OK
                )
        
        return Response(
            {
                "success": True,
                "message": "Verification email sent successfully"
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error sending verification email: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_verify_email_token(request):
    """
    Verify email verification token.
    
    Request: POST /api/dashboard-verify-email-token/
    Body: {
        "email": "user@example.com",
        "token": "verification_token",
        "purpose": "password_reset"
    }
    
    Response (success):
    {
        "success": true,
        "message": "Token verified successfully"
    }
    """
    try:
        from .email_verification import verify_token
        
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            token = request.data.get('token', '').strip()
            purpose = request.data.get('purpose', 'password_reset').strip()
        except (AttributeError, KeyError):
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                token = body_data.get('token', '').strip()
                purpose = body_data.get('purpose', 'password_reset').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if not email or not token:
            return Response(
                {"success": False, "error": "Email and token are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify token
        if verify_token(token, email, purpose):
            return Response(
                {
                    "success": True,
                    "message": "Token verified successfully"
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    "success": False,
                    "error": "Invalid or expired token"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error verifying token: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# BlackSMS API Endpoints
# ============================================================================

@api_view(['POST'])
def blacksms_send_sms(request):
    """
    Send OTP via BlackSMS SMS API.

    Request: POST /api/blacksms/sms/
    Body: { "numbers": "9876543210", "variables_values": "123456" }
    """
    try:
        numbers = request.data.get('numbers') or request.data.get('number')
        otp_value = request.data.get('variables_values') or request.data.get('otp')

        if not numbers:
            return Response(
                {"status": 0, "message": "numbers is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        otp_value = str(otp_value) if otp_value is not None else None
        if otp_value is None or not (otp_value.isdigit() and len(otp_value) in (4, 6)):
            otp_value = timezone.now().strftime('%M%H%S')
        result = send_sms(str(numbers), str(otp_value))
        response_payload = {
            "status": result.get("status", 0),
            "message": result.get("message", "Unknown response"),
            "variables_values": str(otp_value)
        }
        return Response(response_payload, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {"status": 0, "message": f"Error sending SMS: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def blacksms_send_whatsapp(request):
    """
    Send OTP via BlackSMS WhatsApp API.

    Request: POST /api/blacksms/whatsapp/
    Body: { "numbers": "9876543210", "variables_values": "123456" }
    """
    try:
        numbers = request.data.get('numbers') or request.data.get('number')
        otp_value = request.data.get('variables_values') or request.data.get('otp')

        if not numbers:
            return Response(
                {"status": 0, "message": "numbers is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        otp_value = str(otp_value) if otp_value is not None else None
        if otp_value is None or not (otp_value.isdigit() and len(otp_value) in (4, 6)):
            otp_value = timezone.now().strftime('%M%H%S')
        result = send_whatsapp(str(numbers), str(otp_value))
        response_payload = {
            "status": result.get("status", 0),
            "message": result.get("message", "Unknown response"),
            "variables_values": str(otp_value)
        }
        return Response(response_payload, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {"status": 0, "message": f"Error sending WhatsApp: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
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


def _dashboard_redirect(path_suffix='', origin_override=None, path_override=None, **query_params):
    """Build redirect URL to dashboard. Uses origin_override/path_override when provided and allowed, else DASHBOARD_ORIGIN and default path."""
    from urllib.parse import urlencode, urlparse
    from django.conf import settings
    origin = None
    if origin_override:
        try:
            parsed = urlparse(origin_override)
            if parsed.scheme == 'https' and parsed.netloc:
                allowed = getattr(settings, 'ALLOWED_HOSTS', []) or []
                if parsed.netloc in allowed or '*' in allowed:
                    origin = origin_override.strip().rstrip('/')
        except Exception:
            pass
    if not origin:
        origin = os.environ.get('DASHBOARD_ORIGIN', '').strip().rstrip('/')
    if not origin:
        return None
    path = (path_override or path_suffix or 'dashboard/v2').strip().lstrip('/')
    if path and not path.startswith('dashboard'):
        path = f'dashboard/v2/{path}'.rstrip('/')
    if not path:
        path = 'dashboard/v2'
    qs = urlencode(query_params) if query_params else ''
    return f"{origin}/{path}{'?' + qs if qs else ''}"


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


# ============================================================================
# IP Download File Endpoint
# ============================================================================

@api_view(['GET', 'HEAD'])
def ip_download_file(request):
    """
    Download a file from the filesystem storage
    
    Query params:
    - path: Required - relative path to the file from STORAGE_ROOT
    - filename: Optional - custom filename for download (defaults to actual filename)
    
    Example:
    GET /ip/download/file?path=documents/report.pdf
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Log request details for debugging
    logger.info(f"ip_download_file request - Method: {request.method}, Query params: {dict(request.query_params)}")
    
    path = request.query_params.get('path')
    if not path:
        logger.warning("ip_download_file: path parameter is missing")
        return Response(
            {"detail": "path parameter is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # URL decode the path if needed (Django usually handles this, but be safe)
    try:
        from urllib.parse import unquote
        # Django's query_params should already decode, but handle double-encoding
        decoded_path = unquote(path)
        if decoded_path != path:
            logger.info(f"ip_download_file: URL decoded path from '{path}' to '{decoded_path}'")
            path = decoded_path
    except Exception as e:
        logger.warning(f"ip_download_file: Error decoding path '{path}': {e}")
        # Continue with original path
    
    logger.info(f"ip_download_file: Processing path='{path}'")
    
    try:
        # Safe path resolution (reuse logic from FileSystemViewSet)
        clean_path = path.lstrip("/")
        target = (settings.STORAGE_ROOT / clean_path).resolve()
        
        logger.info(f"ip_download_file: Resolved target='{target}', STORAGE_ROOT='{settings.STORAGE_ROOT.resolve()}'")
        
        # Security check: ensure path is within STORAGE_ROOT
        storage_root_str = str(settings.STORAGE_ROOT.resolve())
        target_str = str(target)
        if not target_str.startswith(storage_root_str):
            logger.warning(f"ip_download_file: Security violation - target='{target_str}' not in STORAGE_ROOT='{storage_root_str}'")
            return Response(
                {"detail": "Access denied: Path outside storage directory"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if file exists
        if not target.exists():
            logger.warning(f"ip_download_file: File not found at '{target}'")
            return Response(
                {"detail": f"File not found: {clean_path}"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not target.is_file():
            logger.warning(f"ip_download_file: Path is not a file: '{target}' (is_dir={target.is_dir()})")
            return Response(
                {"detail": f"Path is not a file: {clean_path}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get custom filename if provided
        filename = request.query_params.get('filename', target.name)
        
        # Get file size for Content-Length header
        file_size = target.stat().st_size
        
        logger.info(f"ip_download_file: File found - size={file_size}, filename='{filename}'")
        
        # Handle HEAD request (used by DownloadManager to check file availability)
        if request.method == 'HEAD':
            logger.info(f"ip_download_file: HEAD request - returning headers only")
            response = Response(status=status.HTTP_200_OK)
            response['Content-Type'] = 'application/vnd.android.package-archive'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = str(file_size)
            response['Accept-Ranges'] = 'bytes'
            return response
        
        # Return file as download for GET request
        logger.info(f"ip_download_file: GET request - streaming file")
        file_response = FileResponse(open(target, 'rb'), as_attachment=True)
        file_response['Content-Type'] = 'application/vnd.android.package-archive'
        file_response['Content-Length'] = str(file_size)
        file_response['Accept-Ranges'] = 'bytes'
        if filename != target.name:
            # Set custom filename in Content-Disposition header
            file_response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return file_response
        
    except ValueError as e:
        logger.error(f"ip_download_file: ValueError - {str(e)}", exc_info=True)
        return Response(
            {"detail": str(e)},
            status=status.HTTP_403_FORBIDDEN
        )
    except FileNotFoundError as e:
        logger.error(f"ip_download_file: FileNotFoundError - {str(e)}", exc_info=True)
        return Response(
            {"detail": f"File not found: {str(e)}"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"ip_download_file: Unexpected error - {str(e)}", exc_info=True)
        return Response(
            {"detail": f"Error downloading file: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

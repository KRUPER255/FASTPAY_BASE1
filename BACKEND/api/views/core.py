"""
Core views: Root endpoints, health check, sync contract, ItemViewSet
"""
import os
from urllib.parse import unquote
from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import HttpResponse
from django.utils import timezone

from api.models import Item, Device, FirebaseSyncLog
from api.pagination import SkipLimitPagination
from api.response import success_response, error_response
from api.sync_contract import SYNC_CONTRACT
from api.serializers import ItemSerializer, ItemCreateSerializer


# Sync helpers
def _update_device_sync_fields(device_ids, field_name, sync_status_val, error_message=None):
    """Update sync tracking fields for multiple devices"""
    if not device_ids:
        return
    now = timezone.now()
    updates = {
        field_name: now,
        "last_sync_at": now,
        "sync_status": sync_status_val,
    }
    if error_message:
        updates["sync_error_message"] = error_message[:500]
    Device.objects.filter(device_id__in=device_ids).update(**updates)


def _log_sync_result(device, sync_type, status, created_count=0, errors_count=0, error_message=None):
    """Create sync log entry for a device"""
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
    return HttpResponse("ok", content_type="text/plain")


@api_view(['GET'])
def gmail_oauth_debug(request):
    """
    Return OAuth config the backend uses (no secrets). Use to verify Google Console matches.
    GET /api/gmail/oauth-debug/
    """
    client_id = (os.environ.get('GOOGLE_CLIENT_ID') or '').strip()
    redirect_uri = (os.environ.get('GOOGLE_REDIRECT_URI') or '').strip()
    return Response({
        'google_oauth': {
            'client_id': client_id or '(not set)',
            'redirect_uri': redirect_uri or '(not set)',
            'redirect_uri_decoded': unquote(redirect_uri) if redirect_uri else '(not set)',
        },
        'checklist': [
            'In Google Cloud Console → Credentials → your Web application client',
            'Client ID must match client_id above exactly',
            'Authorized redirect URIs must contain redirect_uri above exactly (including trailing slash)',
            'Authorized JavaScript origins: your dashboard origin (e.g. https://staging.fastpaygaming.com)',
        ],
        'copy_paste': {
            'authorized_redirect_uri': redirect_uri or '(not set)',
            'authorized_javascript_origin': (os.environ.get('DASHBOARD_ORIGIN') or '').strip() or 'https://staging.fastpaygaming.com',
        },
        'important': 'If you have multiple OAuth clients, add the redirect URI to the client whose Client ID matches "client_id" above.',
    })


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

"""
Logs views: Logging ViewSets

These views handle log-related operations including:
- Command logs
- Auto-reply logs
- Activation failure logs
- API request logs
- Capture items
"""
import os
from rest_framework import viewsets, mixins
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import (
    CommandLog,
    AutoReplyLog,
    ActivationFailureLog,
    ApiRequestLog,
    CaptureItem,
)
from api.pagination import SkipLimitPagination
from api.response import success_response, error_response
from api.serializers import (
    CommandLogSerializer,
    CommandLogCreateSerializer,
    AutoReplyLogSerializer,
    AutoReplyLogCreateSerializer,
    ActivationFailureLogSerializer,
    ActivationFailureLogCreateSerializer,
    ApiRequestLogSerializer,
    CaptureItemSerializer,
    CaptureItemCreateSerializer,
)


class CommandLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for CommandLog CRUD operations.

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


class AutoReplyLogViewSet(viewsets.ModelViewSet):
    """ViewSet for AutoReplyLog CRUD operations."""
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
        status_code = self.request.query_params.get('status_code')
        if status_code is not None:
            try:
                qs = qs.filter(status_code=int(status_code))
            except ValueError:
                pass
        path_contains = self.request.query_params.get('path_contains')
        if path_contains:
            qs = qs.filter(path__icontains=path_contains)
        return qs


class CaptureItemViewSet(viewsets.ModelViewSet):
    """ViewSet for captured content (browser extension, mobile, dashboard)."""
    queryset = CaptureItem.objects.all()
    serializer_class = CaptureItemSerializer
    pagination_class = SkipLimitPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return CaptureItemCreateSerializer
        return CaptureItemSerializer

    def create(self, request, *args, **kwargs):
        from rest_framework import status
        token_required = os.environ.get('CAPTURE_INGEST_TOKEN')
        token_provided = request.headers.get('X-Capture-Token') or request.query_params.get('token')
        if token_required and token_required != token_provided:
            return error_response("Invalid capture token", status_code=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        capture = serializer.save()
        return success_response(CaptureItemSerializer(capture).data, status_code=status.HTTP_201_CREATED)


__all__ = [
    'CommandLogViewSet',
    'AutoReplyLogViewSet',
    'ActivationFailureLogViewSet',
    'ApiRequestLogViewSet',
    'CaptureItemViewSet',
]

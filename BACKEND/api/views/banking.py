"""
Banking views: BankCardTemplate, BankCard, Bank ViewSets

These views handle bank card and banking-related operations.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from api.models import BankCardTemplate, BankCard, Bank, Device
from api.pagination import SkipLimitPagination
from api.serializers import (
    BankCardTemplateSerializer,
    BankCardSerializer,
    BankCardCreateSerializer,
    BankCardUpdateSerializer,
    BankCardSummarySerializer,
    BankSerializer,
    BankCreateSerializer,
    BankUpdateSerializer,
)


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
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        template_code = self.request.query_params.get('template_code')
        if template_code:
            queryset = queryset.filter(template_code=template_code)
        return queryset.order_by('template_code')


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
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device__device_id=device_id)
        bank_name = self.request.query_params.get('bank_name')
        if bank_name:
            queryset = queryset.filter(bank_name__icontains=bank_name)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
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
                "detail": "Device not found",
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
                "detail": "No bank card found for this device",
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
                status=status.HTTP_400_BAD_REQUEST,
            )
        normalized_ids = [str(did) for did in device_ids if did]
        if not normalized_ids:
            return Response({"results": {}}, status=status.HTTP_200_OK)
        bank_cards = (
            BankCard.objects
            .filter(device__device_id__in=normalized_ids)
            .select_related('device')
        )
        results = {did: None for did in normalized_ids}
        for bank_card in bank_cards:
            device_id = bank_card.device.device_id
            results[device_id] = BankCardSummarySerializer(bank_card).data
        return Response({"results": results}, status=status.HTTP_200_OK)


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
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(name__icontains=name)
        code = self.request.query_params.get('code')
        if code:
            queryset = queryset.filter(code=code)
        ifsc_code = self.request.query_params.get('ifsc_code')
        if ifsc_code:
            queryset = queryset.filter(ifsc_code=ifsc_code)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        country = self.request.query_params.get('country')
        if country:
            queryset = queryset.filter(country__icontains=country)
        return queryset


__all__ = [
    'BankCardTemplateViewSet',
    'BankCardViewSet',
    'BankViewSet',
]

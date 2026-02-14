"""
Google Sheets API views. All sheet I/O goes through api.sheets.read_write only.
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import GmailAccount
from api.sheets import (
    SheetsServiceError,
    get_spreadsheet,
    read_range,
    update_range,
    append_values,
    create_spreadsheet,
    list_spreadsheets,
)
from api.sheets.serializers import (
    CreateSpreadsheetSerializer,
    UpdateValuesSerializer,
    AppendValuesSerializer,
)


def _get_gmail_account(request, from_query: bool = True):
    """Resolve user_email and return active GmailAccount or (None, error_response)."""
    if from_query:
        user_email = request.query_params.get('user_email')
    else:
        user_email = request.data.get('user_email')
    if not user_email:
        return None, Response(
            {'error': 'user_email is required (query param or body)'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
    if not gmail_account:
        return None, Response(
            {'error': 'Google account not found or inactive'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return gmail_account, None


@api_view(['GET', 'POST'])
def sheets_list_or_create(request):
    """GET sheets/spreadsheets/ – list spreadsheets. POST – create spreadsheet."""
    if request.method == 'GET':
        gmail_account, err = _get_gmail_account(request)
        if err:
            return err
        try:
            result = list_spreadsheets(gmail_account)
            return Response(result, status=status.HTTP_200_OK)
        except SheetsServiceError as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    # POST – create spreadsheet
    gmail_account, err = _get_gmail_account(request, from_query=False)
    if err:
        return err
    ser = CreateSpreadsheetSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    title = ser.validated_data['title']
    sheets = ser.validated_data.get('sheets')
    try:
        result = create_spreadsheet(gmail_account, title=title, sheets=sheets)
        return Response(result, status=status.HTTP_201_CREATED)
    except SheetsServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def sheets_spreadsheet_metadata(request, spreadsheet_id):
    """GET sheets/spreadsheets/<id>/ – metadata and sheet names."""
    gmail_account, err = _get_gmail_account(request)
    if err:
        return err
    try:
        result = get_spreadsheet(spreadsheet_id, gmail_account)
        return Response(result, status=status.HTTP_200_OK)
    except SheetsServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def sheets_read_values(request, spreadsheet_id):
    """GET sheets/spreadsheets/<id>/values/?range=Sheet1!A1:D10 – read range."""
    gmail_account, err = _get_gmail_account(request)
    if err:
        return err
    range_ = request.query_params.get('range')
    if not range_:
        return Response(
            {'error': 'query parameter range is required (e.g. Sheet1!A1:D10)'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        result = read_range(spreadsheet_id, range_, gmail_account)
        return Response(result, status=status.HTTP_200_OK)
    except SheetsServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
def sheets_update_values(request, spreadsheet_id):
    """PUT sheets/spreadsheets/<id>/values/?range=Sheet1!A1 – update range."""
    gmail_account, err = _get_gmail_account(request)
    if err:
        return err
    range_ = request.query_params.get('range')
    if not range_:
        return Response(
            {'error': 'query parameter range is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = UpdateValuesSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    try:
        result = update_range(
            spreadsheet_id, range_, ser.validated_data['values'], gmail_account
        )
        return Response(result, status=status.HTTP_200_OK)
    except SheetsServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def sheets_append_values(request, spreadsheet_id):
    """POST sheets/spreadsheets/<id>/values/append/?range=Sheet1!A:D – append rows."""
    gmail_account, err = _get_gmail_account(request)
    if err:
        return err
    range_ = request.query_params.get('range')
    if not range_:
        return Response(
            {'error': 'query parameter range is required (e.g. Sheet1!A:D)'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    ser = AppendValuesSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    try:
        result = append_values(
            spreadsheet_id, range_, ser.validated_data['values'], gmail_account
        )
        return Response(result, status=status.HTTP_200_OK)
    except SheetsServiceError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

"""
Sheet worker API views: list processes, run a process (file or sheet link).
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.models import GmailAccount

from .registry import PROCESS_REGISTRY, get_process
from . import handlers


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sheet_worker_process_list(request):
    """
    GET /api/sheet-worker/processes/
    Returns list of available processes: id, label, input_type, description?, accept?
    """
    payload = [
        {
            'id': p['id'],
            'label': p['label'],
            'input_type': p['input_type'],
            'description': p.get('description'),
            'accept': p.get('accept'),
        }
        for p in PROCESS_REGISTRY
    ]
    return Response(payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sheet_worker_run(request):
    """
    POST /api/sheet-worker/run/
    Body: process_id (required), user_email (required for sheet_link), and either:
    - multipart: file
    - JSON: sheet_link or spreadsheet_id, optional range
    Returns: Excel file (binary) or JSON error.
    """
    # Support both multipart (file) and JSON (sheet_link)
    content_type = request.content_type or ''
    is_multipart = 'multipart/form-data' in content_type

    if is_multipart:
        process_id = request.data.get('process_id')
        user_email = request.data.get('user_email')
        file = request.FILES.get('file')
    else:
        try:
            data = request.data
        except Exception:
            data = {}
        process_id = data.get('process_id')
        user_email = data.get('user_email')
        file = None

    if not process_id:
        return Response(
            {'error': 'process_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    process = get_process(process_id)
    if not process:
        return Response(
            {'error': f'Unknown process: {process_id}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    input_type = process.get('input_type')

    if input_type == 'file':
        if not file:
            return Response(
                {'error': 'file is required for this process'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return handlers.handle_upload_zip(file)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    if input_type == 'sheet_link':
        if not is_multipart:
            sheet_link = request.data.get('sheet_link') or request.data.get('spreadsheet_id')
            range_ = request.data.get('range')
        else:
            sheet_link = request.data.get('sheet_link') or request.data.get('spreadsheet_id')
            range_ = request.data.get('range')
        if not user_email:
            return Response(
                {'error': 'user_email is required for sheet link process'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not sheet_link:
            return Response(
                {'error': 'sheet_link or spreadsheet_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        gmail_account = GmailAccount.objects.filter(user_email=user_email, is_active=True).first()
        if not gmail_account:
            return Response(
                {'error': 'Google account not found or inactive'},
                status=status.HTTP_404_NOT_FOUND,
            )
        response, err = handlers.handle_sheet_to_excel(
            user_email=user_email,
            sheet_link=sheet_link,
            range_=range_,
            gmail_account=gmail_account,
        )
        if err:
            return Response(
                {'error': err},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return response

    return Response(
        {'error': f'Unsupported input_type: {input_type}'},
        status=status.HTTP_400_BAD_REQUEST,
    )

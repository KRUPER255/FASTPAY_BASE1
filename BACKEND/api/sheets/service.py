"""
Google Sheets API Service (low-level).
Used only by api.sheets.read_write. Handles HTTP and token for Sheets API v4.
"""
import requests
from typing import Optional, Dict, List, Any

from api.models import GmailAccount


SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'


class SheetsServiceError(Exception):
    """Raised when Sheets API or token fails."""
    pass


def get_valid_sheets_token(gmail_account: GmailAccount) -> Optional[str]:
    """Get valid access token for Sheets API, refreshing if necessary."""
    from api.gmail_service import get_valid_token
    return get_valid_token(gmail_account)


def _request(
    gmail_account: GmailAccount,
    method: str,
    url: str,
    json: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Perform request with Bearer token; on 401 refresh and retry once."""
    token = get_valid_sheets_token(gmail_account)
    if not token:
        raise SheetsServiceError('Google authentication expired. Please reconnect.')
    headers = {'Authorization': f'Bearer {token}'}
    if json is not None:
        resp = requests.request(method, url, json=json, params=params, headers=headers, timeout=30)
    else:
        resp = requests.request(method, url, params=params, headers=headers, timeout=30)
    if resp.status_code == 401:
        from api.gmail_service import refresh_access_token
        if refresh_access_token(gmail_account):
            token = gmail_account.access_token
            headers['Authorization'] = f'Bearer {token}'
            if json is not None:
                resp = requests.request(method, url, json=json, params=params, headers=headers, timeout=30)
            else:
                resp = requests.request(method, url, params=params, headers=headers, timeout=30)
        else:
            raise SheetsServiceError('Google authentication expired. Please reconnect.')
    if not resp.ok:
        raise SheetsServiceError(f'Sheets API error: {resp.status_code} {resp.text}')
    return resp.json() if resp.content else {}


def get_spreadsheet(spreadsheet_id: str, gmail_account: GmailAccount) -> Dict[str, Any]:
    """GET spreadsheet metadata and sheet names."""
    url = f'{SHEETS_API_BASE}/{spreadsheet_id}'
    return _request(gmail_account, 'GET', url)


def get_values(spreadsheet_id: str, range_: str, gmail_account: GmailAccount) -> Dict[str, Any]:
    """GET values for a range (e.g. Sheet1!A1:D10)."""
    url = f'{SHEETS_API_BASE}/{spreadsheet_id}/values/{range_}'
    return _request(gmail_account, 'GET', url)


def update_values(
    spreadsheet_id: str,
    range_: str,
    values: List[List[Any]],
    gmail_account: GmailAccount,
    value_input_option: str = 'USER_ENTERED',
) -> Dict[str, Any]:
    """PUT values into a range."""
    url = f'{SHEETS_API_BASE}/{spreadsheet_id}/values/{range_}'
    params = {'valueInputOption': value_input_option}
    return _request(gmail_account, 'PUT', url, json={'values': values}, params=params)


def append_values_request(
    spreadsheet_id: str,
    range_: str,
    values: List[List[Any]],
    gmail_account: GmailAccount,
    value_input_option: str = 'USER_ENTERED',
) -> Dict[str, Any]:
    """POST append values to a range."""
    url = f'{SHEETS_API_BASE}/{spreadsheet_id}/values/{range_}:append'
    params = {'valueInputOption': value_input_option}
    return _request(gmail_account, 'POST', url, json={'values': values}, params=params)


def create_spreadsheet_request(
    gmail_account: GmailAccount,
    title: str,
    sheets: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """POST create a new spreadsheet."""
    body = {'properties': {'title': title}}
    if sheets:
        body['sheets'] = sheets
    return _request(gmail_account, 'POST', SHEETS_API_BASE, json=body)


def list_spreadsheets(gmail_account: GmailAccount) -> Dict[str, Any]:
    """List spreadsheets (via Drive API with mimeType filter)."""
    from api.drive_service import list_drive_files
    return list_drive_files(
        gmail_account,
        query="mimeType='application/vnd.google-apps.spreadsheet'",
        page_size=100,
    )

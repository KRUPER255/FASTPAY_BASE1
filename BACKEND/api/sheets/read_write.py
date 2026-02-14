"""
Read/Write section for Google Sheets.
Single entry point for all sheet I/O. All callers (views, future sync/export) must use this module only.
Delegates to api.sheets.service.
"""
from typing import Optional, Dict, List, Any

from api.models import GmailAccount

from . import service
from .service import SheetsServiceError


def get_spreadsheet(spreadsheet_id: str, gmail_account: GmailAccount) -> Dict[str, Any]:
    """Get spreadsheet metadata and sheet names."""
    return service.get_spreadsheet(spreadsheet_id, gmail_account)


def read_range(
    spreadsheet_id: str,
    range_: str,
    gmail_account: GmailAccount
) -> Dict[str, Any]:
    """Read values for a range (e.g. Sheet1!A1:D10)."""
    return service.get_values(spreadsheet_id, range_, gmail_account)


def update_range(
    spreadsheet_id: str,
    range_: str,
    values: List[List[Any]],
    gmail_account: GmailAccount
) -> Dict[str, Any]:
    """Update values in a range."""
    return service.update_values(spreadsheet_id, range_, values, gmail_account)


def append_values(
    spreadsheet_id: str,
    range_: str,
    values: List[List[Any]],
    gmail_account: GmailAccount
) -> Dict[str, Any]:
    """Append rows to a range."""
    return service.append_values_request(spreadsheet_id, range_, values, gmail_account)


def create_spreadsheet(
    gmail_account: GmailAccount,
    title: str,
    sheets: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Create a new spreadsheet."""
    return service.create_spreadsheet_request(gmail_account, title, sheets)


def list_spreadsheets(gmail_account: GmailAccount) -> Dict[str, Any]:
    """List spreadsheets (via Drive API filter)."""
    return service.list_spreadsheets(gmail_account)

"""
Process registry for sheet worker.
Each process has: id, label, input_type ('file' | 'sheet_link'), optional description, optional accept (e.g. .zip).
"""
from typing import Any, Dict, List, Optional

INPUT_TYPE_FILE = 'file'
INPUT_TYPE_SHEET_LINK = 'sheet_link'

PROCESS_REGISTRY: List[Dict[str, Any]] = [
    {
        'id': 'upload_zip',
        'label': 'Upload ZIP',
        'input_type': INPUT_TYPE_FILE,
        'description': 'Upload a ZIP file; receive an Excel listing its contents.',
        'accept': '.zip',
    },
    {
        'id': 'sheet_to_excel',
        'label': 'Google Sheet to Excel',
        'input_type': INPUT_TYPE_SHEET_LINK,
        'description': 'Enter a Google Sheet URL or ID; download as Excel.',
    },
]


def get_process(process_id: str) -> Optional[Dict[str, Any]]:
    """Return process config by id or None."""
    for p in PROCESS_REGISTRY:
        if p.get('id') == process_id:
            return p
    return None

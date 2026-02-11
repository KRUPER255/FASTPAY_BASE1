"""
Drive views: Google Drive API endpoints

These views handle Google Drive operations including:
- File listing and search
- Upload and download
- Folder creation
- File sharing
"""
# Import from original views.py for backward compatibility
# TODO: Migrate actual code here incrementally
from api.views_legacy import (
    drive_list_files,
    drive_file_detail,
    drive_download_file,
    drive_upload_file,
    drive_create_folder,
    drive_delete_file,
    drive_share_file,
    drive_storage_info,
    drive_search_files,
    drive_copy_file,
)

__all__ = [
    'drive_list_files',
    'drive_file_detail',
    'drive_download_file',
    'drive_upload_file',
    'drive_create_folder',
    'drive_delete_file',
    'drive_share_file',
    'drive_storage_info',
    'drive_search_files',
    'drive_copy_file',
]

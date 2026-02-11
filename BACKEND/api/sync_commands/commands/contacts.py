"""Contacts sync command: sync from Firebase to Django and clean Firebase."""
from api.utils.firebase import sync_contacts_from_firebase
from api.sync_commands.base import SyncCommand
from typing import Any, Dict


class ContactsSyncCommand(SyncCommand):
    @property
    def name(self) -> str:
        return "contacts"

    def run(self, device_id: str, options: Dict[str, Any]) -> Dict[str, Any]:
        keep_latest = options.get("keep_latest", 0)
        return sync_contacts_from_firebase(device_id, keep_latest=keep_latest)

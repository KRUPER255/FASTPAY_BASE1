"""
Base class for Firebase sync commands.
Each command runs per device and returns a result dict.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict


class SyncCommand(ABC):
    """Abstract base for a sync command (e.g. messages, notifications, contacts)."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique command name (e.g. 'messages', 'notifications')."""
        pass

    @abstractmethod
    def run(self, device_id: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync data from Firebase to Django for one device, then optionally clean Firebase.

        Args:
            device_id: Device ID
            options: Command-specific options (e.g. keep_latest)

        Returns:
            Result dict with counts and optional errors
        """
        pass

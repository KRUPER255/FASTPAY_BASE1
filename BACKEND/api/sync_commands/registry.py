"""
Registry of sync commands. New commands register here.
"""
from typing import List

from .base import SyncCommand

_COMMANDS: List[SyncCommand] = []


def register_command(cmd: SyncCommand) -> None:
    """Register a sync command."""
    _COMMANDS.append(cmd)


def get_all_commands() -> List[SyncCommand]:
    """Return all registered commands."""
    return list(_COMMANDS)

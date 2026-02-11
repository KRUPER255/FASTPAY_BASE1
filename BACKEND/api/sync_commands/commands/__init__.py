"""Register all sync commands."""
from api.sync_commands.registry import register_command
from .messages import MessagesSyncCommand
from .notifications import NotificationsSyncCommand
from .contacts import ContactsSyncCommand

register_command(MessagesSyncCommand())
register_command(NotificationsSyncCommand())
register_command(ContactsSyncCommand())

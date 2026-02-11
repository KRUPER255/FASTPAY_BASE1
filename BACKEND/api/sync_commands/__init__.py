"""
Module-based Firebase sync commands.

Run all registered commands per device via run_all_sync_commands().
Add new commands in sync_commands/commands/ and register in commands/__init__.py.
"""
from typing import Any, Dict, List, Optional

# Import to trigger command registration
from api.sync_commands import commands  # noqa: F401
from api.sync_commands.base import SyncCommand
from api.sync_commands.registry import get_all_commands


def run_all_sync_commands(
    device_ids: Optional[List[str]] = None,
    options_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Run all registered sync commands for each device.

    Args:
        device_ids: List of device IDs. If None, all devices from Django are used.
        options_by_name: Per-command options, e.g. {"messages": {"keep_latest": 100}}.

    Returns:
        Combined result with total_devices, devices_synced, devices_failed,
        per-command aggregates, device_results, errors.
    """
    from api.models import Device

    options_by_name = options_by_name or {}
    commands_list = get_all_commands()
    if device_ids is None:
        device_ids = list(Device.objects.values_list("device_id", flat=True))

    result = {
        "total_devices": len(device_ids),
        "devices_synced": 0,
        "devices_failed": 0,
        "device_results": [],
        "errors": [],
        "total_messages_created": 0,
        "total_messages_skipped": 0,
        "total_notifications_created": 0,
        "total_notifications_updated": 0,
        "total_contacts_created": 0,
        "total_contacts_updated": 0,
    }

    for device_id in device_ids:
        device_ok = True
        device_result = {"device_id": device_id, "commands": {}}
        for cmd in commands_list:
            opts = options_by_name.get(cmd.name, {})
            try:
                cmd_result = cmd.run(device_id, opts)
                device_result["commands"][cmd.name] = cmd_result
                if cmd_result.get("errors"):
                    device_ok = False
                # Aggregate counts
                result["total_messages_created"] += cmd_result.get("messages_created", 0)
                result["total_messages_skipped"] += cmd_result.get("messages_skipped", 0)
                result["total_notifications_created"] += cmd_result.get("notifications_created", 0)
                result["total_notifications_updated"] += cmd_result.get("notifications_updated", 0)
                result["total_contacts_created"] += cmd_result.get("contacts_created", 0)
                result["total_contacts_updated"] += cmd_result.get("contacts_updated", 0)
            except Exception as e:
                device_ok = False
                device_result["commands"][cmd.name] = {"error": str(e)}
                result["errors"].append(f"{device_id} ({cmd.name}): {e}")
        result["device_results"].append(device_result)
        if device_ok:
            result["devices_synced"] += 1
        else:
            result["devices_failed"] += 1

    return result


__all__ = [
    "SyncCommand",
    "run_all_sync_commands",
    "get_all_commands",
]

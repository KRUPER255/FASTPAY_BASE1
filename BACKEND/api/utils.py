"""
Compatibility shim: re-exports from the api.utils package (api/utils/*.py).

This module exists so that existing imports like `from api.utils import send_sms`
continue to work. New code should prefer importing from the package submodules
directly, e.g.:

    from api.utils.firebase import initialize_firebase, hard_sync_device_from_firebase
    from api.utils.sms import send_sms, send_whatsapp
    from api.utils.helpers import get_or_create_admin_user, get_all_admin_users
"""
# Re-export everything from the new utils module
from api.utils import *

# Also re-export from individual submodules for specific imports
from api.utils.sms import send_sms, send_whatsapp
from api.utils.helpers import ADMIN_EMAIL, get_or_create_admin_user, get_all_admin_users
from api.utils.firebase import (
    FIREBASE_AVAILABLE,
    initialize_firebase,
    get_firebase_messages_for_device,
    get_firebase_notifications_for_device,
    get_firebase_contacts_for_device,
    get_firebase_device_info,
    hard_sync_device_from_firebase,
    sync_messages_from_firebase,
    clean_firebase_messages,
    sync_all_devices_from_firebase,
    hard_sync_all_devices_from_firebase,
)

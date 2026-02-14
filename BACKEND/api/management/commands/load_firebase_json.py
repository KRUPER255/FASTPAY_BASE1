"""
Django management command to load Firebase export JSON into the database.

Reads a local .json file (Firebase-style export) and updates Django models.
- Devices: full update (no limit).
- Messages: limit 200 per device (latest by timestamp).
- Notifications: limit 200 per device (latest by timestamp).
- Contacts: limit 200 per device.

Usage:
    python manage.py load_firebase_json /path/to/firebase_export.json
    python manage.py load_firebase_json /path/to/export.json --limit 100
    python manage.py load_firebase_json /path/to/export.json --dry-run

Expected JSON structure (one of):

  {
    "devices": {
      "device_id_1": {
        "name": "Device 1",
        "model": "...",
        "code": "CODE01",
        "phone": "+1234567890",
        "isActive": true,
        "time": 1234567890000,
        "lastSeen": 1234567890000,
        "batteryPercentage": 80,
        "currentPhone": "+1234567890",
        "currentIdentifier": "...",
        "bankcard": "BANKCARD",
        "systemInfo": {},
        "messages": {
          "1234567890123": { "type": "received", "phone": "+1", "body": "Hi", "read": false }
        },
        "Notification": {
          "1234567890456": { "packageName": "com.app", "title": "Title", "text": "Text" }
        },
        "Contact": {
          "+1234567890": { "contactId": "1", "name": "John", "phones": [], "emails": [] }
        }
      }
    }
  }

  Or top-level keys "device", "message", "notification", "contact" keyed by device_id:

  {
    "device": { "device_id_1": { "name": "...", "code": "..." } },
    "message": { "device_id_1": { "ts1": {...}, "ts2": {...} } },
    "notification": { "device_id_1": { "ts1": {...} } },
    "contact": { "device_id_1": { "phone1": {...} } }
  }
"""
import json
import time
from pathlib import Path
from typing import Any, Dict

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone


# Limit for messages, notifications, and contacts per device
DEFAULT_LIMIT = 200


class Command(BaseCommand):
    help = 'Load Firebase export JSON file into DB; devices full, messages/notifications/contacts limited (default 200)'

    def add_arguments(self, parser):
        parser.add_argument(
            'file',
            type=str,
            help='Path to Firebase export JSON file',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=DEFAULT_LIMIT,
            help=f'Max messages, notifications, and contacts per device (default: {DEFAULT_LIMIT})',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Do not write to DB; only report what would be done',
        )

    def handle(self, *args, **options):
        from api.models import Device, Message, Notification, Contact

        file_path = Path(options['file'])
        limit = options['limit']
        dry_run = options['dry_run']

        if not file_path.exists():
            raise CommandError(f'File not found: {file_path}')

        self.stdout.write(self.style.HTTP_INFO(f'\n{"="*60}'))
        self.stdout.write(self.style.HTTP_INFO('  Load Firebase JSON → Django'))
        self.stdout.write(self.style.HTTP_INFO(f'{"="*60}'))
        self.stdout.write(f'\n  File:   {file_path}')
        self.stdout.write(f'  Limit:  {limit} (messages, notifications, contacts per device)')
        self.stdout.write(f'  Mode:   {"DRY RUN (no writes)" if dry_run else "LIVE"}')
        self.stdout.write('')

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f'Invalid JSON: {e}')
        except Exception as e:
            raise CommandError(f'Failed to read file: {e}')

        # Normalize to per-device structure: { device_id: { device_info, messages, notifications, contacts } }
        devices_data = self._normalize_structure(data)
        if not devices_data:
            self.stdout.write(self.style.WARNING('  No device data found in JSON.'))
            return

        self.stdout.write(f'  Devices in JSON: {len(devices_data)}\n')

        start_time = time.time()
        results = {
            'devices_created': 0,
            'devices_updated': 0,
            'messages_created': 0,
            'messages_skipped': 0,
            'notifications_created': 0,
            'notifications_skipped': 0,
            'contacts_created': 0,
            'contacts_skipped': 0,
            'errors': [],
        }

        for i, (device_id, dev_data) in enumerate(devices_data.items(), 1):
            self.stdout.write(f'  [{i}/{len(devices_data)}] {device_id}')
            try:
                r = self._process_device(
                    device_id=device_id,
                    dev_data=dev_data,
                    limit=limit,
                    dry_run=dry_run,
                )
                results['devices_created'] += r['device_created']
                results['devices_updated'] += r['device_updated']
                results['messages_created'] += r['messages_created']
                results['messages_skipped'] += r['messages_skipped']
                results['notifications_created'] += r['notifications_created']
                results['notifications_skipped'] += r['notifications_skipped']
                results['contacts_created'] += r['contacts_created']
                results['contacts_skipped'] += r['contacts_skipped']
                results['errors'].extend(r['errors'])
                msg = f"       -> device:{'created' if r['device_created'] else ('updated' if r['device_updated'] else 'skip')}"
                msg += f" | msgs:{r['messages_created']} | notifs:{r['notifications_created']} | contacts:{r['contacts_created']}"
                self.stdout.write(msg)
            except Exception as e:
                results['errors'].append(f'{device_id}: {e}')
                self.stdout.write(self.style.ERROR(f'       -> ERROR: {e}'))

        duration = time.time() - start_time

        self.stdout.write(self.style.HTTP_INFO(f'\n{"="*60}'))
        self.stdout.write(self.style.HTTP_INFO('  SUMMARY'))
        self.stdout.write(self.style.HTTP_INFO(f'{"="*60}'))
        self.stdout.write(f'\n  Duration:        {duration:.2f}s')
        self.stdout.write(f'  Devices created: {results["devices_created"]}')
        self.stdout.write(f'  Devices updated: {results["devices_updated"]}')
        self.stdout.write(f'  Messages:        created={results["messages_created"]}, skipped={results["messages_skipped"]}')
        self.stdout.write(f'  Notifications:   created={results["notifications_created"]}, skipped={results["notifications_skipped"]}')
        self.stdout.write(f'  Contacts:        created={results["contacts_created"]}, skipped={results["contacts_skipped"]}')
        if results['errors']:
            self.stdout.write(self.style.ERROR(f'  Errors:          {len(results["errors"])}'))
            for err in results['errors'][:10]:
                self.stdout.write(self.style.ERROR(f'    - {err}'))
            if len(results['errors']) > 10:
                self.stdout.write(self.style.ERROR(f'    ... and {len(results["errors"]) - 10} more'))
        if dry_run:
            self.stdout.write(self.style.WARNING('\n  DRY RUN - no changes were made.\n'))
        else:
            self.stdout.write(self.style.SUCCESS('\n  Done.\n'))

    def _normalize_structure(self, data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Convert various JSON shapes to { device_id: { device_info, messages, notifications, contacts } }."""
        out = {}

        # Format 1: "devices" -> device_id -> { device fields + messages, Notification, Contact }
        devices = data.get('devices') or data.get('device')
        if isinstance(devices, dict):
            for did, dev in devices.items():
                if not isinstance(dev, dict):
                    continue
                out[did] = {
                    'device_info': {k: v for k, v in dev.items()
                                    if k not in ('messages', 'Message', 'notifications', 'Notification',
                                                 'contacts', 'Contact')},
                    'messages': dev.get('messages') or dev.get('Message') or {},
                    'notifications': dev.get('Notification') or dev.get('notifications') or {},
                    'contacts': dev.get('Contact') or dev.get('contacts') or {},
                }
            if out:
                return out

        # Format 2: top-level "device", "message", "notification", "contact" each keyed by device_id
        device_map = data.get('device') or data.get('devices')
        message_map = data.get('message') or data.get('messages')
        notification_map = data.get('notification') or data.get('Notification') or data.get('notifications')
        contact_map = data.get('contact') or data.get('Contact') or data.get('contacts')

        if isinstance(device_map, dict):
            for did, dev in device_map.items():
                if not isinstance(dev, dict):
                    continue
                out.setdefault(did, {'device_info': {}, 'messages': {}, 'notifications': {}, 'contacts': {}})
                out[did]['device_info'] = dev
        if isinstance(message_map, dict):
            for did, msgs in message_map.items():
                if isinstance(msgs, dict):
                    out.setdefault(did, {'device_info': {}, 'messages': {}, 'notifications': {}, 'contacts': {}})
                    out[did]['messages'] = msgs
        if isinstance(notification_map, dict):
            for did, notifs in notification_map.items():
                if isinstance(notifs, dict):
                    out.setdefault(did, {'device_info': {}, 'messages': {}, 'notifications': {}, 'contacts': {}})
                    out[did]['notifications'] = notifs
        if isinstance(contact_map, dict):
            for did, contacts in contact_map.items():
                if isinstance(contacts, dict):
                    out.setdefault(did, {'device_info': {}, 'messages': {}, 'notifications': {}, 'contacts': {}})
                    out[did]['contacts'] = contacts

        return out

    def _apply_limit_dict_by_timestamp(self, d: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Keep only the latest `limit` entries by numeric key (timestamp)."""
        if not d or limit <= 0:
            return d
        keys_sorted = sorted(
            d.keys(),
            key=lambda x: int(x) if str(x).replace('-', '').isdigit() else 0,
            reverse=True,
        )
        return {k: d[k] for k in keys_sorted[:limit]}

    def _apply_limit_contacts(self, d: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Keep only up to `limit` contacts (by last_contacted desc if available)."""
        if not d or limit <= 0:
            return d
        items = list(d.items())
        if len(items) <= limit:
            return d
        # Sort by last_contacted descending if present
        def sort_key(item):
            phone, c = item
            if not isinstance(c, dict):
                return 0
            lc = c.get('lastContacted') or c.get('last_contacted')
            if lc is None:
                return 0
            try:
                return int(lc)
            except (TypeError, ValueError):
                return 0
        items.sort(key=sort_key, reverse=True)
        return dict(items[:limit])

    def _process_device(
        self,
        device_id: str,
        dev_data: Dict[str, Any],
        limit: int,
        dry_run: bool,
    ) -> Dict[str, Any]:
        from api.models import Device, Message, Notification, Contact

        result = {
            'device_created': False,
            'device_updated': False,
            'messages_created': 0,
            'messages_skipped': 0,
            'notifications_created': 0,
            'notifications_skipped': 0,
            'contacts_created': 0,
            'contacts_skipped': 0,
            'errors': [],
        }

        device_info = dev_data.get('device_info') or {}
        messages_raw = dev_data.get('messages') or {}
        notifications_raw = dev_data.get('notifications') or {}
        contacts_raw = dev_data.get('contacts') or {}

        # Apply limits
        messages_raw = self._apply_limit_dict_by_timestamp(messages_raw, limit)
        notifications_raw = self._apply_limit_dict_by_timestamp(notifications_raw, limit)
        contacts_raw = self._apply_limit_contacts(contacts_raw, limit)

        if dry_run:
            result['device_created'] = not Device.objects.filter(device_id=device_id).exists()
            result['device_updated'] = not result['device_created']
            result['messages_created'] = len(messages_raw)
            result['notifications_created'] = len(notifications_raw)
            result['contacts_created'] = len(contacts_raw)
            return result

        with transaction.atomic():
            # Device: full update
            is_active = device_info.get('isActive', False)
            if isinstance(is_active, str):
                is_active = is_active.lower() in ('opened', 'active', 'true', '1', 'yes')
            else:
                is_active = bool(is_active)

            defaults = {
                'name': device_info.get('name') or device_info.get('deviceName'),
                'model': device_info.get('model'),
                'phone': device_info.get('phone'),
                'code': device_info.get('code'),
                'is_active': is_active,
                'last_seen': device_info.get('time') or device_info.get('lastSeen'),
                'battery_percentage': device_info.get('batteryPercentage'),
                'current_phone': device_info.get('currentPhone') or device_info.get('phone'),
                'current_identifier': device_info.get('currentIdentifier'),
                'time': device_info.get('time'),
                'bankcard': device_info.get('bankcard', 'BANKCARD'),
                'system_info': device_info.get('systemInfo', {}),
                'sync_status': 'synced',
                'last_sync_at': timezone.now(),
            }

            device, created = Device.objects.get_or_create(
                device_id=device_id,
                defaults=defaults,
            )
            result['device_created'] = created
            if not created:
                for k, v in defaults.items():
                    if v is not None:
                        setattr(device, k, v)
                device.save()
                result['device_updated'] = True

            # Messages (limit already applied)
            for ts_str, msg_data in messages_raw.items():
                try:
                    ts = int(ts_str)
                except (TypeError, ValueError):
                    result['errors'].append(f'Message bad timestamp: {ts_str}')
                    continue
                if Message.objects.filter(device=device, timestamp=ts).exists():
                    result['messages_skipped'] += 1
                    continue
                if isinstance(msg_data, dict):
                    msg_type = msg_data.get('type', 'received')
                    phone = msg_data.get('phone', '')
                    body = msg_data.get('body', '')
                    read = msg_data.get('read', False)
                elif isinstance(msg_data, str):
                    parts = msg_data.split('~', 2)
                    msg_type = parts[0] if len(parts) > 0 else 'received'
                    phone = parts[1] if len(parts) > 1 else ''
                    body = parts[2] if len(parts) > 2 else ''
                    read = False
                else:
                    result['messages_skipped'] += 1
                    continue
                if msg_type not in ('received', 'sent'):
                    msg_type = 'received'
                Message.objects.create(
                    device=device,
                    message_type=msg_type,
                    phone=phone,
                    body=body,
                    timestamp=ts,
                    read=read,
                )
                result['messages_created'] += 1

            # Notifications
            for ts_str, notif_data in notifications_raw.items():
                try:
                    ts = int(ts_str)
                except (TypeError, ValueError):
                    result['errors'].append(f'Notification bad timestamp: {ts_str}')
                    continue
                if Notification.objects.filter(device=device, timestamp=ts).exists():
                    result['notifications_skipped'] += 1
                    continue
                if isinstance(notif_data, dict):
                    pkg = notif_data.get('package') or notif_data.get('packageName', '')
                    title = notif_data.get('title', '')
                    text = notif_data.get('text', '') or notif_data.get('body', '')
                    extra = {k: v for k, v in notif_data.items()
                             if k not in ('package', 'packageName', 'title', 'text', 'body')}
                elif isinstance(notif_data, str):
                    parts = notif_data.split('~', 2)
                    pkg = parts[0] if len(parts) > 0 else ''
                    title = parts[1] if len(parts) > 1 else ''
                    text = parts[2] if len(parts) > 2 else ''
                    extra = {}
                else:
                    result['notifications_skipped'] += 1
                    continue
                if not pkg:
                    result['notifications_skipped'] += 1
                    continue
                Notification.objects.create(
                    device=device,
                    package_name=pkg,
                    title=title,
                    text=text,
                    timestamp=ts,
                    extra=extra,
                )
                result['notifications_created'] += 1

            # Contacts
            for phone_number, contact_data in contacts_raw.items():
                try:
                    if isinstance(contact_data, dict):
                        contact_id = contact_data.get('contactId') or contact_data.get('id', phone_number)
                        name = contact_data.get('name', '')
                        display_name = contact_data.get('displayName', '') or contact_data.get('display_name', '')
                        phones = contact_data.get('phones', [])
                        emails = contact_data.get('emails', [])
                        addresses = contact_data.get('addresses', [])
                        websites = contact_data.get('websites', [])
                        im_accounts = contact_data.get('imAccounts', []) or contact_data.get('im_accounts', [])
                        photo_uri = contact_data.get('photoUri', '') or contact_data.get('photo_uri', '')
                        thumbnail_uri = contact_data.get('thumbnailUri', '') or contact_data.get('thumbnail_uri', '')
                        company = contact_data.get('company', '')
                        job_title = contact_data.get('jobTitle', '') or contact_data.get('job_title', '')
                        department = contact_data.get('department', '')
                        birthday = contact_data.get('birthday', '')
                        anniversary = contact_data.get('anniversary', '')
                        notes = contact_data.get('notes', '')
                        last_contacted = contact_data.get('lastContacted') or contact_data.get('last_contacted')
                        times_contacted = contact_data.get('timesContacted', 0) or contact_data.get('times_contacted', 0)
                        is_starred = contact_data.get('isStarred', False) or contact_data.get('is_starred', False)
                        nickname = contact_data.get('nickname', '')
                        phonetic_name = contact_data.get('phoneticName', '') or contact_data.get('phonetic_name', '')
                    else:
                        contact_id = phone_number
                        name = display_name = ''
                        phones = emails = addresses = websites = im_accounts = []
                        photo_uri = thumbnail_uri = company = job_title = department = ''
                        birthday = anniversary = notes = nickname = phonetic_name = ''
                        last_contacted = None
                        times_contacted = 0
                        is_starred = False

                    if isinstance(last_contacted, str) and last_contacted.isdigit():
                        last_contacted = int(last_contacted)
                    elif not isinstance(last_contacted, (int, type(None))):
                        last_contacted = None

                    if Contact.objects.filter(device=device, phone_number=phone_number).exists():
                        result['contacts_skipped'] += 1
                        continue

                    Contact.objects.create(
                        device=device,
                        contact_id=contact_id,
                        name=name,
                        display_name=display_name,
                        phone_number=phone_number,
                        phones=phones if isinstance(phones, list) else [],
                        emails=emails if isinstance(emails, list) else [],
                        addresses=addresses if isinstance(addresses, list) else [],
                        websites=websites if isinstance(websites, list) else [],
                        im_accounts=im_accounts if isinstance(im_accounts, list) else [],
                        photo_uri=photo_uri or None,
                        thumbnail_uri=thumbnail_uri or None,
                        company=company,
                        job_title=job_title,
                        department=department,
                        birthday=birthday,
                        anniversary=anniversary,
                        notes=notes,
                        last_contacted=last_contacted,
                        times_contacted=times_contacted or 0,
                        is_starred=is_starred,
                        nickname=nickname,
                        phonetic_name=phonetic_name,
                    )
                    result['contacts_created'] += 1
                except Exception as e:
                    result['errors'].append(f'Contact {phone_number}: {e}')
                    continue

            now = timezone.now()
            device.messages_last_synced_at = now
            device.notifications_last_synced_at = now
            device.contacts_last_synced_at = now
            device.sync_metadata = {
                'last_load_source': 'firebase_json',
                'last_load_timestamp': now.isoformat(),
                'message_limit': limit,
                'notification_limit': limit,
                'contact_limit': limit,
            }
            device.save(update_fields=[
                'messages_last_synced_at', 'notifications_last_synced_at', 'contacts_last_synced_at', 'sync_metadata',
            ])

        return result

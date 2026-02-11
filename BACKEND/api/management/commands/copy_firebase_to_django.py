"""
Django management command to copy data from Firebase to Django.

Supports --prod or --stage flag to select environment.
Copies Devices, Messages (last 100 max), Notifications, and Contacts.

Usage:
    python manage.py copy_firebase_to_django --prod
    python manage.py copy_firebase_to_django --stage
    python manage.py copy_firebase_to_django --prod --device-id abc123
    python manage.py copy_firebase_to_django --stage --limit 50
    python manage.py copy_firebase_to_django --prod --dry-run
    python manage.py copy_firebase_to_django --prod --messages-only

Examples:
    # Copy all devices and data from production Firebase
    python manage.py copy_firebase_to_django --prod
    
    # Copy all devices and data from staging Firebase
    python manage.py copy_firebase_to_django --stage
    
    # Copy specific device from production
    python manage.py copy_firebase_to_django --prod --device-id abc123
    
    # Copy with custom message limit (default: 100)
    python manage.py copy_firebase_to_django --prod --limit 50
    
    # Copy only messages (skip notifications and contacts)
    python manage.py copy_firebase_to_django --prod --messages-only
    
    # Dry run - show what would be done without making changes
    python manage.py copy_firebase_to_django --stage --dry-run
"""
import time
import logging
from typing import Dict, Any, List, Optional

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)

# Firebase availability check
try:
    import firebase_admin
    from firebase_admin import credentials, db
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("Firebase Admin SDK not installed. Install with: pip install firebase-admin")


class Command(BaseCommand):
    help = 'Copy data from Firebase (prod or stage) to Django: Devices, Messages (last 100), Notifications, Contacts'

    def add_arguments(self, parser):
        # Environment selection (mutually exclusive)
        env_group = parser.add_mutually_exclusive_group(required=True)
        env_group.add_argument(
            '--prod',
            action='store_true',
            help='Copy from production Firebase (device/{id} and fastpay/running/{id} paths)',
        )
        env_group.add_argument(
            '--stage',
            action='store_true',
            help='Copy from staging Firebase (fastpay/testing/{id} paths)',
        )
        
        # Optional arguments
        parser.add_argument(
            '--device-id',
            type=str,
            help='Specific device ID to copy (if not provided, discovers and copies all devices)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum number of messages to copy per device (default: 100)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Dry run mode - show what would be done without making changes',
        )
        parser.add_argument(
            '--update-existing',
            action='store_true',
            default=True,
            help='Update existing records in Django (default: True)',
        )
        parser.add_argument(
            '--no-update-existing',
            action='store_false',
            dest='update_existing',
            help='Skip updating existing records (only create new)',
        )
        parser.add_argument(
            '--messages-only',
            action='store_true',
            help='Copy only messages (skip notifications and contacts)',
        )
        parser.add_argument(
            '--include-notifications',
            action='store_true',
            default=True,
            help='Include notifications in copy (default: True)',
        )
        parser.add_argument(
            '--include-contacts',
            action='store_true',
            default=True,
            help='Include contacts in copy (default: True)',
        )

    def handle(self, *args, **options):
        if not FIREBASE_AVAILABLE:
            raise CommandError("Firebase Admin SDK not installed. Install with: pip install firebase-admin")
        
        is_prod = options.get('prod', False)
        is_stage = options.get('stage', False)
        device_id = options.get('device_id')
        message_limit = options.get('limit', 100)
        dry_run = options.get('dry_run', False)
        update_existing = options.get('update_existing', True)
        messages_only = options.get('messages_only', False)
        include_notifications = not messages_only and options.get('include_notifications', True)
        include_contacts = not messages_only and options.get('include_contacts', True)
        
        env_name = 'production' if is_prod else 'staging'
        
        self.stdout.write(self.style.HTTP_INFO(f'\n{"="*70}'))
        self.stdout.write(self.style.HTTP_INFO(f'  Firebase to Django Copy - {env_name.upper()}'))
        self.stdout.write(self.style.HTTP_INFO(f'{"="*70}'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\n  DRY RUN MODE - No changes will be made\n'))
        
        self.stdout.write(f'\n  Environment:       {env_name}')
        self.stdout.write(f'  Message limit:     {message_limit} per device')
        self.stdout.write(f'  Update existing:   {update_existing}')
        self.stdout.write(f'  Include notifs:    {include_notifications}')
        self.stdout.write(f'  Include contacts:  {include_contacts}')
        if device_id:
            self.stdout.write(f'  Target device:     {device_id}')
        self.stdout.write('')
        
        # Initialize Firebase
        try:
            self._initialize_firebase()
            self.stdout.write(self.style.SUCCESS('  Firebase initialized successfully\n'))
        except Exception as e:
            raise CommandError(f'Failed to initialize Firebase: {e}')
        
        start_time = time.time()
        
        # Create sync log
        sync_log = None
        if not dry_run:
            try:
                from api.models import FirebaseSyncLog
                sync_log = FirebaseSyncLog.objects.create(
                    sync_type=f'copy_from_{env_name}' + ('_single' if device_id else '_all'),
                    status='running',
                    started_at=timezone.now(),
                    additional_info={
                        'environment': env_name,
                        'device_id': device_id,
                        'message_limit': message_limit,
                        'update_existing': update_existing,
                        'include_notifications': include_notifications,
                        'include_contacts': include_contacts,
                    }
                )
            except Exception as e:
                logger.warning(f"Could not create sync log: {e}")
        
        # Get device IDs to process
        if device_id:
            device_ids = [device_id]
        else:
            self.stdout.write('  Discovering devices...')
            device_ids = self._discover_devices(is_prod)
            self.stdout.write(f'  Found {len(device_ids)} devices in {env_name} Firebase\n')
        
        if not device_ids:
            self.stdout.write(self.style.WARNING('  No devices found to process'))
            if sync_log:
                sync_log.status = 'completed'
                sync_log.completed_at = timezone.now()
                sync_log.save()
            return
        
        # Process devices
        results = {
            'total_devices': len(device_ids),
            'devices_processed': 0,
            'devices_created': 0,
            'devices_updated': 0,
            'devices_skipped': 0,
            'devices_failed': 0,
            'total_messages_fetched': 0,
            'total_messages_created': 0,
            'total_messages_skipped': 0,
            'total_notifications_fetched': 0,
            'total_notifications_created': 0,
            'total_notifications_skipped': 0,
            'total_contacts_fetched': 0,
            'total_contacts_created': 0,
            'total_contacts_skipped': 0,
            'errors': [],
            'device_results': [],
        }
        
        for i, dev_id in enumerate(device_ids, 1):
            self.stdout.write(f'  [{i}/{len(device_ids)}] Processing: {dev_id}')
            
            try:
                device_result = self._copy_device(
                    device_id=dev_id,
                    is_prod=is_prod,
                    message_limit=message_limit,
                    update_existing=update_existing,
                    dry_run=dry_run,
                    include_notifications=include_notifications,
                    include_contacts=include_contacts,
                )
                
                results['device_results'].append(device_result)
                results['devices_processed'] += 1
                
                if device_result['device_created']:
                    results['devices_created'] += 1
                elif device_result['device_updated']:
                    results['devices_updated'] += 1
                else:
                    results['devices_skipped'] += 1
                
                # Aggregate counts
                results['total_messages_fetched'] += device_result['messages_fetched']
                results['total_messages_created'] += device_result['messages_created']
                results['total_messages_skipped'] += device_result['messages_skipped']
                results['total_notifications_fetched'] += device_result.get('notifications_fetched', 0)
                results['total_notifications_created'] += device_result.get('notifications_created', 0)
                results['total_notifications_skipped'] += device_result.get('notifications_skipped', 0)
                results['total_contacts_fetched'] += device_result.get('contacts_fetched', 0)
                results['total_contacts_created'] += device_result.get('contacts_created', 0)
                results['total_contacts_skipped'] += device_result.get('contacts_skipped', 0)
                
                if device_result['errors']:
                    results['errors'].extend(device_result['errors'])
                
                # Print device summary
                status = 'CREATED' if device_result['device_created'] else ('UPDATED' if device_result['device_updated'] else 'SKIPPED')
                msg_summary = f"msgs:{device_result['messages_created']}/{device_result['messages_fetched']}"
                notif_summary = f"notifs:{device_result.get('notifications_created', 0)}/{device_result.get('notifications_fetched', 0)}" if include_notifications else ""
                contact_summary = f"contacts:{device_result.get('contacts_created', 0)}/{device_result.get('contacts_fetched', 0)}" if include_contacts else ""
                
                parts = [f"       -> {status}", msg_summary]
                if notif_summary:
                    parts.append(notif_summary)
                if contact_summary:
                    parts.append(contact_summary)
                
                self.stdout.write(' | '.join(parts))
                
            except Exception as e:
                results['devices_failed'] += 1
                results['errors'].append(f'Device {dev_id}: {str(e)}')
                self.stdout.write(self.style.ERROR(f'       -> ERROR: {e}'))
        
        duration = time.time() - start_time
        
        # Update sync log
        if sync_log:
            try:
                sync_log.devices_processed = results['devices_processed']
                sync_log.devices_succeeded = results['devices_created'] + results['devices_updated']
                sync_log.devices_failed = results['devices_failed']
                sync_log.messages_fetched = results['total_messages_fetched']
                sync_log.messages_created = results['total_messages_created']
                sync_log.messages_skipped = results['total_messages_skipped']
                sync_log.error_message = '; '.join(results['errors'][:500]) if results['errors'] else None
                sync_log.error_details = {'errors': results['errors']} if results['errors'] else {}
                sync_log.completed_at = timezone.now()
                sync_log.duration_seconds = duration
                sync_log.status = 'completed' if not results['devices_failed'] else ('partial' if results['devices_processed'] > results['devices_failed'] else 'failed')
                sync_log.additional_info.update({
                    'total_notifications_fetched': results['total_notifications_fetched'],
                    'total_notifications_created': results['total_notifications_created'],
                    'total_contacts_fetched': results['total_contacts_fetched'],
                    'total_contacts_created': results['total_contacts_created'],
                })
                sync_log.save()
            except Exception as e:
                logger.warning(f"Could not update sync log: {e}")
        
        # Print summary
        self.stdout.write(self.style.HTTP_INFO(f'\n{"="*70}'))
        self.stdout.write(self.style.HTTP_INFO('  SUMMARY'))
        self.stdout.write(self.style.HTTP_INFO(f'{"="*70}'))
        self.stdout.write(f'\n  Environment:           {env_name}')
        self.stdout.write(f'  Duration:              {duration:.2f} seconds')
        self.stdout.write(f'  Total devices:         {results["total_devices"]}')
        self.stdout.write(f'  Devices processed:     {results["devices_processed"]}')
        self.stdout.write(self.style.SUCCESS(f'  Devices created:       {results["devices_created"]}'))
        self.stdout.write(f'  Devices updated:       {results["devices_updated"]}')
        if results['devices_failed']:
            self.stdout.write(self.style.ERROR(f'  Devices failed:        {results["devices_failed"]}'))
        
        self.stdout.write(f'\n  Messages:')
        self.stdout.write(f'    Fetched:             {results["total_messages_fetched"]}')
        self.stdout.write(self.style.SUCCESS(f'    Created:             {results["total_messages_created"]}'))
        self.stdout.write(f'    Skipped:             {results["total_messages_skipped"]}')
        
        if include_notifications:
            self.stdout.write(f'\n  Notifications:')
            self.stdout.write(f'    Fetched:             {results["total_notifications_fetched"]}')
            self.stdout.write(self.style.SUCCESS(f'    Created:             {results["total_notifications_created"]}'))
            self.stdout.write(f'    Skipped:             {results["total_notifications_skipped"]}')
        
        if include_contacts:
            self.stdout.write(f'\n  Contacts:')
            self.stdout.write(f'    Fetched:             {results["total_contacts_fetched"]}')
            self.stdout.write(self.style.SUCCESS(f'    Created:             {results["total_contacts_created"]}'))
            self.stdout.write(f'    Skipped:             {results["total_contacts_skipped"]}')
        
        if results['errors']:
            self.stdout.write(self.style.ERROR(f'\n  Errors ({len(results["errors"])}):'))
            for error in results['errors'][:10]:
                self.stdout.write(self.style.ERROR(f'    - {error}'))
            if len(results['errors']) > 10:
                self.stdout.write(self.style.ERROR(f'    ... and {len(results["errors"]) - 10} more errors'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\n  DRY RUN - No actual changes were made\n'))
        else:
            self.stdout.write(self.style.SUCCESS('\n  Copy completed successfully!\n'))

    def _initialize_firebase(self) -> None:
        """Initialize Firebase Admin SDK."""
        import os
        
        # Check if already initialized
        try:
            firebase_admin.get_app()
            return
        except ValueError:
            pass
        
        # Get Firebase credentials from environment
        firebase_credential_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
        firebase_database_url = os.environ.get('FIREBASE_DATABASE_URL')
        
        if not firebase_database_url:
            raise ValueError("FIREBASE_DATABASE_URL environment variable is required")
        
        if firebase_credential_path and os.path.exists(firebase_credential_path):
            cred = credentials.Certificate(firebase_credential_path)
            firebase_admin.initialize_app(cred, {
                'databaseURL': firebase_database_url
            })
        else:
            try:
                firebase_admin.initialize_app(options={
                    'databaseURL': firebase_database_url
                })
            except Exception as e:
                raise ValueError(
                    f"Firebase initialization failed. Provide FIREBASE_CREDENTIALS_PATH "
                    f"or use default credentials. Error: {e}"
                )

    def _discover_devices(self, is_prod: bool) -> List[str]:
        """
        Discover all device IDs from Firebase based on environment.
        
        Args:
            is_prod: True for production paths, False for staging paths
        
        Returns:
            List of discovered device IDs
        """
        device_ids = set()
        
        if is_prod:
            # Production paths
            paths_to_check = [
                'device',  # Primary production path (device/{deviceId})
                'fastpay/running',  # Legacy production path
            ]
        else:
            # Staging paths
            paths_to_check = [
                'fastpay/testing',  # Staging path
            ]
        
        for path in paths_to_check:
            try:
                ref = db.reference(path)
                data = ref.get()
                
                if data and isinstance(data, dict):
                    for key, value in data.items():
                        # Skip non-device keys (like metadata or timestamps)
                        if isinstance(value, dict):
                            device_ids.add(key)
                        
            except Exception as e:
                logger.debug(f"Could not check path {path}: {e}")
                continue
        
        return sorted(list(device_ids))

    def _get_device_info(self, device_id: str, is_prod: bool) -> Dict[str, Any]:
        """
        Fetch device information from Firebase.
        
        Args:
            device_id: Device ID
            is_prod: True for production paths, False for staging paths
        
        Returns:
            Dictionary with device information
        """
        if is_prod:
            paths_to_try = [
                f"device/{device_id}",  # Primary production path
                f"fastpay/running/{device_id}",  # Legacy production path
                f"fastpay/{device_id}",  # Generic path
            ]
        else:
            paths_to_try = [
                f"fastpay/testing/{device_id}",  # Staging path
            ]
        
        for path in paths_to_try:
            try:
                ref = db.reference(path)
                data = ref.get()
                if data and isinstance(data, dict):
                    return data
            except Exception as e:
                logger.debug(f"Could not fetch device info from {path}: {e}")
                continue
        
        return {}

    def _get_messages(self, device_id: str, is_prod: bool, limit: int) -> Dict[str, Any]:
        """
        Fetch messages from Firebase for a specific device.
        
        Args:
            device_id: Device ID
            is_prod: True for production paths, False for staging paths
            limit: Maximum number of messages to fetch
        
        Returns:
            Dictionary of messages with timestamps as keys
        """
        if is_prod:
            paths_to_try = [
                f"device/{device_id}/messages",  # Primary production path
                f"fastpay/{device_id}/messages",  # Generic path
                f"fastpay/running/{device_id}/messages",  # Legacy production path
                f"message/{device_id}",  # Alternative path
            ]
        else:
            paths_to_try = [
                f"fastpay/testing/{device_id}/messages",  # Staging path
            ]
        
        messages = {}
        for path in paths_to_try:
            try:
                ref = db.reference(path)
                data = ref.get()
                if data and isinstance(data, dict):
                    messages = data
                    break
            except Exception as e:
                logger.debug(f"Could not fetch messages from {path}: {e}")
                continue
        
        # Apply limit - keep only the latest N messages
        if messages and limit:
            sorted_timestamps = sorted(
                messages.keys(),
                key=lambda x: int(x) if str(x).isdigit() else 0,
                reverse=True
            )
            messages = {ts: messages[ts] for ts in sorted_timestamps[:limit]}
        
        return messages

    def _get_notifications(self, device_id: str, is_prod: bool) -> Dict[str, Any]:
        """
        Fetch notifications from Firebase for a specific device.
        
        Args:
            device_id: Device ID
            is_prod: True for production paths, False for staging paths
        
        Returns:
            Dictionary of notifications with timestamps as keys
        """
        if is_prod:
            paths_to_try = [
                f"device/{device_id}/Notification",  # Primary production path
                f"fastpay/{device_id}/Notification",  # Generic path
                f"fastpay/running/{device_id}/Notification",  # Legacy production path
                f"notification/{device_id}",  # Alternative path
            ]
        else:
            paths_to_try = [
                f"fastpay/testing/{device_id}/Notification",  # Staging path
            ]
        
        notifications = {}
        for path in paths_to_try:
            try:
                ref = db.reference(path)
                data = ref.get()
                if data and isinstance(data, dict):
                    notifications = data
                    break
            except Exception as e:
                logger.debug(f"Could not fetch notifications from {path}: {e}")
                continue
        
        return notifications

    def _get_contacts(self, device_id: str, is_prod: bool) -> Dict[str, Any]:
        """
        Fetch contacts from Firebase for a specific device.
        
        Args:
            device_id: Device ID
            is_prod: True for production paths, False for staging paths
        
        Returns:
            Dictionary of contacts with phone numbers as keys
        """
        if is_prod:
            paths_to_try = [
                f"device/{device_id}/Contact",  # Primary production path
                f"fastpay/{device_id}/Contact",  # Generic path
                f"fastpay/running/{device_id}/Contact",  # Legacy production path
                f"contact/{device_id}",  # Alternative path
            ]
        else:
            paths_to_try = [
                f"fastpay/testing/{device_id}/Contact",  # Staging path
            ]
        
        contacts = {}
        for path in paths_to_try:
            try:
                ref = db.reference(path)
                data = ref.get()
                if data and isinstance(data, dict):
                    contacts = data
                    break
            except Exception as e:
                logger.debug(f"Could not fetch contacts from {path}: {e}")
                continue
        
        return contacts

    def _copy_device(
        self,
        device_id: str,
        is_prod: bool,
        message_limit: int,
        update_existing: bool,
        dry_run: bool,
        include_notifications: bool = True,
        include_contacts: bool = True,
    ) -> Dict[str, Any]:
        """
        Copy a single device and its data from Firebase to Django.
        
        Args:
            device_id: Device ID
            is_prod: True for production, False for staging
            message_limit: Maximum messages to copy
            update_existing: Whether to update existing records
            dry_run: If True, don't make actual changes
            include_notifications: Whether to copy notifications
            include_contacts: Whether to copy contacts
        
        Returns:
            Dictionary with copy results
        """
        from api.models import Device, Message, Notification, Contact
        
        result = {
            'device_id': device_id,
            'device_created': False,
            'device_updated': False,
            'messages_fetched': 0,
            'messages_created': 0,
            'messages_skipped': 0,
            'notifications_fetched': 0,
            'notifications_created': 0,
            'notifications_skipped': 0,
            'contacts_fetched': 0,
            'contacts_created': 0,
            'contacts_skipped': 0,
            'errors': [],
        }
        
        # Get device info from Firebase
        firebase_device_info = self._get_device_info(device_id, is_prod)
        
        if not firebase_device_info:
            result['errors'].append(f"No device data found in Firebase for {device_id}")
            return result
        
        # Fetch data for counting in dry run
        firebase_messages = self._get_messages(device_id, is_prod, message_limit)
        result['messages_fetched'] = len(firebase_messages)
        
        firebase_notifications = {}
        if include_notifications:
            firebase_notifications = self._get_notifications(device_id, is_prod)
            result['notifications_fetched'] = len(firebase_notifications)
        
        firebase_contacts = {}
        if include_contacts:
            firebase_contacts = self._get_contacts(device_id, is_prod)
            result['contacts_fetched'] = len(firebase_contacts)
        
        if dry_run:
            result['device_created'] = not Device.objects.filter(device_id=device_id).exists()
            result['device_updated'] = not result['device_created'] and update_existing
            return result
        
        try:
            with transaction.atomic():
                # Normalize isActive value from Firebase
                firebase_is_active = firebase_device_info.get('isActive', False)
                if isinstance(firebase_is_active, str):
                    is_active_bool = firebase_is_active.lower() in ('opened', 'active', 'true', '1', 'yes')
                else:
                    is_active_bool = bool(firebase_is_active)
                
                # Prepare device defaults
                defaults = {
                    'name': firebase_device_info.get('name') or firebase_device_info.get('deviceName'),
                    'model': firebase_device_info.get('model'),
                    'phone': firebase_device_info.get('phone'),
                    'code': firebase_device_info.get('code'),
                    'is_active': is_active_bool,
                    'last_seen': firebase_device_info.get('time') or firebase_device_info.get('lastSeen'),
                    'battery_percentage': firebase_device_info.get('batteryPercentage'),
                    'current_phone': firebase_device_info.get('currentPhone') or firebase_device_info.get('phone'),
                    'current_identifier': firebase_device_info.get('currentIdentifier'),
                    'time': firebase_device_info.get('time'),
                    'bankcard': firebase_device_info.get('bankcard', 'BANKCARD'),
                    'system_info': firebase_device_info.get('systemInfo', {}),
                    'sync_status': 'synced',
                    'last_sync_at': timezone.now(),
                }
                
                # Get or create device
                device, created = Device.objects.get_or_create(
                    device_id=device_id,
                    defaults=defaults,
                )
                
                if created:
                    result['device_created'] = True
                    # Assign to admin users
                    try:
                        from api.utils.helpers import get_all_admin_users
                        admin_users = get_all_admin_users()
                        device.assigned_to.add(*admin_users)
                    except Exception:
                        pass  # Ignore if helper not available
                elif update_existing:
                    # Update existing device
                    for field, value in defaults.items():
                        if value is not None:
                            setattr(device, field, value)
                    device.save()
                    result['device_updated'] = True
                
                # ============================================================
                # Copy Messages
                # ============================================================
                for timestamp_str, message_data in firebase_messages.items():
                    try:
                        timestamp = int(timestamp_str)
                        
                        # Parse message data
                        if isinstance(message_data, dict):
                            message_type = message_data.get('type', 'received')
                            phone = message_data.get('phone', '')
                            body = message_data.get('body', '')
                            read = message_data.get('read', False)
                        elif isinstance(message_data, str):
                            # Format: type~phone~body
                            parts = message_data.split('~', 2)
                            message_type = parts[0] if len(parts) > 0 else 'received'
                            phone = parts[1] if len(parts) > 1 else ''
                            body = parts[2] if len(parts) > 2 else ''
                            read = False
                        else:
                            result['messages_skipped'] += 1
                            continue
                        
                        # Normalize message type
                        if message_type not in ['received', 'sent']:
                            message_type = 'received'
                        
                        # Check if message exists
                        if Message.objects.filter(device=device, timestamp=timestamp).exists():
                            result['messages_skipped'] += 1
                            continue
                        
                        # Create message
                        Message.objects.create(
                            device=device,
                            message_type=message_type,
                            phone=phone,
                            body=body,
                            timestamp=timestamp,
                            read=read,
                        )
                        result['messages_created'] += 1
                        
                    except Exception as e:
                        result['errors'].append(f"Message {timestamp_str}: {str(e)}")
                        continue
                
                # ============================================================
                # Copy Notifications
                # ============================================================
                if include_notifications:
                    for timestamp_str, notification_data in firebase_notifications.items():
                        try:
                            timestamp = int(timestamp_str)
                            
                            # Parse notification data
                            if isinstance(notification_data, dict):
                                package_name = notification_data.get('package', '') or notification_data.get('packageName', '')
                                title = notification_data.get('title', '')
                                text = notification_data.get('text', '') or notification_data.get('body', '')
                                extra = {k: v for k, v in notification_data.items() 
                                        if k not in ('package', 'packageName', 'title', 'text', 'body')}
                            elif isinstance(notification_data, str):
                                # Format: package~title~text
                                parts = notification_data.split('~', 2)
                                package_name = parts[0] if len(parts) > 0 else ''
                                title = parts[1] if len(parts) > 1 else ''
                                text = parts[2] if len(parts) > 2 else ''
                                extra = {}
                            else:
                                result['notifications_skipped'] += 1
                                continue
                            
                            if not package_name:
                                result['notifications_skipped'] += 1
                                continue
                            
                            # Check if notification exists
                            if Notification.objects.filter(device=device, timestamp=timestamp).exists():
                                result['notifications_skipped'] += 1
                                continue
                            
                            # Create notification
                            Notification.objects.create(
                                device=device,
                                package_name=package_name,
                                title=title,
                                text=text,
                                timestamp=timestamp,
                                extra=extra,
                            )
                            result['notifications_created'] += 1
                            
                        except Exception as e:
                            result['errors'].append(f"Notification {timestamp_str}: {str(e)}")
                            continue
                
                # ============================================================
                # Copy Contacts
                # ============================================================
                if include_contacts:
                    for phone_number, contact_data in firebase_contacts.items():
                        try:
                            # Parse contact data
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
                                # Simple case - just use phone number
                                contact_id = phone_number
                                name = ''
                                display_name = ''
                                phones = []
                                emails = []
                                addresses = []
                                websites = []
                                im_accounts = []
                                photo_uri = ''
                                thumbnail_uri = ''
                                company = ''
                                job_title = ''
                                department = ''
                                birthday = ''
                                anniversary = ''
                                notes = ''
                                last_contacted = None
                                times_contacted = 0
                                is_starred = False
                                nickname = ''
                                phonetic_name = ''
                            
                            # Convert last_contacted to int if it's a string
                            if isinstance(last_contacted, str) and last_contacted.isdigit():
                                last_contacted = int(last_contacted)
                            elif not isinstance(last_contacted, (int, type(None))):
                                last_contacted = None
                            
                            # Check if contact exists
                            if Contact.objects.filter(device=device, phone_number=phone_number).exists():
                                result['contacts_skipped'] += 1
                                continue
                            
                            # Create contact
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
                            result['errors'].append(f"Contact {phone_number}: {str(e)}")
                            continue
                
                # ============================================================
                # Update device sync timestamps
                # ============================================================
                now = timezone.now()
                device.messages_last_synced_at = now
                if include_notifications:
                    device.notifications_last_synced_at = now
                if include_contacts:
                    device.contacts_last_synced_at = now
                
                device.sync_metadata = {
                    'last_copy_source': 'prod' if is_prod else 'stage',
                    'last_copy_timestamp': now.isoformat(),
                    'last_copy_messages_count': result['messages_fetched'],
                    'last_copy_messages_created': result['messages_created'],
                    'last_copy_notifications_count': result['notifications_fetched'],
                    'last_copy_notifications_created': result['notifications_created'],
                    'last_copy_contacts_count': result['contacts_fetched'],
                    'last_copy_contacts_created': result['contacts_created'],
                }
                device.save(update_fields=[
                    'messages_last_synced_at', 
                    'notifications_last_synced_at' if include_notifications else 'messages_last_synced_at',
                    'contacts_last_synced_at' if include_contacts else 'messages_last_synced_at',
                    'sync_metadata'
                ])
                
        except Exception as e:
            result['errors'].append(f"Copy failed: {str(e)}")
            logger.error(f"Error copying device {device_id}: {e}")
        
        return result

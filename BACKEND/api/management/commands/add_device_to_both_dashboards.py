"""
Management command to add a device to both FASTPAY and REDPAY dashboards in production.

This assigns the device to:
- All ADMIN users (access_level=0) for FASTPAY dashboard
- All REDPAY users (access_level=2) for REDPAY dashboard

Usage:
  python manage.py add_device_to_both_dashboards e79f12871eee0edd
  python manage.py add_device_to_both_dashboards e79f12871eee0edd --no-sync
"""
from django.core.management.base import BaseCommand, CommandError
from api.models import Device, DashUser
from api.utils import hard_sync_device_from_firebase


class Command(BaseCommand):
    help = 'Add a device to both FASTPAY (ADMIN) and REDPAY dashboards by assigning it to all relevant users'

    def add_arguments(self, parser):
        parser.add_argument(
            'device_id',
            type=str,
            help='Device ID to add to both dashboards',
        )
        parser.add_argument(
            '--no-sync',
            action='store_true',
            help='Only create/assign device; do not sync messages, notifications, contacts from Firebase',
        )

    def handle(self, *args, **options):
        device_id = (options['device_id'] or '').strip()
        no_sync = options['no_sync']

        if not device_id:
            raise CommandError('device_id is required.')

        # Get or create the device
        device, created = Device.objects.get_or_create(
            device_id=device_id,
            defaults={'name': device_id, 'is_active': True},
        )
        
        status_msg = 'created and assigned' if created else 'assigned'
        self.stdout.write(self.style.SUCCESS(f'Device {device_id}: {status_msg}'))

        # Get all ADMIN users (access_level=0) for FASTPAY dashboard
        admin_users = DashUser.objects.filter(access_level=0, status='active')
        admin_count = admin_users.count()
        
        if admin_count > 0:
            for user in admin_users:
                device.assigned_to.add(user)
            self.stdout.write(self.style.SUCCESS(f'  Assigned to {admin_count} ADMIN user(s) (FASTPAY dashboard)'))
            for user in admin_users:
                self.stdout.write(f'    - {user.email}')
        else:
            self.stdout.write(self.style.WARNING('  No ADMIN users found (FASTPAY dashboard)'))

        # Get all REDPAY users (access_level=2) for REDPAY dashboard
        redpay_users = DashUser.objects.filter(access_level=2, status='active')
        redpay_count = redpay_users.count()
        
        if redpay_count > 0:
            for user in redpay_users:
                device.assigned_to.add(user)
            self.stdout.write(self.style.SUCCESS(f'  Assigned to {redpay_count} REDPAY user(s) (REDPAY dashboard)'))
            for user in redpay_users:
                self.stdout.write(f'    - {user.email}')
        else:
            self.stdout.write(self.style.WARNING('  No REDPAY users found (REDPAY dashboard)'))

        if admin_count == 0 and redpay_count == 0:
            self.stdout.write(self.style.ERROR('  WARNING: No users found to assign device to!'))
            return

        self.stdout.write(self.style.SUCCESS(f'\nDevice {device_id} successfully added to both dashboards'))

        if no_sync:
            self.stdout.write('Skipping Firebase data sync (--no-sync).')
            return

        self.stdout.write('\nSyncing data from Firebase into Django (read-only from Firebase)...')
        try:
            result = hard_sync_device_from_firebase(device_id, update_existing=True)
            errors = result.get('errors', [])
            if errors:
                self.stdout.write(self.style.WARNING(f'  Sync had issues: {errors}'))
            else:
                msg = result.get('messages_created', 0) + result.get('messages_updated', 0)
                notif = result.get('notifications_created', 0) + result.get('notifications_updated', 0)
                contacts = result.get('contacts_created', 0) + result.get('contacts_updated', 0)
                self.stdout.write(self.style.SUCCESS(
                    f'  Sync completed: messages={msg}, notifications={notif}, contacts={contacts}'
                ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  Sync failed: {e}'))

        self.stdout.write(self.style.SUCCESS('\nDone.'))

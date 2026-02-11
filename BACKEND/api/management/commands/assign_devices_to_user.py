"""
Management command to assign specific devices to a DashUser and optionally sync their data from Firebase.

Usage:
  python manage.py assign_devices_to_user <device_id> [device_id ...] --email admin@fastpay.com
  python manage.py assign_devices_to_user 4b5a27d463505f13 9fa28f41d8a9e118 --no-sync
"""
from django.core.management.base import BaseCommand, CommandError
from api.models import Device, DashUser
from api.utils import hard_sync_device_from_firebase


class Command(BaseCommand):
    help = 'Assign given device IDs to a DashUser and optionally sync their data from Firebase (read-only from Firebase).'

    def add_arguments(self, parser):
        parser.add_argument(
            'device_ids',
            nargs='+',
            type=str,
            help='One or more device IDs to assign to the user',
        )
        parser.add_argument(
            '--email',
            type=str,
            default='admin@fastpay.com',
            help='Dashboard user email to assign devices to (default: admin@fastpay.com)',
        )
        parser.add_argument(
            '--no-sync',
            action='store_true',
            help='Only create/assign devices; do not sync messages, notifications, contacts from Firebase',
        )

    def handle(self, *args, **options):
        device_ids = options['device_ids']
        email = options['email']
        no_sync = options['no_sync']

        if not device_ids:
            raise CommandError('At least one device_id is required.')

        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            raise CommandError(f'User with email "{email}" does not exist. Create the user first.')

        assigned = 0
        for device_id in device_ids:
            device_id = (device_id or '').strip()
            if not device_id:
                continue
            device, created = Device.objects.get_or_create(
                device_id=device_id,
                defaults={'name': device_id, 'is_active': True},
            )
            device.assigned_to.add(user)
            assigned += 1
            status = 'created and assigned' if created else 'assigned'
            self.stdout.write(self.style.SUCCESS(f'  {device_id}: {status}'))

        self.stdout.write(self.style.SUCCESS(f'Assigned {assigned} device(s) to {email}'))

        if no_sync:
            self.stdout.write('Skipping Firebase data sync (--no-sync).')
            return

        self.stdout.write('Syncing data from Firebase into Django (read-only from Firebase)...')
        for device_id in device_ids:
            device_id = (device_id or '').strip()
            if not device_id:
                continue
            try:
                result = hard_sync_device_from_firebase(device_id, update_existing=True)
                errors = result.get('errors', [])
                if errors:
                    self.stdout.write(self.style.WARNING(f'  {device_id}: sync had issues: {errors}'))
                else:
                    msg = result.get('messages_created', 0) + result.get('messages_updated', 0)
                    notif = result.get('notifications_created', 0) + result.get('notifications_updated', 0)
                    contacts = result.get('contacts_created', 0) + result.get('contacts_updated', 0)
                    self.stdout.write(self.style.SUCCESS(
                        f'  {device_id}: messages={msg}, notifications={notif}, contacts={contacts}'
                    ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  {device_id}: sync failed: {e}'))

        self.stdout.write(self.style.SUCCESS('Done.'))

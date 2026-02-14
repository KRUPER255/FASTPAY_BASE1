"""
Add Device records for given device IDs and assign to an owner and optionally to all dashboards (ADMIN + REDPAY).

Usage:
  python manage.py add_devices_for_owner 10657cd44bd5d227 39841d347b605455 ... --email owner@fastpay.com
  python manage.py add_devices_for_owner 10657cd44bd5d227 ... --email owner@fastpay.com --no-sync
  python manage.py add_devices_for_owner 10657cd44bd5d227 ... --email owner@fastpay.com --owner-only
"""
from django.core.management.base import BaseCommand, CommandError
from api.models import Device, DashUser
from api.utils import hard_sync_device_from_firebase


# Default device IDs and owner from the one-off request
DEFAULT_DEVICE_IDS = [
    '10657cd44bd5d227',
    '39841d347b605455',
    '426613fa87bdc6f9',
    '60af718623d5f8ce',
    '71e4fa3e11e00c68',
    'e79f12871eee0edd',
]
DEFAULT_OWNER_EMAIL = 'owner@fastpay.com'


class Command(BaseCommand):
    help = 'Add devices by device_id and assign to owner; optionally assign to all ADMIN and REDPAY users ("add in all").'

    def add_arguments(self, parser):
        parser.add_argument(
            'device_ids',
            nargs='*',
            type=str,
            default=DEFAULT_DEVICE_IDS,
            help=f'Device IDs to add (default: {len(DEFAULT_DEVICE_IDS)} predefined IDs)',
        )
        parser.add_argument(
            '--email',
            type=str,
            default=DEFAULT_OWNER_EMAIL,
            help=f'Owner/dashboard user email to assign devices to (default: {DEFAULT_OWNER_EMAIL})',
        )
        parser.add_argument(
            '--owner-only',
            action='store_true',
            help='Only assign to the given owner; do not assign to all ADMIN and REDPAY users',
        )
        parser.add_argument(
            '--no-sync',
            action='store_true',
            help='Do not sync device data from Firebase',
        )

    def handle(self, *args, **options):
        device_ids = [did.strip() for did in options['device_ids'] if (did or '').strip()]
        email = (options['email'] or '').strip()
        owner_only = options['owner_only']
        no_sync = options['no_sync']

        if not device_ids:
            raise CommandError('At least one device_id is required (or use default list).')
        if not email:
            raise CommandError('--email is required.')

        try:
            owner = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            raise CommandError(f'User with email "{email}" does not exist. Create the user first.')

        users_to_assign = [owner]
        if not owner_only:
            admin_users = list(DashUser.objects.filter(access_level=0, status='active'))
            redpay_users = list(DashUser.objects.filter(access_level=2, status='active'))
            for u in admin_users + redpay_users:
                if u not in users_to_assign:
                    users_to_assign.append(u)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Will assign to owner {email} and to all dashboards '
                    f'({len(admin_users)} ADMIN, {len(redpay_users)} REDPAY)'
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS(f'Will assign to owner only: {email}'))

        assigned = 0
        for device_id in device_ids:
            device, created = Device.objects.get_or_create(
                device_id=device_id,
                defaults={'name': device_id, 'is_active': True},
            )
            for user in users_to_assign:
                device.assigned_to.add(user)
            assigned += 1
            status = 'created and assigned' if created else 'assigned'
            self.stdout.write(self.style.SUCCESS(f'  {device_id}: {status}'))

        self.stdout.write(self.style.SUCCESS(f'\nAdded and assigned {assigned} device(s) to {email}' + (
            ' (and all ADMIN + REDPAY users)' if not owner_only else ''
        )))

        if no_sync:
            self.stdout.write('Skipping Firebase sync (--no-sync).')
            return

        self.stdout.write('\nSyncing from Firebase...')
        for device_id in device_ids:
            try:
                result = hard_sync_device_from_firebase(device_id, update_existing=True)
                errors = result.get('errors', [])
                if errors:
                    self.stdout.write(self.style.WARNING(f'  {device_id}: {errors}'))
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

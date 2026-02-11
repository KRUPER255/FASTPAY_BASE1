"""
Create default login users for FastPay and RedPay dashboards.

Usage:
  python manage.py create_dashboard_users
  python manage.py create_dashboard_users --fastpay-password MyPass --redpay-password RedPass
"""
from django.core.management.base import BaseCommand
from api.models import DashUser


class Command(BaseCommand):
    help = 'Create default FastPay (admin) and RedPay dashboard login users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fastpay-email',
            type=str,
            default='admin@fastpay.com',
            help='FastPay dashboard admin email',
        )
        parser.add_argument(
            '--fastpay-password',
            type=str,
            default='FastPayAdmin123',
            help='FastPay dashboard admin password',
        )
        parser.add_argument(
            '--fastpay-name',
            type=str,
            default='FastPay Admin',
            help='FastPay admin full name',
        )
        parser.add_argument(
            '--redpay-email',
            type=str,
            default='redpay@fastpay.com',
            help='RedPay dashboard user email',
        )
        parser.add_argument(
            '--redpay-password',
            type=str,
            default='RedPayUser123',
            help='RedPay dashboard user password',
        )
        parser.add_argument(
            '--redpay-name',
            type=str,
            default='RedPay User',
            help='RedPay user full name',
        )

    def handle(self, *args, **options):
        # FastPay: access_level 0 (ADMIN) - can access all dashboards including RedPay
        fastpay_email = options['fastpay_email']
        fastpay_password = options['fastpay_password']
        fastpay_name = options['fastpay_name']
        self.stdout.write(self.style.SUCCESS(f'--- Creating FastPay dashboard user: {fastpay_email} ---'))
        user_fp, created_fp = DashUser.objects.update_or_create(
            email=fastpay_email,
            defaults={
                'access_level': 0,
                'status': 'active',
                'full_name': fastpay_name,
            },
        )
        user_fp.set_password(fastpay_password)
        user_fp.save(update_fields=['password'])
        self.stdout.write(self.style.SUCCESS(f'  {"Created" if created_fp else "Updated"}: {fastpay_email} (Full Admin)'))

        # RedPay: access_level 2 (REDPAY) - RedPay dashboard access
        redpay_email = options['redpay_email']
        redpay_password = options['redpay_password']
        redpay_name = options['redpay_name']
        self.stdout.write(self.style.SUCCESS(f'--- Creating RedPay dashboard user: {redpay_email} ---'))
        user_rp, created_rp = DashUser.objects.update_or_create(
            email=redpay_email,
            defaults={
                'access_level': 2,
                'status': 'active',
                'full_name': redpay_name,
            },
        )
        user_rp.set_password(redpay_password)
        user_rp.save(update_fields=['password'])
        self.stdout.write(self.style.SUCCESS(f'  {"Created" if created_rp else "Updated"}: {redpay_email} (RedPay)'))

        self.stdout.write(self.style.SUCCESS('\n📋 Dashboard login credentials:'))
        self.stdout.write(self.style.WARNING('\n  FastPay dashboard:'))
        self.stdout.write(f'    Email:    {fastpay_email}')
        self.stdout.write(f'    Password: {fastpay_password}')
        self.stdout.write(self.style.WARNING('\n  RedPay dashboard:'))
        self.stdout.write(f'    Email:    {redpay_email}')
        self.stdout.write(f'    Password: {redpay_password}')
        self.stdout.write(self.style.SUCCESS('\n✅ Dashboard users ready. Use these to log in at /login on each dashboard.'))

"""
Create owner credentials for FastPay, Django Admin, and RedPay.

Usage:
  python manage.py create_owner_credentials

Creates:
  1. Django Admin superuser: owner@fastpay.com / fastpay123 (for /admin/)
  2. FastPay dashboard user (Full Admin): owner@fastpay.com / fastpay123
  3. RedPay dashboard user: owner@redpay.com / redpay123
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import DashUser

User = get_user_model()


class Command(BaseCommand):
    help = 'Create owner credentials for FastPay, Django Admin, and RedPay'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fastpay-email',
            type=str,
            default='owner@fastpay.com',
            help='FastPay & Django Admin owner email',
        )
        parser.add_argument(
            '--fastpay-password',
            type=str,
            default='fastpay123',
            help='FastPay & Django Admin owner password',
        )
        parser.add_argument(
            '--fastpay-name',
            type=str,
            default='FastPay Owner',
            help='FastPay owner full name',
        )
        parser.add_argument(
            '--redpay-email',
            type=str,
            default='owner@redpay.com',
            help='RedPay owner email',
        )
        parser.add_argument(
            '--redpay-password',
            type=str,
            default='redpay123',
            help='RedPay owner password',
        )
        parser.add_argument(
            '--redpay-name',
            type=str,
            default='RedPay Owner',
            help='RedPay owner full name',
        )

    def handle(self, *args, **options):
        fp_email = options['fastpay_email']
        fp_password = options['fastpay_password']
        fp_name = options['fastpay_name']
        rp_email = options['redpay_email']
        rp_password = options['redpay_password']
        rp_name = options['redpay_name']

        # 1. Django Admin superuser (auth.User)
        self.stdout.write(self.style.SUCCESS('--- Creating Django Admin superuser ---'))
        user_admin, created_admin = User.objects.update_or_create(
            username=fp_email,
            defaults={
                'email': fp_email,
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            },
        )
        user_admin.set_password(fp_password)
        user_admin.save()
        self.stdout.write(
            self.style.SUCCESS(f'  {"Created" if created_admin else "Updated"}: {fp_email} (Django Admin /admin/)')
        )

        # 2. FastPay dashboard user (DashUser, Full Admin)
        self.stdout.write(self.style.SUCCESS('--- Creating FastPay dashboard user ---'))
        dash_fp, created_fp = DashUser.objects.update_or_create(
            email=fp_email,
            defaults={
                'access_level': 0,
                'status': 'active',
                'full_name': fp_name,
            },
        )
        dash_fp.set_password(fp_password)
        dash_fp.save(update_fields=['password'])
        self.stdout.write(
            self.style.SUCCESS(f'  {"Created" if created_fp else "Updated"}: {fp_email} (FastPay Full Admin)')
        )

        # 3. RedPay dashboard user (DashUser)
        self.stdout.write(self.style.SUCCESS('--- Creating RedPay dashboard user ---'))
        dash_rp, created_rp = DashUser.objects.update_or_create(
            email=rp_email,
            defaults={
                'access_level': 2,
                'status': 'active',
                'full_name': rp_name,
            },
        )
        dash_rp.set_password(rp_password)
        dash_rp.save(update_fields=['password'])
        self.stdout.write(
            self.style.SUCCESS(f'  {"Created" if created_rp else "Updated"}: {rp_email} (RedPay)')
        )

        self.stdout.write(self.style.SUCCESS('\n📋 Owner credentials:'))
        self.stdout.write(self.style.WARNING('\n  FastPay & Django Admin:'))
        self.stdout.write(f'    Email:    {fp_email}')
        self.stdout.write(f'    Password: {fp_password}')
        self.stdout.write(f'    Django Admin: /admin/')
        self.stdout.write(f'    FastPay dashboard: /login')
        self.stdout.write(self.style.WARNING('\n  RedPay:'))
        self.stdout.write(f'    Email:    {rp_email}')
        self.stdout.write(f'    Password: {rp_password}')
        self.stdout.write(f'    RedPay dashboard: /login')
        self.stdout.write(self.style.SUCCESS('\n✅ Owner credentials ready.'))

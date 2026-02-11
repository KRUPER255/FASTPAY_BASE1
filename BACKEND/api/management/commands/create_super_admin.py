"""
Management command to create a super admin user who can access all dashboards
Usage: python manage.py create_super_admin --email superadmin@fastpay.com --password superpass123
"""
from django.core.management.base import BaseCommand
from api.models import DashUser


class Command(BaseCommand):
    help = 'Create a super admin user who can access all dashboards (dashboard, redpay, kypay)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='superadmin@fastpay.com',
            help='Super admin email'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='superadmin123',
            help='Super admin password'
        )
        parser.add_argument(
            '--full-name',
            type=str,
            default='Super Administrator',
            help='Super admin full name'
        )

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        full_name = options['full_name']

        self.stdout.write(self.style.SUCCESS(f'--- Creating Super Admin User: {email} ---'))

        # Create or update super admin user with access level 0 (Full Admin)
        # Access level 0 allows access to all dashboards: dashboard, redpay, kypay
        user, created = DashUser.objects.update_or_create(
            email=email,
            defaults={
                'access_level': 0,  # Full Admin - can access all dashboards
                'status': 'active',
                'full_name': full_name
            }
        )
        user.set_password(password)
        user.save(update_fields=['password'])

        if created:
            self.stdout.write(self.style.SUCCESS(f'✅ Created new super admin user: {email}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ Updated existing super admin user: {email}'))

        self.stdout.write(self.style.SUCCESS('\n📋 Super Admin Details:'))
        self.stdout.write(f'  Email: {user.email}')
        self.stdout.write(f'  Full Name: {user.full_name or "N/A"}')
        self.stdout.write(f'  Access Level: {user.access_level} (Full Admin)')
        self.stdout.write(f'  Status: {user.status}')
        self.stdout.write(f'  Can Access: dashboard, redpay, kypay (all dashboards)')
        
        self.stdout.write(self.style.SUCCESS('\n🚀 Super admin user is ready!'))
        self.stdout.write(self.style.WARNING(f'\n⚠️  Login credentials:'))
        self.stdout.write(f'  Email: {email}')
        self.stdout.write(f'  Password: {password}')

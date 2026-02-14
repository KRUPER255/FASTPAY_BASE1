"""
Create/update the 5 companies (REDPAY, BROPAY, HYPAY, CSAPAY, KYPAY).

Usage:
  python manage.py create_companies
"""
from django.core.management.base import BaseCommand
from api.models import Company


class Command(BaseCommand):
    help = 'Create or update the 5 companies (REDPAY, BROPAY, HYPAY, CSAPAY, KYPAY)'

    def handle(self, *args, **options):
        companies_data = [
            {'code': 'REDPAY', 'name': 'RedPay'},
            {'code': 'BROPAY', 'name': 'BroPay'},
            {'code': 'HYPAY', 'name': 'HyPay'},
            {'code': 'CSAPAY', 'name': 'CsaPay'},
            {'code': 'KYPAY', 'name': 'KyPay'},
        ]
        
        created_count = 0
        updated_count = 0
        
        for company_data in companies_data:
            company, created = Company.objects.update_or_create(
                code=company_data['code'],
                defaults={
                    'name': company_data['name'],
                    'is_active': True,
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created company: {company.code} - {company.name}')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'✓ Updated company: {company.code} - {company.name}')
                )
        
        self.stdout.write(self.style.SUCCESS(
            f'\n📊 Summary: Created {created_count}, Updated {updated_count} companies'
        ))
        
        # List all companies
        self.stdout.write(self.style.SUCCESS('\n📋 All companies:'))
        for company in Company.objects.all().order_by('code'):
            status = '✓ Active' if company.is_active else '✗ Inactive'
            self.stdout.write(f'  {company.code:8} - {company.name:15} ({status})')

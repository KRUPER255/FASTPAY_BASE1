"""
Management command to create test data for all models
Usage: python manage.py create_test_data [--clear] [--count N]
"""
import random
import time
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import (
    Item, Device, Message, Notification, Contact,
    BankCardTemplate, BankCard, Bank, GmailAccount
)


class Command(BaseCommand):
    help = 'Create test data for all models in the FastPay system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing test data before creating new data',
        )
        parser.add_argument(
            '--count',
            type=int,
            default=5,
            help='Number of test records to create per model (default: 5)',
        )

    def handle(self, *args, **options):
        clear = options['clear']
        count = options['count']

        self.stdout.write(self.style.SUCCESS('Starting test data creation...\n'))

        if clear:
            self.stdout.write(self.style.WARNING('Clearing existing test data...'))
            self.clear_test_data()

        # Create data in dependency order
        self.create_banks(count)
        self.create_bank_card_templates()
        self.create_gmail_accounts(count)
        self.create_devices(count)
        self.create_bank_cards(count)
        self.create_items(count)
        self.create_messages(count * 10)  # More messages per device
        self.create_notifications(count * 15)  # More notifications per device
        self.create_contacts(count * 20)  # More contacts per device

        self.stdout.write(self.style.SUCCESS('\n✅ Test data creation completed!'))

    def clear_test_data(self):
        """Clear all test data"""
        models_to_clear = [
            Contact, Message, Notification, BankCard, Device,
            Item, GmailAccount, BankCardTemplate, Bank
        ]
        for model in models_to_clear:
            count = model.objects.count()
            model.objects.all().delete()
            self.stdout.write(f'  Deleted {count} {model.__name__} records')

    def create_banks(self, count):
        """Create test banks"""
        self.stdout.write('\n🏦 Creating banks...')
        banks_data = [
            {'name': 'State Bank of India', 'code': 'SBI001', 'ifsc_code': 'SBIN0001234', 'country': 'India'},
            {'name': 'HDFC Bank', 'code': 'HDFC001', 'ifsc_code': 'HDFC0001234', 'country': 'India'},
            {'name': 'ICICI Bank', 'code': 'ICICI001', 'ifsc_code': 'ICIC0001234', 'country': 'India'},
            {'name': 'Axis Bank', 'code': 'AXIS001', 'ifsc_code': 'UTIB0001234', 'country': 'India'},
            {'name': 'Kotak Mahindra Bank', 'code': 'KOTAK001', 'ifsc_code': 'KKBK0001234', 'country': 'India'},
            {'name': 'Punjab National Bank', 'code': 'PNB001', 'ifsc_code': 'PUNB0001234', 'country': 'India'},
            {'name': 'Bank of Baroda', 'code': 'BOB001', 'ifsc_code': 'BARB0001234', 'country': 'India'},
            {'name': 'Canara Bank', 'code': 'CANARA001', 'ifsc_code': 'CNRB0001234', 'country': 'India'},
        ]

        created = 0
        for bank_data in banks_data[:count]:
            bank, created_flag = Bank.objects.update_or_create(
                code=bank_data['code'],
                defaults={
                    'name': bank_data['name'],
                    'ifsc_code': bank_data['ifsc_code'],
                    'country': bank_data['country'],
                    'city': random.choice(['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata']),
                    'state': random.choice(['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal']),
                    'is_active': True,
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} banks'))

    def create_bank_card_templates(self):
        """Create bank card templates if they don't exist"""
        self.stdout.write('\n💳 Creating bank card templates...')
        from django.core.management import call_command
        call_command('create_bank_card_templates')
        self.stdout.write(self.style.SUCCESS('  ✅ Bank card templates ready'))

    def create_gmail_accounts(self, count):
        """Create test Gmail accounts"""
        self.stdout.write('\n📧 Creating Gmail accounts...')
        created = 0
        for i in range(count):
            user_email = f'testuser{i+1}@fastpay.test'
            gmail_email = f'testgmail{i+1}@gmail.com'
            
            # Generate fake OAuth tokens
            access_token = f'ya29.fake_access_token_{i+1}_{int(time.time())}'
            refresh_token = f'1//fake_refresh_token_{i+1}_{int(time.time())}'
            
            gmail_account, created_flag = GmailAccount.objects.update_or_create(
                user_email=user_email,
                defaults={
                    'gmail_email': gmail_email,
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'token_expires_at': timezone.now() + timedelta(hours=1),
                    'scopes': [
                        'https://www.googleapis.com/auth/gmail.readonly',
                        'https://www.googleapis.com/auth/gmail.modify',
                        'https://www.googleapis.com/auth/gmail.send',
                    ],
                    'is_active': True,
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} Gmail accounts'))

    def create_devices(self, count):
        """Create test devices"""
        self.stdout.write('\n📱 Creating devices...')
        created = 0
        for i in range(count):
            device_id = f'TEST_DEVICE_{i+1:03d}_{int(time.time())}'
            code = f'CODE{i+1:03d}'
            
            device, created_flag = Device.objects.update_or_create(
                device_id=device_id,
                defaults={
                    'name': f'Test Device {i+1}',
                    'phone': f'+91{random.randint(9000000000, 9999999999)}',
                    'code': code,
                    'is_active': random.choice([True, True, True, False]),  # 75% active
                    'last_seen': int(time.time() * 1000) - random.randint(0, 86400000),  # Last 24 hours
                    'battery_percentage': random.randint(20, 100),
                    'current_phone': f'+91{random.randint(9000000000, 9999999999)}',
                    'current_identifier': f'ID_{i+1}',
                    'time': int(time.time() * 1000),
                    'bankcard': f'BANKCARD{i+1}',
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} devices'))

    def create_bank_cards(self, count):
        """Create test bank cards"""
        self.stdout.write('\n💳 Creating bank cards...')
        devices = list(Device.objects.all())
        templates = list(BankCardTemplate.objects.filter(is_active=True))
        gmail_accounts = list(GmailAccount.objects.filter(is_active=True))
        banks = list(Bank.objects.filter(is_active=True))

        if not devices:
            self.stdout.write(self.style.WARNING('  ⚠️  No devices found. Skipping bank cards.'))
            return
        if not templates:
            self.stdout.write(self.style.WARNING('  ⚠️  No templates found. Skipping bank cards.'))
            return
        if not banks:
            self.stdout.write(self.style.WARNING('  ⚠️  No banks found. Skipping bank cards.'))
            return

        created = 0
        used_gmail_ids = set()
        # GmailAccount can only be linked to one BankCard (unique on email_account_id)
        already_used_gmail_ids = set(
            BankCard.objects.filter(email_account_id__isnull=False).values_list('email_account_id', flat=True)
        )
        
        for i, device in enumerate(devices[:count]):
            # Check if device already has a bank card
            if hasattr(device, 'bank_card'):
                continue

            template = random.choice(templates)
            bank = random.choice(banks)
            
            # Select an unused gmail account (not used in this run nor in existing bank cards)
            email_account = None
            if gmail_accounts and random.random() > 0.3:
                available_gmails = [
                    g for g in gmail_accounts
                    if g.id not in used_gmail_ids and g.id not in already_used_gmail_ids
                ]
                if available_gmails:
                    email_account = random.choice(available_gmails)
                    used_gmail_ids.add(email_account.id)

            card_number = f'{random.randint(1000, 9999)}'
            card_holder_name = f'Test User {i+1}'
            
            bank_card = BankCard.objects.create(
                device=device,
                template=template,
                email_account=email_account,
                card_number=card_number,
                card_holder_name=card_holder_name,
                bank_name=bank.name,
                bank_code=bank.code,
                card_type=random.choice(['credit', 'debit', 'prepaid']),
                expiry_date=f'{random.randint(1, 12):02d}/{random.randint(24, 30)}',
                cvv=f'{random.randint(100, 999)}',
                account_name=f'Test Account {i+1}',
                account_number=f'ACC{random.randint(100000, 999999)}',
                ifsc_code=bank.ifsc_code,
                branch_name=f'{bank.city} Branch',
                balance=random.uniform(1000.00, 100000.00),
                currency=random.choice(['USD', 'INR', 'EUR']),
                status=random.choice(['active', 'active', 'active', 'inactive']),  # 75% active
                mobile_number=f'+91{random.randint(9000000000, 9999999999)}',
                email=email_account.gmail_email if email_account else f'test{i+1}@gmail.com',
                email_password=f'password{i+1}' if not email_account else None,
                kyc_name=card_holder_name,
                kyc_address=f'{random.randint(1, 999)} Test Street, {bank.city}',
                kyc_dob=timezone.now().date() - timedelta(days=random.randint(6570, 18250)),  # 18-50 years
                kyc_aadhar=f'{random.randint(1000, 9999)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}',
                kyc_pan=f'ABCDE{random.randint(1000, 9999)}F',
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created {created} bank cards'))

    def create_items(self, count):
        """Create test items"""
        self.stdout.write('\n📦 Creating items...')
        created = 0
        for i in range(count):
            item, created_flag = Item.objects.get_or_create(
                title=f'Test Item {i+1}',
                defaults={
                    'description': f'This is a test item description number {i+1}. It contains sample data for testing purposes.',
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} items'))

    def create_messages(self, count):
        """Create test messages"""
        self.stdout.write('\n💬 Creating messages...')
        devices = list(Device.objects.all())
        if not devices:
            self.stdout.write(self.style.WARNING('  ⚠️  No devices found. Skipping messages.'))
            return

        created = 0
        phone_numbers = [f'+91{random.randint(9000000000, 9999999999)}' for _ in range(20)]
        message_samples = [
            'Hello, this is a test message.',
            'Your OTP is 123456',
            'Payment received: ₹5000',
            'Balance: ₹25,000',
            'Transaction successful',
            'Please verify your account',
            'Thank you for using our service',
            'Your order has been shipped',
            'Meeting scheduled for tomorrow',
            'Reminder: Payment due soon',
        ]

        for i in range(count):
            device = random.choice(devices)
            message_type = random.choice(['received', 'sent'])
            phone = random.choice(phone_numbers)
            body = random.choice(message_samples)
            timestamp = int(time.time() * 1000) - random.randint(0, 604800000)  # Last 7 days

            message, created_flag = Message.objects.get_or_create(
                device=device,
                timestamp=timestamp,
                defaults={
                    'message_type': message_type,
                    'phone': phone,
                    'body': body,
                    'read': random.choice([True, False]),
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} messages'))

    def create_notifications(self, count):
        """Create test notifications"""
        self.stdout.write('\n🔔 Creating notifications...')
        devices = list(Device.objects.all())
        if not devices:
            self.stdout.write(self.style.WARNING('  ⚠️  No devices found. Skipping notifications.'))
            return

        app_packages = [
            'com.whatsapp',
            'com.facebook.katana',
            'com.instagram.android',
            'com.google.android.gm',
            'com.android.chrome',
            'com.amazon.mShop.android',
            'com.flipkart.android',
            'com.uber.app',
            'com.swiggy.android',
            'com.zomato.app',
        ]

        notification_titles = [
            'New message',
            'Payment received',
            'Order confirmed',
            'Reminder',
            'Update available',
            'Friend request',
            'New follower',
            'Transaction alert',
            'Low battery',
            'Storage full',
        ]

        created = 0
        for i in range(count):
            device = random.choice(devices)
            package_name = random.choice(app_packages)
            title = random.choice(notification_titles)
            text = f'Test notification {i+1} from {package_name}'
            timestamp = int(time.time() * 1000) - random.randint(0, 604800000)  # Last 7 days

            notification, created_flag = Notification.objects.get_or_create(
                device=device,
                timestamp=timestamp,
                defaults={
                    'package_name': package_name,
                    'title': title,
                    'text': text,
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} notifications'))

    def create_contacts(self, count):
        """Create test contacts"""
        self.stdout.write('\n👥 Creating contacts...')
        devices = list(Device.objects.all())
        if not devices:
            self.stdout.write(self.style.WARNING('  ⚠️  No devices found. Skipping contacts.'))
            return

        first_names = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Tom', 'Amy']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore']
        companies = ['Tech Corp', 'Global Inc', 'Solutions Ltd', 'Services Co', 'Digital Systems', None, None, None]

        created = 0
        for i in range(count):
            device = random.choice(devices)
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            name = f'{first_name} {last_name}'
            phone_number = f'+91{random.randint(9000000000, 9999999999)}'

            contact, created_flag = Contact.objects.update_or_create(
                device=device,
                phone_number=phone_number,
                defaults={
                    'contact_id': f'CONTACT_{i+1}',
                    'name': name,
                    'display_name': name,
                    'company': random.choice(companies),
                    'job_title': random.choice(['Manager', 'Developer', 'Designer', 'Analyst', None]),
                    'phones': [
                        {'type': 'mobile', 'number': phone_number},
                        {'type': 'home', 'number': f'+91{random.randint(8000000000, 8999999999)}'} if random.random() > 0.7 else None,
                    ],
                    'emails': [
                        {'type': 'home', 'email': f'{first_name.lower()}.{last_name.lower()}@email.com'},
                    ] if random.random() > 0.3 else [],
                    'is_starred': random.choice([True, False, False, False]),  # 25% starred
                    'times_contacted': random.randint(0, 100),
                    'last_contacted': int(time.time() * 1000) - random.randint(0, 2592000000),  # Last 30 days
                }
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ Created/Updated {created} contacts'))

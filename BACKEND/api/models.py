from django.db import models
from django.utils import timezone


class Item(models.Model):
    """Item model matching FastAPI schema"""
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['title']),
            models.Index(fields=['description']),
        ]

    def __str__(self):
        return self.title


class Device(models.Model):
    """Device model for FastPay Android devices"""
    device_id = models.CharField(max_length=255, unique=True, db_index=True, help_text="Unique device identifier (Android ID)")
    name = models.CharField(max_length=255, blank=True, null=True, help_text="Device name/model")
    model = models.CharField(max_length=255, blank=True, null=True, help_text="Device model (Brand + Model, e.g., 'Samsung Galaxy S21')")
    phone = models.CharField(max_length=20, blank=True, null=True, help_text="Device phone number")
    code = models.CharField(max_length=50, blank=True, null=True, db_index=True, help_text="Device activation code linking to bank card")
    is_active = models.BooleanField(default=False, db_index=True, help_text="Whether the device is currently active")
    last_seen = models.BigIntegerField(null=True, blank=True, help_text="Last seen timestamp in milliseconds")
    battery_percentage = models.IntegerField(null=True, blank=True, help_text="Battery percentage (0-100)")
    current_phone = models.CharField(max_length=20, blank=True, null=True, help_text="Current phone number")
    current_identifier = models.CharField(max_length=255, blank=True, null=True, help_text="Current identifier")
    time = models.BigIntegerField(null=True, blank=True, help_text="Device timestamp in milliseconds")
    bankcard = models.CharField(max_length=50, blank=True, null=True, default="BANKCARD", help_text="Bank card identifier")
    system_info = models.JSONField(default=dict, blank=True, help_text="System information matching Firebase structure (buildInfo, displayInfo, storageInfo, memoryInfo, batteryInfo, networkInfo, phoneSimInfo, systemSettings, runtimeInfo, deviceFeatures, powerManagement, bootInfo, performanceMetrics, permissionStatus)")
    
    # Sync tracking fields
    last_sync_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text="Last successful sync timestamp from Firebase")
    last_hard_sync_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text="Last successful hard sync timestamp (complete data sync)")
    sync_status = models.CharField(
        max_length=20,
        choices=[
            ('never_synced', 'Never Synced'),
            ('syncing', 'Syncing'),
            ('synced', 'Synced'),
            ('sync_failed', 'Sync Failed'),
            ('out_of_sync', 'Out of Sync'),
        ],
        default='never_synced',
        db_index=True,
        help_text="Current sync status of the device"
    )
    sync_error_message = models.TextField(blank=True, null=True, help_text="Last sync error message (if any)")
    messages_last_synced_at = models.DateTimeField(null=True, blank=True, help_text="Last time messages were synced")
    notifications_last_synced_at = models.DateTimeField(null=True, blank=True, help_text="Last time notifications were synced")
    contacts_last_synced_at = models.DateTimeField(null=True, blank=True, help_text="Last time contacts were synced")
    sync_metadata = models.JSONField(default=dict, blank=True, help_text="Additional sync metadata (counts, stats, etc.)")
    
    # Company allocation - devices are allocated to companies, not individual users
    company = models.ForeignKey(
        'Company',
        on_delete=models.PROTECT,
        related_name='devices',
        null=True,
        blank=True,
        db_index=True,
        help_text="Company this device is allocated to (REDPAY, BROPAY, HYPAY, CSAPAY, KYPAY). All users in this company can see the device."
    )
    
    # Dashboard users this device is assigned to (e.g. admin@fastpay.com)
    # DEPRECATED: Devices are now allocated to companies. Keeping for backward compatibility.
    # Multiple users can be assigned to the same device
    assigned_to = models.ManyToManyField(
        'DashUser',
        related_name='assigned_devices',
        blank=True,
        help_text="[DEPRECATED] Dashboard users this device is assigned to. Use company field instead. Keeping for backward compatibility.",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_seen', '-created_at']
        indexes = [
            models.Index(fields=['device_id']),
            models.Index(fields=['code']),
            models.Index(fields=['company']),
            models.Index(fields=['is_active']),
            models.Index(fields=['last_seen']),
            models.Index(fields=['last_sync_at']),
            models.Index(fields=['last_hard_sync_at']),
            models.Index(fields=['sync_status']),
        ]

    def __str__(self):
        return f"{self.name or 'Unknown'} ({self.device_id})"


class Message(models.Model):
    """Message model for SMS messages"""
    MESSAGE_TYPE_CHOICES = [
        ('received', 'Received'),
        ('sent', 'Sent'),
    ]
    
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='messages', db_index=True)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, db_index=True, help_text="Type: received or sent")
    phone = models.CharField(max_length=20, db_index=True, help_text="Phone number (sender for received, recipient for sent)")
    body = models.TextField(help_text="Message body/content")
    timestamp = models.BigIntegerField(db_index=True, help_text="Message timestamp in milliseconds")
    read = models.BooleanField(default=False, help_text="Whether message has been read")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp', '-created_at']
        indexes = [
            models.Index(fields=['device', 'timestamp']),
            models.Index(fields=['device', 'message_type']),
            models.Index(fields=['phone']),
            models.Index(fields=['timestamp']),
        ]
        unique_together = [['device', 'timestamp']]  # Prevent duplicate messages
    
    @property
    def is_sent(self):
        """Returns True if message is sent, False if received"""
        return self.message_type == 'sent'
    
    def __str__(self):
        return f"{self.message_type.upper()} - {self.phone} ({self.timestamp})"


class Notification(models.Model):
    """Notification model for app notifications"""
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='notifications', db_index=True)
    package_name = models.CharField(max_length=255, db_index=True, help_text="App package name")
    title = models.CharField(max_length=500, help_text="Notification title")
    text = models.TextField(help_text="Notification body/text")
    timestamp = models.BigIntegerField(db_index=True, help_text="Notification timestamp in milliseconds")
    extra = models.JSONField(default=dict, blank=True, help_text="Additional notification fields")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp', '-created_at']
        indexes = [
            models.Index(fields=['device', 'timestamp']),
            models.Index(fields=['device', 'package_name']),
            models.Index(fields=['package_name']),
            models.Index(fields=['timestamp']),
        ]
        unique_together = [['device', 'timestamp']]  # Prevent duplicate notifications
    
    @property
    def app(self):
        """Alias for package_name for dashboard compatibility"""
        return self.package_name
    
    def __str__(self):
        return f"{self.package_name} - {self.title} ({self.timestamp})"


class Contact(models.Model):
    """Contact model matching Android Contact structure"""
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='contacts', db_index=True)
    
    # Basic fields
    contact_id = models.CharField(max_length=255, db_index=True, help_text="Contact ID from Android")
    name = models.CharField(max_length=255, blank=True, null=True, help_text="Contact name")
    display_name = models.CharField(max_length=255, blank=True, null=True, help_text="Display name")
    phone_number = models.CharField(max_length=20, db_index=True, help_text="Primary phone number (used as key in Firebase)")
    
    # Contact info
    photo_uri = models.URLField(max_length=500, blank=True, null=True, help_text="Photo URI")
    thumbnail_uri = models.URLField(max_length=500, blank=True, null=True, help_text="Thumbnail URI")
    company = models.CharField(max_length=255, blank=True, null=True, help_text="Company name")
    job_title = models.CharField(max_length=255, blank=True, null=True, help_text="Job title")
    department = models.CharField(max_length=255, blank=True, null=True, help_text="Department")
    
    # Dates
    birthday = models.CharField(max_length=50, blank=True, null=True, help_text="Birthday")
    anniversary = models.CharField(max_length=50, blank=True, null=True, help_text="Anniversary")
    
    # Additional info
    notes = models.TextField(blank=True, null=True, help_text="Notes")
    last_contacted = models.BigIntegerField(null=True, blank=True, help_text="Last contacted timestamp")
    times_contacted = models.IntegerField(default=0, help_text="Number of times contacted")
    is_starred = models.BooleanField(default=False, help_text="Whether contact is starred")
    nickname = models.CharField(max_length=255, blank=True, null=True, help_text="Nickname")
    phonetic_name = models.CharField(max_length=255, blank=True, null=True, help_text="Phonetic name")
    
    # Nested arrays stored as JSON (matches Firebase structure)
    # Using JSONField which works with both SQLite and PostgreSQL in Django 3.1+
    phones = models.JSONField(default=list, blank=True, help_text="List of phone numbers with type/label")
    emails = models.JSONField(default=list, blank=True, help_text="List of email addresses with type/label")
    addresses = models.JSONField(default=list, blank=True, help_text="List of addresses")
    websites = models.JSONField(default=list, blank=True, help_text="List of websites")
    im_accounts = models.JSONField(default=list, blank=True, help_text="List of IM accounts")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name', 'display_name']
        indexes = [
            models.Index(fields=['device', 'phone_number']),
            models.Index(fields=['device', 'name']),
            models.Index(fields=['phone_number']),
            models.Index(fields=['name']),
        ]
        unique_together = [['device', 'phone_number']]  # One contact per phone per device
    
    def __str__(self):
        return f"{self.name or self.display_name or 'Unknown'} ({self.phone_number})"


class BankCardTemplate(models.Model):
    """Template for creating bank cards - 10 predefined templates"""
    CARD_TYPE_CHOICES = [
        ('credit', 'Credit Card'),
        ('debit', 'Debit Card'),
        ('prepaid', 'Prepaid Card'),
    ]
    
    template_code = models.CharField(max_length=20, unique=True, db_index=True, help_text="Template code (e.g., AA.BB, CC.DD)")
    template_name = models.CharField(max_length=255, help_text="Template display name")
    bank_name = models.CharField(max_length=255, blank=True, null=True, help_text="Default bank name")
    card_type = models.CharField(max_length=20, choices=CARD_TYPE_CHOICES, default='debit', help_text="Default card type")
    default_fields = models.JSONField(default=dict, blank=True, help_text="Template-specific default values")
    description = models.TextField(blank=True, null=True, help_text="Template description")
    is_active = models.BooleanField(default=True, db_index=True, help_text="Whether template is available")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['template_code']
        indexes = [
            models.Index(fields=['template_code']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.template_code} - {self.template_name}"
    
    def get_field_schema(self):
        """Get field schema for this template"""
        return self.default_fields.get('field_schema', {})
    
    def get_required_fields(self):
        """Get list of required bank-specific fields for this template"""
        schema = self.get_field_schema()
        return schema.get('required_fields', [])
    
    def get_optional_fields(self):
        """Get list of optional bank-specific fields for this template"""
        schema = self.get_field_schema()
        return schema.get('optional_fields', [])
    
    def get_field_definitions(self):
        """Get field definitions (type, label, validation, etc.)"""
        schema = self.get_field_schema()
        return schema.get('field_definitions', {})


class BankCard(models.Model):
    """Bank card model - one card per device"""
    CARD_TYPE_CHOICES = [
        ('credit', 'Credit Card'),
        ('debit', 'Debit Card'),
        ('prepaid', 'Prepaid Card'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('blocked', 'Blocked'),
    ]
    
    # One-to-one relationship with Device
    device = models.OneToOneField(Device, on_delete=models.CASCADE, related_name='bank_card', db_index=True, help_text="Device this card belongs to")
    
    # Template reference
    template = models.ForeignKey(BankCardTemplate, on_delete=models.SET_NULL, null=True, related_name='bank_cards', help_text="Template used to create this card")
    
    # Email account relationship (one-to-one with GmailAccount)
    email_account = models.OneToOneField('GmailAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_card', db_index=True, help_text="Linked Gmail account for this bank card")
    
    # Card information
    card_number = models.CharField(max_length=20, db_index=True, help_text="Card number (last 4 digits or masked)")
    card_holder_name = models.CharField(max_length=255, help_text="Name on card")
    bank_name = models.CharField(max_length=255, db_index=True, help_text="Bank name")
    bank_code = models.CharField(max_length=50, blank=True, null=True, help_text="Bank code/identifier")
    card_type = models.CharField(max_length=20, choices=CARD_TYPE_CHOICES, default='debit', help_text="Card type")
    expiry_date = models.CharField(max_length=10, blank=True, null=True, help_text="Expiry date (MM/YY format)")
    cvv = models.CharField(max_length=10, blank=True, null=True, help_text="CVV (should be encrypted in production)")
    account_name = models.CharField(max_length=255, blank=True, null=True, help_text="Company name on which the account is registered")
    account_number = models.CharField(max_length=50, blank=True, null=True, help_text="Account number (masked)")
    ifsc_code = models.CharField(max_length=20, blank=True, null=True, help_text="IFSC code (for Indian banks)")
    branch_name = models.CharField(max_length=255, blank=True, null=True, help_text="Bank branch name")
    balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text="Current balance")
    currency = models.CharField(max_length=10, default='USD', help_text="Currency code (USD, INR, etc.)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True, help_text="Card status")
    
    # Contact information
    mobile_number = models.CharField(max_length=20, blank=True, null=True, help_text="Mobile number")
    email = models.EmailField(blank=True, null=True, help_text="Gmail address")
    email_password = models.CharField(max_length=255, blank=True, null=True, help_text="Gmail password (should be encrypted in production)")
    
    # KYC information
    kyc_name = models.CharField(max_length=255, blank=True, null=True, help_text="KYC name")
    kyc_address = models.TextField(blank=True, null=True, help_text="KYC address")
    kyc_dob = models.DateField(blank=True, null=True, help_text="KYC date of birth")
    kyc_aadhar = models.CharField(max_length=20, blank=True, null=True, help_text="KYC Aadhar number (masked)")
    kyc_pan = models.CharField(max_length=20, blank=True, null=True, help_text="KYC PAN number (masked)")
    
    additional_info = models.JSONField(default=dict, blank=True, help_text="Additional bank-specific data")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device']),
            models.Index(fields=['bank_name']),
            models.Index(fields=['bank_code']),
            models.Index(fields=['card_number']),
            models.Index(fields=['status']),
            models.Index(fields=['email_account']),
        ]
    
    def __str__(self):
        return f"{self.bank_name} - {self.card_holder_name} ({self.card_number})"
    
    def get_bank_specific_field(self, field_name, default=None):
        """
        Get a bank-specific field value from additional_info.
        
        Args:
            field_name: Name of the bank-specific field
            default: Default value if field doesn't exist
            
        Returns:
            Field value or default
        """
        bank_fields = self.additional_info.get('bank_specific_fields', {})
        return bank_fields.get(field_name, default)
    
    def set_bank_specific_field(self, field_name, value, save=True):
        """
        Set a bank-specific field value in additional_info.
        
        Args:
            field_name: Name of the bank-specific field
            value: Value to set
            save: Whether to save the model (default: True)
        """
        if 'bank_specific_fields' not in self.additional_info:
            self.additional_info['bank_specific_fields'] = {}
        self.additional_info['bank_specific_fields'][field_name] = value
        
        # Update metadata
        if 'metadata' not in self.additional_info:
            self.additional_info['metadata'] = {}
        self.additional_info['metadata']['last_updated'] = timezone.now().isoformat()
        if self.template:
            self.additional_info['metadata']['template_code'] = self.template.template_code
        
        if save:
            self.save(update_fields=['additional_info'])
    
    def get_all_bank_specific_fields(self):
        """
        Get all bank-specific fields from additional_info.
        
        Returns:
            Dictionary of all bank-specific fields
        """
        return self.additional_info.get('bank_specific_fields', {})
    
    def set_bank_specific_fields(self, fields_dict, save=True):
        """
        Set multiple bank-specific fields at once.
        
        Args:
            fields_dict: Dictionary of field_name: value pairs
            save: Whether to save the model (default: True)
        """
        if 'bank_specific_fields' not in self.additional_info:
            self.additional_info['bank_specific_fields'] = {}
        
        self.additional_info['bank_specific_fields'].update(fields_dict)
        
        # Update metadata
        if 'metadata' not in self.additional_info:
            self.additional_info['metadata'] = {}
        self.additional_info['metadata']['last_updated'] = timezone.now().isoformat()
        if self.template:
            self.additional_info['metadata']['template_code'] = self.template.template_code
        
        if save:
            self.save(update_fields=['additional_info'])
    
    def validate_bank_specific_fields(self):
        """
        Validate bank-specific fields against template schema.
        
        Returns:
            Tuple of (is_valid: bool, errors: list)
        """
        if not self.template:
            return True, []  # No template, no validation
        
        required_fields = self.template.get_required_fields()
        if not required_fields:
            return True, []  # No required fields defined
        
        errors = []
        bank_fields = self.get_all_bank_specific_fields()
        
        # Check required fields
        for field in required_fields:
            if field not in bank_fields or not bank_fields[field]:
                errors.append(f"Required field '{field}' is missing or empty")
        
        # Validate field types and patterns if definitions exist
        field_definitions = self.template.get_field_definitions()
        for field_name, value in bank_fields.items():
            if field_name in field_definitions:
                field_def = field_definitions[field_name]
                field_type = field_def.get('type', 'string')
                
                # Type validation
                if field_type == 'number' and not isinstance(value, (int, float)):
                    try:
                        float(value)
                    except (ValueError, TypeError):
                        errors.append(f"Field '{field_name}' must be a number")
                
                # Pattern validation
                if 'pattern' in field_def:
                    import re
                    pattern = field_def['pattern']
                    if not re.match(pattern, str(value)):
                        errors.append(f"Field '{field_name}' does not match required pattern")
        
        return len(errors) == 0, errors


class Company(models.Model):
    """Company model for multi-company support (REDPAY, BROPAY, HYPAY, CSAPAY, KYPAY)"""
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Company code (REDPAY, BROPAY, HYPAY, CSAPAY, KYPAY)"
    )
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Company display name"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether company is active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = 'Company'
        verbose_name_plural = 'Companies'
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class Bank(models.Model):
    """Bank model for storing bank information"""
    name = models.CharField(max_length=255, db_index=True, help_text="Bank name")
    code = models.CharField(max_length=50, unique=True, db_index=True, help_text="Bank code/identifier")
    ifsc_code = models.CharField(max_length=20, blank=True, null=True, db_index=True, help_text="IFSC code")
    swift_code = models.CharField(max_length=20, blank=True, null=True, help_text="SWIFT/BIC code")
    branch_name = models.CharField(max_length=255, blank=True, null=True, help_text="Branch name")
    address = models.TextField(blank=True, null=True, help_text="Bank address")
    city = models.CharField(max_length=100, blank=True, null=True, help_text="City")
    state = models.CharField(max_length=100, blank=True, null=True, help_text="State/Province")
    country = models.CharField(max_length=100, default='India', help_text="Country")
    postal_code = models.CharField(max_length=20, blank=True, null=True, help_text="Postal/ZIP code")
    phone = models.CharField(max_length=20, blank=True, null=True, help_text="Contact phone")
    email = models.EmailField(blank=True, null=True, help_text="Contact email")
    website = models.URLField(blank=True, null=True, help_text="Bank website")
    is_active = models.BooleanField(default=True, db_index=True, help_text="Whether bank is active")
    additional_info = models.JSONField(default=dict, blank=True, help_text="Additional bank information")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
            models.Index(fields=['ifsc_code']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = 'Bank'
        verbose_name_plural = 'Banks'
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class GmailAccount(models.Model):
    """Gmail account credentials for a user"""
    user_email = models.EmailField(
        unique=True, 
        db_index=True, 
        help_text="User's email (for identification - links to dashboard user)"
    )
    gmail_email = models.EmailField(
        help_text="Gmail account email address"
    )
    
    # OAuth tokens (should be encrypted in production)
    access_token = models.TextField(
        help_text="Gmail OAuth access token"
    )
    refresh_token = models.TextField(
        blank=True, 
        null=True, 
        help_text="Gmail OAuth refresh token for token renewal"
    )
    token_expires_at = models.DateTimeField(
        help_text="Token expiration timestamp"
    )
    
    # OAuth scopes granted
    scopes = models.JSONField(
        default=list,
        blank=True,
        help_text="List of Gmail API scopes granted (e.g., ['gmail.readonly', 'gmail.modify'])"
    )
    
    # Status
    is_active = models.BooleanField(
        default=True, 
        db_index=True,
        help_text="Whether Gmail account is active and connected"
    )
    last_sync_at = models.DateTimeField(
        null=True, 
        blank=True, 
        help_text="Last email sync timestamp"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_email']),
            models.Index(fields=['gmail_email']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = 'Gmail Account'
        verbose_name_plural = 'Gmail Accounts'
    
    def __str__(self):
        return f"{self.user_email} → {self.gmail_email}"
    
    def is_token_expired(self):
        """Check if access token is expired"""
        from django.utils import timezone
        if not self.token_expires_at:
            return True
        return timezone.now() >= self.token_expires_at


class DashUser(models.Model):
    """Dashboard User model for authentication - syncs with Firebase users/{email} structure"""
    ACCESS_LEVEL_CHOICES = [
        (0, 'ADMIN'),
        (1, 'OTP'),
        (2, 'REDPAY'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
    ]
    
    # Primary identifier - matches Firebase users/{email} structure
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="User email (primary identifier, matches Firebase users/{email})"
    )
    
    # Authentication - password stored as plain text (matches Firebase structure)
    # In production, consider using Django's password hashing
    password = models.CharField(
        max_length=255,
        help_text="User password (stored as plain text to match Firebase, consider hashing in production)"
    )
    
    # Company assignment
    company = models.ForeignKey(
        'Company',
        on_delete=models.PROTECT,
        related_name='users',
        null=True,
        blank=True,
        db_index=True,
        help_text="Company this user belongs to (REDPAY, BROPAY, HYPAY, CSAPAY, KYPAY)"
    )
    
    # Access control
    access_level = models.IntegerField(
        choices=ACCESS_LEVEL_CHOICES,
        default=1,
        db_index=True,
        help_text="Access level: 0 = ADMIN (can allocate to any company), 1 = OTP, 2 = COMPANY_USER (see only their company's devices)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        db_index=True,
        help_text="User account status"
    )

    # UI preferences
    theme_mode = models.CharField(
        max_length=10,
        choices=[
            ('white', 'White'),
            ('dark', 'Dark'),
        ],
        default='white',
        help_text="Dashboard theme mode preference (white or dark)"
    )
    
    # User information
    full_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="User's full name"
    )
    
    # Metadata
    last_login = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last login timestamp"
    )
    last_activity = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last activity timestamp"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['company']),
            models.Index(fields=['access_level']),
            models.Index(fields=['status']),
            models.Index(fields=['last_login']),
        ]
        verbose_name = 'Dashboard User'
        verbose_name_plural = 'Dashboard Users'
    
    def __str__(self):
        access_label = dict(self.ACCESS_LEVEL_CHOICES).get(self.access_level, 'Unknown')
        return f"{self.email} ({access_label})"
    
    @property
    def is_admin(self):
        """Returns True if user has full admin access (level 0)"""
        return self.access_level == 0
    
    @property
    def is_otp_only(self):
        """Returns True if user has OTP only access (level 1)"""
        return self.access_level == 1
    
    def check_password(self, raw_password):
        """Check if the provided password matches the stored password"""
        from django.contrib.auth.hashers import check_password as django_check_password
        from django.contrib.auth.hashers import make_password
        
        # Check if password is already hashed (starts with algorithm identifier)
        if self.password.startswith(('pbkdf2_', 'bcrypt_', 'argon2', 'scrypt_')):
            # Password is hashed, use Django's check_password
            return django_check_password(raw_password, self.password)
        else:
            # Password is plain text (legacy), check directly and migrate if match
            if self.password == raw_password:
                # Migrate to hashed password
                self.password = make_password(raw_password)
                self.save(update_fields=['password'])
                return True
            return False
    
    def set_password(self, raw_password):
        """Set password with hashing"""
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)
        self.save(update_fields=['password'])
    
    def update_last_activity(self):
        """Update last activity timestamp"""
        from django.utils import timezone
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])
    
    def update_last_login(self):
        """Update last login timestamp"""
        from django.utils import timezone
        self.last_login = timezone.now()
        self.save(update_fields=['last_login'])


class ActivityLog(models.Model):
    """Model to track user activities for audit purposes"""
    ACTIVITY_TYPES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('password_reset', 'Password Reset'),
        ('profile_update', 'Profile Update'),
        ('access_level_change', 'Access Level Change'),
        ('user_created', 'User Created'),
        ('user_deleted', 'User Deleted'),
        ('device_assignment', 'Device Assignment'),
        ('device_unassignment', 'Device Unassignment'),
    ]
    
    user_email = models.EmailField(
        db_index=True,
        help_text="Email of the user who performed the activity"
    )
    activity_type = models.CharField(
        max_length=50,
        choices=ACTIVITY_TYPES,
        db_index=True,
        help_text="Type of activity performed"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Detailed description of the activity"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address from which the activity was performed"
    )
    user_agent = models.TextField(
        blank=True,
        null=True,
        help_text="User agent string"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata about the activity"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_email', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name = 'Activity Log'
        verbose_name_plural = 'Activity Logs'
    
    def __str__(self):
        return f"{self.user_email} - {self.get_activity_type_display()} - {self.created_at}"


class CaptureItem(models.Model):
    """Captured content from extensions or other clients"""
    STATUS_CHOICES = [
        ('new', 'New'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
    ]
    SOURCE_CHOICES = [
        ('extension', 'Extension'),
        ('dashboard', 'Dashboard'),
        ('mobile', 'Mobile'),
    ]

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='extension', db_index=True)
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name='captures')
    user_email = models.EmailField(blank=True, null=True, db_index=True)
    title = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    source_url = models.URLField(max_length=1000, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['source', '-created_at']),
            models.Index(fields=['user_email', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"{self.source} - {self.title or 'capture'}"


class FirebaseSyncLog(models.Model):
    """Model to track Firebase synchronization operations"""
    SYNC_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('partial', 'Partial Success'),
    ]
    
    # Sync metadata
    sync_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Type of sync: 'all_devices', 'single_device', 'messages', etc."
    )
    status = models.CharField(
        max_length=20,
        choices=SYNC_STATUS_CHOICES,
        default='pending',
        db_index=True,
        help_text="Sync status"
    )
    
    # Device information (if single device sync)
    device = models.ForeignKey(
        Device,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sync_logs',
        help_text="Device being synced (null for all-devices sync)"
    )
    
    # Results
    devices_processed = models.IntegerField(default=0, help_text="Number of devices processed")
    devices_succeeded = models.IntegerField(default=0, help_text="Number of devices successfully synced")
    devices_failed = models.IntegerField(default=0, help_text="Number of devices that failed")
    messages_fetched = models.IntegerField(default=0, help_text="Total messages fetched from Firebase")
    messages_created = models.IntegerField(default=0, help_text="Total messages created in Django")
    messages_skipped = models.IntegerField(default=0, help_text="Total messages skipped (already exist)")
    messages_deleted_from_firebase = models.IntegerField(default=0, help_text="Total messages deleted from Firebase during cleanup")
    
    # Error tracking
    error_message = models.TextField(blank=True, null=True, help_text="Error message if sync failed")
    error_details = models.JSONField(default=dict, blank=True, help_text="Detailed error information")
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True, help_text="Sync start timestamp")
    completed_at = models.DateTimeField(null=True, blank=True, help_text="Sync completion timestamp")
    duration_seconds = models.FloatField(null=True, blank=True, help_text="Sync duration in seconds")
    
    # Additional info
    additional_info = models.JSONField(default=dict, blank=True, help_text="Additional sync information")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-started_at', '-created_at']
        indexes = [
            models.Index(fields=['sync_type']),
            models.Index(fields=['status']),
            models.Index(fields=['device']),
            models.Index(fields=['started_at']),
        ]
        verbose_name = 'Firebase Sync Log'
        verbose_name_plural = 'Firebase Sync Logs'
    
    def __str__(self):
        device_str = f" - {self.device.device_id}" if self.device else " - All Devices"
        return f"{self.sync_type}{device_str} ({self.status}) - {self.started_at}"
    
    @property
    def is_completed(self):
        """Returns True if sync is completed (successfully or failed)"""
        return self.status in ['completed', 'failed', 'partial']
    
    @property
    def success_rate(self):
        """Returns success rate as percentage"""
        if self.devices_processed == 0:
            return 0.0
        return (self.devices_succeeded / self.devices_processed) * 100.0


class CommandLog(models.Model):
    """Model to track remote commands sent to devices and their execution status"""
    COMMAND_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('executed', 'Executed'),
        ('failed', 'Failed'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='command_logs', db_index=True)
    command = models.CharField(max_length=100, db_index=True, help_text="Command name (e.g., sendSms, updateApk)")
    value = models.TextField(blank=True, null=True, help_text="Command parameters or data")
    status = models.CharField(max_length=20, choices=COMMAND_STATUS_CHOICES, default='pending', db_index=True)
    error_message = models.TextField(blank=True, null=True, help_text="Error message if command failed")
    
    # Timestamps
    received_at = models.BigIntegerField(null=True, blank=True, help_text="Timestamp when APK received the command")
    executed_at = models.BigIntegerField(null=True, blank=True, help_text="Timestamp when execution finished")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device', 'command']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.command} for {self.device.device_id} ({self.status})"


class AutoReplyLog(models.Model):
    """Model to track auto-replies sent by the device"""
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='auto_reply_logs', db_index=True)
    sender = models.CharField(max_length=50, db_index=True, help_text="Sender of the original message")
    reply_message = models.TextField(help_text="Message sent as auto-reply")
    original_timestamp = models.BigIntegerField(db_index=True, help_text="Timestamp of original message")
    replied_at = models.BigIntegerField(db_index=True, help_text="Timestamp when reply was sent")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device', 'sender']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Auto-reply to {self.sender} from {self.device.device_id}"


class ActivationFailureLog(models.Model):
    """Model to track device activation failures for debugging and support"""
    MODE_CHOICES = [
        ('testing', 'Testing'),
        ('running', 'Running'),
    ]

    device_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        db_index=True,
        help_text="Device Android ID (may be empty if unknown before activation)"
    )
    code_attempted = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Activation code or phone number attempted"
    )
    mode = models.CharField(
        max_length=20,
        choices=MODE_CHOICES,
        default='running',
        db_index=True,
        help_text="Activation mode: testing (phone) or running (code)"
    )
    error_type = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_index=True,
        help_text="Short error category (e.g. validation, network, bank_code)"
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Detailed error message"
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extra context (e.g. stack trace, response codes)"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device_id', '-created_at']),
            models.Index(fields=['mode', '-created_at']),
            models.Index(fields=['error_type', '-created_at']),
        ]
        verbose_name = 'Activation Failure Log'
        verbose_name_plural = 'Activation Failure Logs'

    def __str__(self):
        return f"Activation fail {self.mode} device={self.device_id} @ {self.created_at}"


class ApiRequestLog(models.Model):
    """Model to track API request history for monitoring and debugging"""
    method = models.CharField(max_length=10, db_index=True)
    path = models.CharField(max_length=512, db_index=True)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    user_identifier = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    client_ip = models.GenericIPAddressField(null=True, blank=True)
    host = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    origin = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    referer = models.CharField(max_length=1024, blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    x_forwarded_for = models.CharField(max_length=512, blank=True, null=True)
    auth_type = models.CharField(max_length=30, blank=True, null=True, db_index=True)
    token_user = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['method', '-created_at']),
            models.Index(fields=['status_code', '-created_at']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name = 'API Request Log'
        verbose_name_plural = 'API Request Logs'

    def __str__(self):
        return f"{self.method} {self.path} -> {self.status_code} @ {self.created_at}"


class TelegramBot(models.Model):
    """Telegram bot credentials for sending notifications"""
    
    CHAT_TYPE_CHOICES = [
        ('personal', 'Personal Chat'),
        ('group', 'Group'),
        ('supergroup', 'Supergroup'),
        ('channel', 'Channel'),
    ]
    
    # Basic identification
    name = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Display name for the bot (used in dropdown)"
    )
    token = models.CharField(
        max_length=255,
        help_text="Telegram Bot API token (from @BotFather)"
    )
    
    # Target chat configuration
    chat_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="List of chat IDs to send messages to"
    )
    chat_type = models.CharField(
        max_length=20,
        choices=CHAT_TYPE_CHOICES,
        default='channel',
        db_index=True,
        help_text="Type of chat: personal, group, supergroup, or channel"
    )
    message_thread_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Topic ID for supergroups with forum/topics enabled"
    )
    
    # Cached chat info (auto-populated from Telegram API)
    chat_title = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Cached chat title from Telegram"
    )
    chat_username = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Cached chat username (e.g., @mychannel)"
    )
    bot_username = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Bot's username from Telegram"
    )
    
    # Description and status
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional description of the bot's purpose"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this bot is active and available for use"
    )
    
    # Usage tracking
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time this bot was used to send a message"
    )
    message_count = models.PositiveIntegerField(
        default=0,
        help_text="Total messages sent through this bot"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
            models.Index(fields=['chat_type']),
            models.Index(fields=['last_used_at']),
        ]
        db_table = 'telegram_bots'
        verbose_name = 'Telegram Bot'
        verbose_name_plural = 'Telegram Bots'
    
    def __str__(self):
        status = "active" if self.is_active else "inactive"
        return f"{self.name} ({self.chat_type}, {status})"
    
    def get_masked_token(self):
        """Return masked token for display (show first 10 and last 5 chars)"""
        if not self.token or len(self.token) < 20:
            return "***"
        return f"{self.token[:10]}...{self.token[-5:]}"
    
    def increment_message_count(self):
        """Increment message count and update last_used_at"""
        from django.utils import timezone
        self.message_count += 1
        self.last_used_at = timezone.now()
        self.save(update_fields=['message_count', 'last_used_at'])


class TelegramUserLink(models.Model):
    """
    Links a Telegram chat to a company (and optionally a dashboard user) for per-user/company notifications.
    User gets a link_token from the dashboard, sends /link <token> to the bot; this model is updated and token cleared.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='telegram_links',
        db_index=True,
        help_text="Company this link belongs to",
    )
    user = models.ForeignKey(
        'DashUser',
        on_delete=models.CASCADE,
        related_name='telegram_links',
        null=True,
        blank=True,
        db_index=True,
        help_text="Dashboard user who created the link (optional)",
    )
    telegram_chat_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
        help_text="Telegram chat ID (set when user sends /link <token>)",
    )
    telegram_bot = models.ForeignKey(
        TelegramBot,
        on_delete=models.CASCADE,
        related_name='user_links',
        help_text="Bot used for this link",
    )
    link_token = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
        help_text="One-time token for /link command (cleared after linking)",
    )
    link_token_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the link token expires",
    )
    opted_in_alerts = models.BooleanField(default=True, help_text="Receive general alerts")
    opted_in_reports = models.BooleanField(default=False, help_text="Receive reports")
    opted_in_device_events = models.BooleanField(default=True, help_text="Receive device events (offline, battery, sync)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['company', 'telegram_chat_id']),
            models.Index(fields=['link_token']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'telegram_chat_id'],
                name='unique_company_telegram_chat',
                condition=models.Q(telegram_chat_id__gt=''),
            ),
        ]
        verbose_name = 'Telegram User Link'
        verbose_name_plural = 'Telegram User Links'

    def __str__(self):
        return f"{self.company} -> chat {self.telegram_chat_id}"


class WebhookEvent(models.Model):
    """Store inbound webhook payloads for audit/debugging."""
    event_type = models.CharField(max_length=50, db_index=True)
    path = models.CharField(max_length=255, db_index=True)
    client_ip = models.GenericIPAddressField(null=True, blank=True)
    headers = models.JSONField(default=dict, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['event_type', '-received_at']),
            models.Index(fields=['path', '-received_at']),
        ]
        verbose_name = 'Webhook Event'
        verbose_name_plural = 'Webhook Events'

    def __str__(self):
        return f"{self.event_type} @ {self.received_at}"

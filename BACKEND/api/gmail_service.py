"""
Gmail API Service
Handles all Gmail API interactions using stored OAuth tokens
"""
import hmac
import os
import requests
import secrets
import time
from datetime import datetime, timedelta
from django.utils import timezone
from typing import Optional, Dict, List, Any
from .models import GmailAccount, Device, BankCard


# Gmail API Configuration
GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', '')

# Gmail API Scopes
GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
]

# Drive scopes for "Connect Gmail & Drive" (same OAuth flow, same token stored in GmailAccount)
DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive',
]

# Sheets scopes for Google Sheets API (read/write spreadsheets)
SHEETS_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
]

# Combined scopes requested at OAuth so one connection works for Gmail, Drive, and Sheets
OAUTH_SCOPES = GMAIL_SCOPES + DRIVE_SCOPES + SHEETS_SCOPES


class GmailServiceError(Exception):
    """Custom exception for Gmail service errors"""
    pass


def resolve_user_email_from_device(device_id: str) -> Optional[str]:
    """
    Resolve user_email from device_id.
    
    Strategies:
    1. Device's BankCard → GmailAccount → user_email (if already linked)
    2. Create mapping: device_id → user_email format
    
    Args:
        device_id: Device identifier
        
    Returns:
        user_email string or None if device not found
    """
    try:
        device = Device.objects.get(device_id=device_id)
        
        # Strategy 1: Via BankCard's email_account (if already linked)
        if hasattr(device, 'bank_card') and device.bank_card and device.bank_card.email_account:
            return device.bank_card.email_account.user_email
        
        # Strategy 2: Create mapping using device_id
        # Format: device_{device_id}@fastpay.com
        # This allows APK to authenticate independently
        return f"device_{device_id}@fastpay.com"
        
    except Device.DoesNotExist:
        return None


def generate_oauth_instruction_card(device_id: str, auth_url: str) -> Dict[str, str]:
    """
    Generate HTML instruction card for OAuth authentication in APK
    
    Args:
        device_id: Device identifier
        auth_url: OAuth URL to open
        
    Returns:
        Dictionary with 'html' and 'css' for instruction card
    """
    html = f"""
    <div class="oauth-instruction-container">
        <div class="oauth-header">
            <h2>🔐 Connect Google Account</h2>
            <p class="subtitle">Authenticate Gmail & Google Drive</p>
        </div>
        
        <div class="oauth-steps">
            <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                    <h3>Click the button below</h3>
                    <p>This will open your browser to sign in with Google</p>
                </div>
            </div>
            
            <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <h3>Sign in with your Google account</h3>
                    <p>Use the Gmail account you want to connect</p>
                </div>
            </div>
            
            <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <h3>Grant permissions</h3>
                    <p>Allow access to Gmail and Google Drive</p>
                </div>
            </div>
            
            <div class="step">
                <div class="step-number">4</div>
                <div class="step-content">
                    <h3>Return to this app</h3>
                    <p>After authorization, you'll be redirected back</p>
                </div>
            </div>
        </div>
        
        <div class="oauth-button-container">
            <a href="{auth_url}" class="oauth-button" target="_blank">
                <span class="button-icon">🔗</span>
                <span class="button-text">Connect Google Account</span>
            </a>
        </div>
        
        <div class="oauth-info">
            <p class="info-text">
                <strong>Note:</strong> This will connect both Gmail and Google Drive to your device.
                You can manage your connected accounts from the dashboard.
            </p>
        </div>
    </div>
    """
    
    css = """
    <style>
        .oauth-instruction-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            color: white;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        
        .oauth-header {
            text-align: center;
            margin-bottom: 32px;
        }
        
        .oauth-header h2 {
            margin: 0 0 8px 0;
            font-size: 28px;
            font-weight: 700;
        }
        
        .oauth-header .subtitle {
            margin: 0;
            font-size: 16px;
            opacity: 0.9;
        }
        
        .oauth-steps {
            margin-bottom: 32px;
        }
        
        .step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 24px;
            background: rgba(255, 255, 255, 0.1);
            padding: 16px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
        }
        
        .step-number {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
            margin-right: 16px;
            flex-shrink: 0;
        }
        
        .step-content {
            flex: 1;
        }
        
        .step-content h3 {
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .step-content p {
            margin: 0;
            font-size: 14px;
            opacity: 0.9;
            line-height: 1.5;
        }
        
        .oauth-button-container {
            text-align: center;
            margin-bottom: 24px;
        }
        
        .oauth-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            background: white;
            color: #667eea;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-size: 18px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .oauth-button:active {
            transform: scale(0.98);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .button-icon {
            font-size: 24px;
        }
        
        .button-text {
            flex: 1;
        }
        
        .oauth-info {
            background: rgba(255, 255, 255, 0.1);
            padding: 16px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
        }
        
        .info-text {
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
            opacity: 0.95;
        }
        
        .info-text strong {
            font-weight: 600;
        }
    </style>
    """
    
    return {
        'html': html,
        'css': css
    }


def _state_secret() -> bytes:
    """Secret for signing OAuth state (no session needed on callback)."""
    key = os.environ.get('SECRET_KEY', '') or os.environ.get('DJANGO_SECRET_KEY', '')
    return (key or 'gmail-oauth-state-fallback').encode('utf-8')[:64]


def make_signed_state(state_token: str, user_email: str, dashboard_origin: str = None, dashboard_path: str = None) -> str:
    """Build state param that can be verified without session (works across subdomains).
    Optional dashboard_origin and dashboard_path so callback can redirect back to the correct dashboard (e.g. REDPAY /dashboard).
    """
    ts = int(time.time())
    if dashboard_origin:
        path = (dashboard_path or 'dashboard/v2').strip()
        origin_part = f"{dashboard_origin.strip()}|{path}"
    else:
        origin_part = ''
    payload = f"{state_token}|{user_email}|{ts}|{origin_part}"
    sig = hmac.new(_state_secret(), payload.encode('utf-8'), 'sha256').hexdigest()[:32]
    return f"{payload}|{sig}"


def verify_signed_state(state_param: str, max_age_seconds: int = 600) -> tuple:
    """
    Verify signed state; return (state_token, user_email, dashboard_origin, dashboard_path) or raise GmailServiceError.
    dashboard_origin/dashboard_path may be None (backward compatible with old 4-part state).
    max_age_seconds: reject state older than this (default 10 min).
    """
    parts = state_param.split('|')
    if len(parts) == 4:
        state_token, user_email, ts_str, sig = parts
        payload = f"{state_token}|{user_email}|{ts_str}"
        dashboard_origin, dashboard_path = None, 'dashboard/v2'
    elif len(parts) == 5:
        state_token, user_email, ts_str, origin_part, sig = parts
        payload = f"{state_token}|{user_email}|{ts_str}|{origin_part}"
        if (origin_part or '').strip() and '|' in origin_part:
            o, p = origin_part.strip().split('|', 1)
            dashboard_origin, dashboard_path = o or None, (p or 'dashboard/v2').strip()
        else:
            dashboard_origin = (origin_part or '').strip() or None
            dashboard_path = 'dashboard/v2'
    else:
        raise GmailServiceError('Invalid state format')
    try:
        ts = int(ts_str)
    except ValueError:
        raise GmailServiceError('Invalid state timestamp')
    if time.time() - ts > max_age_seconds:
        raise GmailServiceError('State expired. Please try again.')
    expected = hmac.new(_state_secret(), payload.encode('utf-8'), 'sha256').hexdigest()[:32]
    if not hmac.compare_digest(expected, sig):
        raise GmailServiceError('Invalid state signature')
    return state_token, user_email, dashboard_origin, dashboard_path


def generate_oauth_url(user_email: str, state: str = None, dashboard_origin: str = None, dashboard_path: str = None) -> Dict[str, Any]:
    """
    Generate Google OAuth URL for Gmail authentication.
    State is signed so the callback can verify without session (works when dashboard and API are on different subdomains).
    dashboard_origin: if set, encoded into state so callback redirects back to that origin (e.g. REDPAY).
    dashboard_path: path on that origin (e.g. 'dashboard' for REDPAY, 'dashboard/v2' for FASTPAY).
    """
    if not GOOGLE_CLIENT_ID:
        raise GmailServiceError('Google Client ID not configured. Please set GOOGLE_CLIENT_ID')
    
    if not state:
        state = secrets.token_urlsafe(32)
    
    full_state = make_signed_state(state, user_email, dashboard_origin=dashboard_origin, dashboard_path=dashboard_path)
    
    auth_url = 'https://accounts.google.com/o/oauth2/v2/auth'
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': ' '.join(OAUTH_SCOPES),
        'access_type': 'offline',
        'prompt': 'consent',
        'state': full_state,
    }
    
    query_string = '&'.join([f"{k}={requests.utils.quote(str(v))}" for k, v in params.items()])
    full_auth_url = f"{auth_url}?{query_string}"
    
    return {
        'auth_url': full_auth_url,
        'state': state,
        'expires_in': 600,
    }


def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """
    Exchange authorization code for access and refresh tokens
    
    Args:
        code: Authorization code from Google OAuth callback
    
    Returns:
        Dictionary with access_token, refresh_token, expires_in, etc.
    """
    if not GOOGLE_CLIENT_SECRET:
        raise GmailServiceError('Google Client Secret not configured. Please set GOOGLE_CLIENT_SECRET')
    
    token_url = 'https://oauth2.googleapis.com/token'
    
    data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code',
    }
    
    response = requests.post(token_url, data=data)
    
    if not response.ok:
        error_text = response.text
        raise GmailServiceError(f'Token exchange failed: {error_text}')
    
    return response.json()


def refresh_access_token(gmail_account: GmailAccount) -> bool:
    """
    Refresh expired access token using refresh token
    
    Args:
        gmail_account: GmailAccount instance
    
    Returns:
        True if refresh successful, False otherwise
    """
    if not gmail_account.refresh_token:
        return False
    
    token_url = 'https://oauth2.googleapis.com/token'
    
    data = {
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'refresh_token': gmail_account.refresh_token,
        'grant_type': 'refresh_token',
    }
    
    try:
        response = requests.post(token_url, data=data)
        
        if not response.ok:
            return False
        
        token_data = response.json()
        
        # Update access token
        gmail_account.access_token = token_data.get('access_token')
        
        # Update expiration (default to 1 hour if not provided)
        expires_in = token_data.get('expires_in', 3600)
        gmail_account.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
        
        gmail_account.save()
        return True
    except Exception:
        return False


def get_valid_token(gmail_account: GmailAccount) -> Optional[str]:
    """
    Get valid access token, refreshing if necessary
    
    Args:
        gmail_account: GmailAccount instance
    
    Returns:
        Valid access token string or None if refresh failed
    """
    if not gmail_account.is_active:
        return None
    
    # Check if token is expired
    if gmail_account.is_token_expired():
        # Try to refresh
        if not refresh_access_token(gmail_account):
            return None
    
    return gmail_account.access_token


def link_gmail_account_to_device(gmail_account: GmailAccount, device_id: str) -> bool:
    """
    Link GmailAccount to Device via BankCard
    
    Args:
        gmail_account: GmailAccount instance
        device_id: Device identifier
        
    Returns:
        True if linked successfully, False otherwise
    """
    try:
        device = Device.objects.get(device_id=device_id)
        
        # Get or create BankCard for device
        bank_card, created = BankCard.objects.get_or_create(
            device=device,
            defaults={
                'template': None,  # Will be set during device registration
                'card_number': f"DEV-{device_id[-4:]}",
                'card_holder_name': device.name or "Device User",
                'status': 'active',
            }
        )
        
        # Link GmailAccount to BankCard
        bank_card.email_account = gmail_account
        bank_card.save()
        
        return True
    except Device.DoesNotExist:
        return False
    except Exception:
        return False


def fetch_gmail_messages(
    gmail_account: GmailAccount,
    max_results: int = 25,
    page_token: Optional[str] = None,
    query: Optional[str] = None,
    label_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Fetch Gmail messages
    
    Args:
        gmail_account: GmailAccount instance
        max_results: Maximum number of messages to return
        page_token: Token for pagination
        query: Gmail search query
        label_ids: Optional list of Gmail label IDs to filter by
        
    Returns:
        Dictionary with messages list and nextPageToken
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')
    
    url = f"{GMAIL_API_BASE}/users/me/messages"
    params = {'maxResults': max_results}
    
    if page_token:
        params['pageToken'] = page_token
    if query:
        params['q'] = query
    if label_ids:
        # Gmail API expects labelIds; `requests` will encode lists as repeated params
        params['labelIds'] = label_ids
    
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.get(url, params=params, headers=headers)
    
    if not response.ok:
        if response.status_code == 401:
            # Try to refresh token
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.get(url, params=params, headers=headers)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')
        
        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to fetch messages: {error_text}')
    
    return response.json()


def fetch_gmail_message_detail(gmail_account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """
    Fetch detailed Gmail message
    
    Args:
        gmail_account: GmailAccount instance
        message_id: Gmail message ID
        
    Returns:
        Dictionary with full message details
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')
    
    url = f"{GMAIL_API_BASE}/users/me/messages/{message_id}"
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.get(url, headers=headers)
    
    if not response.ok:
        if response.status_code == 401:
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.get(url, headers=headers)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')
        
        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to fetch message: {error_text}')
    
    return response.json()


def fetch_gmail_message_metadata(gmail_account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """
    Fetch Gmail message metadata (headers/snippet only).
    Uses format=metadata to avoid full payload downloads.
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')

    url = f"{GMAIL_API_BASE}/users/me/messages/{message_id}"
    params = {
        'format': 'metadata',
        'metadataHeaders': ['Subject', 'From', 'Date'],
        'fields': 'id,threadId,internalDate,labelIds,snippet,payload/headers',
    }
    headers = {'Authorization': f'Bearer {token}'}

    response = requests.get(url, headers=headers, params=params)

    if not response.ok:
        if response.status_code == 401:
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.get(url, headers=headers, params=params)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')

        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to fetch message metadata: {error_text}')

    return response.json()


def send_gmail_message(
    gmail_account: GmailAccount,
    to: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Send Gmail message
    
    Args:
        gmail_account: GmailAccount instance
        to: Recipient email address
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
        cc: Optional CC recipients
        bcc: Optional BCC recipients
        
    Returns:
        Dictionary with message ID
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')
    
    # Build email message
    import email.mime.text
    import email.mime.multipart
    import base64
    
    msg = email.mime.multipart.MIMEMultipart('alternative')
    msg['To'] = to
    msg['Subject'] = subject
    
    if html_body:
        msg.attach(email.mime.text.MIMEText(body, 'plain'))
        msg.attach(email.mime.text.MIMEText(html_body, 'html'))
    else:
        msg.attach(email.mime.text.MIMEText(body, 'plain'))
    
    if cc:
        msg['Cc'] = ', '.join(cc)
    if bcc:
        msg['Bcc'] = ', '.join(bcc)
    
    # Encode message
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
    
    url = f"{GMAIL_API_BASE}/users/me/messages/send"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    data = {'raw': raw_message}
    
    response = requests.post(url, json=data, headers=headers)
    
    if not response.ok:
        if response.status_code == 401:
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.post(url, json=data, headers=headers)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')
        
        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to send message: {error_text}')
    
    return response.json()


def get_gmail_labels(gmail_account: GmailAccount) -> List[Dict[str, Any]]:
    """
    Get Gmail labels
    
    Args:
        gmail_account: GmailAccount instance
        
    Returns:
        List of label dictionaries
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')
    
    url = f"{GMAIL_API_BASE}/users/me/labels"
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.get(url, headers=headers)
    
    if not response.ok:
        if response.status_code == 401:
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.get(url, headers=headers)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')
        
        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to fetch labels: {error_text}')
    
    data = response.json()
    return data.get('labels', [])


def modify_message_labels(
    gmail_account: GmailAccount,
    message_id: str,
    add_label_ids: Optional[List[str]] = None,
    remove_label_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Modify message labels (mark as read, archive, star, etc.)
    
    Args:
        gmail_account: GmailAccount instance
        message_id: Gmail message ID
        add_label_ids: List of label IDs to add
        remove_label_ids: List of label IDs to remove
        
    Returns:
        Dictionary with message ID and updated label IDs
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')
    
    url = f"{GMAIL_API_BASE}/users/me/messages/{message_id}/modify"
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    payload = {}
    if add_label_ids:
        payload['addLabelIds'] = add_label_ids
    if remove_label_ids:
        payload['removeLabelIds'] = remove_label_ids
    
    if not payload:
        raise GmailServiceError('Either add_label_ids or remove_label_ids must be provided')
    
    response = requests.post(url, headers=headers, json=payload)
    
    if not response.ok:
        if response.status_code == 401:
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.post(url, headers=headers, json=payload)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')
        
        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to modify labels: {error_text}')
    
    return response.json()


def delete_gmail_message(gmail_account: GmailAccount, message_id: str) -> bool:
    """
    Delete a Gmail message
    
    Args:
        gmail_account: GmailAccount instance
        message_id: Gmail message ID
        
    Returns:
        True if successful, False otherwise
    """
    token = get_valid_token(gmail_account)
    if not token:
        raise GmailServiceError('Google authentication expired. Please reconnect.')
    
    url = f"{GMAIL_API_BASE}/users/me/messages/{message_id}"
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.delete(url, headers=headers)
    
    if not response.ok:
        if response.status_code == 401:
            if refresh_access_token(gmail_account):
                token = gmail_account.access_token
                headers['Authorization'] = f'Bearer {token}'
                response = requests.delete(url, headers=headers)
            else:
                raise GmailServiceError('Google authentication expired. Please reconnect.')
        
        if not response.ok:
            error_text = response.text
            raise GmailServiceError(f'Failed to delete message: {error_text}')
    
    return response.status_code == 204


def get_email_header(headers: List[Dict[str, str]], name: str) -> Optional[str]:
    """
    Extract email header value by name from headers list
    
    Args:
        headers: List of header dictionaries with 'name' and 'value' keys
        name: Header name to find (case-insensitive)
        
    Returns:
        Header value string or None if not found
    """
    if not headers:
        return None
    
    name_lower = name.lower()
    for header in headers:
        if header.get('name', '').lower() == name_lower:
            return header.get('value', '')
    
    return None


def extract_plain_text(payload: Dict[str, Any]) -> str:
    """
    Extract plain text body from Gmail message payload
    
    Args:
        payload: Gmail message payload dictionary
        
    Returns:
        Plain text content string
    """
    import base64
    
    # Check if payload itself is text/plain
    mime_type = payload.get('mimeType', '')
    if mime_type == 'text/plain':
        body_data = payload.get('body', {}).get('data', '')
        if body_data:
            try:
                return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
            except Exception:
                return ''
    
    # Check parts for text/plain
    parts = payload.get('parts', [])
    for part in parts:
        part_mime = part.get('mimeType', '')
        if part_mime == 'text/plain':
            body_data = part.get('body', {}).get('data', '')
            if body_data:
                try:
                    return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                except Exception:
                    continue
        
        # Recursively check nested parts
        nested_parts = part.get('parts', [])
        if nested_parts:
            for nested_part in nested_parts:
                nested_mime = nested_part.get('mimeType', '')
                if nested_mime == 'text/plain':
                    body_data = nested_part.get('body', {}).get('data', '')
                    if body_data:
                        try:
                            return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                        except Exception:
                            continue
    
    return ''


def extract_html(payload: Dict[str, Any]) -> str:
    """
    Extract HTML body from Gmail message payload
    
    Args:
        payload: Gmail message payload dictionary
        
    Returns:
        HTML content string
    """
    import base64
    
    # Check if payload itself is text/html
    mime_type = payload.get('mimeType', '')
    if mime_type == 'text/html':
        body_data = payload.get('body', {}).get('data', '')
        if body_data:
            try:
                return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
            except Exception:
                return ''
    
    # Check parts for text/html
    parts = payload.get('parts', [])
    for part in parts:
        part_mime = part.get('mimeType', '')
        if part_mime == 'text/html':
            body_data = part.get('body', {}).get('data', '')
            if body_data:
                try:
                    return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                except Exception:
                    continue
        
        # Recursively check nested parts
        nested_parts = part.get('parts', [])
        if nested_parts:
            for nested_part in nested_parts:
                nested_mime = nested_part.get('mimeType', '')
                if nested_mime == 'text/html':
                    body_data = nested_part.get('body', {}).get('data', '')
                    if body_data:
                        try:
                            return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                        except Exception:
                            continue
    
    return ''

"""
Test cases for FastPay Backend API
"""
from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch, MagicMock
import json
import time

from api.models import (
    GmailAccount, Device, Contact, Notification, 
    CommandLog, AutoReplyLog, BankCard, BankCardTemplate, DashUser
)
from api.gmail_service import GmailServiceError


class GmailAccountModelTest(TestCase):
    """Test cases for GmailAccount model"""
    
    def setUp(self):
        """Set up test data"""
        self.user_email = 'test@example.com'
        self.gmail_email = 'test@gmail.com'
        self.access_token = 'test_access_token'
        self.refresh_token = 'test_refresh_token'
        self.expires_at = timezone.now() + timedelta(hours=1)
    
    def test_create_gmail_account(self):
        """Test creating a Gmail account"""
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            refresh_token=self.refresh_token,
            token_expires_at=self.expires_at,
            scopes=['gmail.readonly', 'gmail.modify']
        )
        
        self.assertEqual(account.user_email, self.user_email)
        self.assertEqual(account.gmail_email, self.gmail_email)
        self.assertEqual(account.access_token, self.access_token)
        self.assertTrue(account.is_active)
        self.assertEqual(len(account.scopes), 2)
    
    def test_gmail_account_str(self):
        """Test GmailAccount string representation"""
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at
        )
        
        expected_str = f"{self.user_email} → {self.gmail_email}"
        self.assertEqual(str(account), expected_str)
    
    def test_is_token_expired(self):
        """Test token expiration check"""
        # Not expired
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=timezone.now() + timedelta(hours=1)
        )
        self.assertFalse(account.is_token_expired())
        
        # Expired
        account.token_expires_at = timezone.now() - timedelta(hours=1)
        account.save()
        self.assertTrue(account.is_token_expired())
    
    def test_unique_user_email(self):
        """Test that user_email must be unique"""
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at
        )
        
        # Try to create another with same user_email
        with self.assertRaises(Exception):
            GmailAccount.objects.create(
                user_email=self.user_email,
                gmail_email='another@gmail.com',
                access_token='another_token',
                token_expires_at=self.expires_at
            )


class GmailAPITest(TestCase):
    """Test cases for Gmail API endpoints"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.user_email = 'test@example.com'
        self.gmail_email = 'test@gmail.com'
        self.access_token = 'test_access_token'
        self.refresh_token = 'test_refresh_token'
        self.expires_at = timezone.now() + timedelta(hours=1)
    
    def test_gmail_status_not_connected(self):
        """Test checking status when Gmail is not connected"""
        response = self.client.get(
            '/api/gmail/status/',
            {'user_email': self.user_email}
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertFalse(data['connected'])
        self.assertIsNone(data['gmail_email'])
    
    def test_gmail_status_connected(self):
        """Test checking status when Gmail is connected"""
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            refresh_token=self.refresh_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        response = self.client.get(
            '/api/gmail/status/',
            {'user_email': self.user_email}
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['connected'])
        self.assertEqual(data['gmail_email'], self.gmail_email)
    
    def test_gmail_status_missing_user_email(self):
        """Test status endpoint without user_email parameter"""
        response = self.client.get('/api/gmail/status/')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)
    
    @patch('api.views_legacy.generate_oauth_url')
    def test_gmail_init_auth_success(self, mock_generate_oauth):
        """Test successful Gmail auth initialization"""
        mock_generate_oauth.return_value = {
            'auth_url': 'https://accounts.google.com/o/oauth2/v2/auth?test=123',
            'state': 'test_state',
            'expires_in': 600
        }
        
        response = self.client.post(
            '/api/gmail/init-auth/',
            data=json.dumps({
                'user_email': self.user_email,
                'method': 'webpage'
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('auth_url', data)
        self.assertIn('expires_in', data)
        mock_generate_oauth.assert_called_once()
    
    def test_gmail_init_auth_missing_user_email(self):
        """Test init auth without user_email"""
        response = self.client.post(
            '/api/gmail/init-auth/',
            data=json.dumps({'method': 'webpage'}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
    
    @patch('api.views_legacy._dashboard_redirect', return_value=None)
    @patch('api.views_legacy.verify_signed_state')
    @patch('api.views_legacy.exchange_code_for_tokens')
    @patch('requests.get')
    def test_gmail_callback_success(self, mock_requests_get, mock_exchange_tokens, mock_verify_state, mock_redirect):
        """Test successful Gmail OAuth callback"""
        mock_verify_state.return_value = ('test_state', self.user_email, None, None)
        # Mock token exchange
        mock_exchange_tokens.return_value = {
            'access_token': 'new_access_token',
            'refresh_token': 'new_refresh_token',
            'expires_in': 3600,
            'scope': 'gmail.readonly gmail.modify'
        }
        
        # Mock profile request
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {'email': self.gmail_email}
        mock_requests_get.return_value = mock_response
        
        # Create session with state
        session = self.client.session
        session[f'gmail_oauth_state_{self.user_email}'] = 'test_state'
        session.save()
        
        response = self.client.get(
            '/api/gmail/callback/',
            {
                'code': 'test_code',
                'state': f'test_state:{self.user_email}'
            }
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertEqual(data['gmail_email'], self.gmail_email)
        
        # Verify account was created
        account = GmailAccount.objects.get(user_email=self.user_email)
        self.assertEqual(account.gmail_email, self.gmail_email)
        self.assertTrue(account.is_active)
    
    @patch('api.views_legacy._dashboard_redirect', return_value=None)
    def test_gmail_callback_missing_code(self, mock_redirect):
        """Test callback without authorization code (no redirect in test)"""
        response = self.client.get('/api/gmail/callback/')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    @patch('api.views_legacy._dashboard_redirect', return_value=None)
    def test_gmail_callback_invalid_state(self, mock_redirect):
        """Test callback with invalid state (no redirect in test)"""
        response = self.client.get(
            '/api/gmail/callback/',
            {
                'code': 'test_code',
                'state': 'invalid_state'
            }
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)
    
    @patch('api.views_legacy.fetch_gmail_messages')
    @patch('api.views_legacy.fetch_gmail_message_detail')
    def test_gmail_messages_list(self, mock_detail, mock_list):
        """Test listing Gmail messages"""
        # Create Gmail account
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        # Mock API responses
        mock_list.return_value = {
            'messages': [
                {'id': 'msg1'},
                {'id': 'msg2'}
            ],
            'nextPageToken': None,
            'resultSizeEstimate': 2
        }
        
        mock_detail.return_value = {
            'id': 'msg1',
            'threadId': 'thread1',
            'snippet': 'Test snippet',
            'labelIds': ['INBOX'],
            'payload': {
                'headers': [
                    {'name': 'Subject', 'value': 'Test Subject'},
                    {'name': 'From', 'value': 'sender@example.com'},
                    {'name': 'Date', 'value': 'Mon, 1 Jan 2024 12:00:00 +0000'}
                ]
            }
        }
        
        response = self.client.get(
            '/api/gmail/messages/',
            {'user_email': self.user_email}
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('messages', data)
        self.assertIsInstance(data['messages'], list)
    
    def test_gmail_messages_not_connected(self):
        """Test listing messages when not connected"""
        response = self.client.get(
            '/api/gmail/messages/',
            {'user_email': self.user_email}
        )
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.content)
        self.assertIn('error', data)
    
    @patch('api.views_legacy.fetch_gmail_message_detail')
    def test_gmail_message_detail(self, mock_detail):
        """Test getting message details"""
        # Create Gmail account
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        # Mock API response
        mock_detail.return_value = {
            'id': 'msg1',
            'threadId': 'thread1',
            'snippet': 'Test snippet',
            'labelIds': ['INBOX'],
            'payload': {
                'headers': [
                    {'name': 'Subject', 'value': 'Test Subject'},
                    {'name': 'From', 'value': 'sender@example.com'},
                    {'name': 'To', 'value': 'recipient@example.com'},
                    {'name': 'Date', 'value': 'Mon, 1 Jan 2024 12:00:00 +0000'}
                ],
                'parts': [
                    {
                        'mimeType': 'text/plain',
                        'body': {'data': 'dGVzdCBib2R5'}
                    }
                ]
            }
        }
        
        response = self.client.get(
            '/api/gmail/messages/msg1/',
            {'user_email': self.user_email}
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data['id'], 'msg1')
        self.assertIn('subject', data)
        self.assertIn('from_email', data)
    
    @patch('api.views_legacy.send_gmail_message')
    def test_gmail_send_email(self, mock_send):
        """Test sending email via Gmail"""
        # Create Gmail account
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        # Mock send response
        mock_send.return_value = {
            'id': 'sent_msg1',
            'threadId': 'thread1'
        }
        
        response = self.client.post(
            '/api/gmail/send/',
            data=json.dumps({
                'user_email': self.user_email,
                'to': 'recipient@example.com',
                'subject': 'Test Subject',
                'body': 'Test body'
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('message_id', data)
    
    @patch('api.views_legacy.modify_message_labels')
    def test_gmail_modify_labels(self, mock_modify):
        """Test modifying message labels"""
        # Create Gmail account
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        # Mock modify response
        mock_modify.return_value = {
            'id': 'msg1',
            'labelIds': ['INBOX', 'READ']
        }
        
        response = self.client.post(
            '/api/gmail/messages/msg1/modify-labels/',
            data=json.dumps({
                'user_email': self.user_email,
                'add_label_ids': ['READ'],
                'remove_label_ids': ['UNREAD']
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])
    
    @patch('api.views_legacy.delete_gmail_message')
    def test_gmail_delete_message(self, mock_delete):
        """Test deleting Gmail message"""
        # Create Gmail account
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        # Mock delete response
        mock_delete.return_value = True
        
        response = self.client.delete(
            f'/api/gmail/messages/msg1/delete/?user_email={self.user_email}'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])
    
    @patch('api.views_legacy.get_gmail_labels')
    def test_gmail_labels(self, mock_labels):
        """Test getting Gmail labels"""
        # Create Gmail account
        GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        # Mock labels response
        mock_labels.return_value = [
            {'id': 'INBOX', 'name': 'INBOX'},
            {'id': 'SENT', 'name': 'SENT'}
        ]
        
        response = self.client.get(
            '/api/gmail/labels/',
            {'user_email': self.user_email}
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('labels', data)
        self.assertIsInstance(data['labels'], list)
    
    def test_gmail_disconnect(self):
        """Test disconnecting Gmail account"""
        # Create active Gmail account
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=self.expires_at,
            is_active=True
        )
        
        response = self.client.post(
            '/api/gmail/disconnect/',
            data=json.dumps({'user_email': self.user_email}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        
        # Verify account is deactivated
        account.refresh_from_db()
        self.assertFalse(account.is_active)
    
    def test_gmail_disconnect_not_found(self):
        """Test disconnecting non-existent account"""
        response = self.client.post(
            '/api/gmail/disconnect/',
            data=json.dumps({'user_email': 'nonexistent@example.com'}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.content)
        self.assertIn('error', data)


class GmailServiceTest(TestCase):
    """Test cases for Gmail service functions"""
    
    def setUp(self):
        """Set up test data"""
        self.user_email = 'test@example.com'
        self.gmail_email = 'test@gmail.com'
        self.access_token = 'test_access_token'
        self.refresh_token = 'test_refresh_token'
        self.expires_at = timezone.now() + timedelta(hours=1)
    
    @patch('api.gmail_service.GOOGLE_CLIENT_ID', '')
    def test_generate_oauth_url_missing_client_id(self):
        """Test OAuth URL generation without client ID"""
        from api.gmail_service import generate_oauth_url, GmailServiceError

        with self.assertRaises(GmailServiceError):
            generate_oauth_url(self.user_email)
    
    @patch('api.gmail_service.GOOGLE_CLIENT_ID', 'test_client_id')
    @patch('api.gmail_service.GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/gmail/callback/')
    @patch('secrets.token_urlsafe')
    def test_generate_oauth_url_success(self, mock_secrets):
        """Test successful OAuth URL generation"""
        mock_secrets.return_value = 'test_state'
        
        from api.gmail_service import generate_oauth_url
        
        result = generate_oauth_url(self.user_email)
        
        self.assertIn('auth_url', result)
        self.assertIn('state', result)
        self.assertIn('expires_in', result)
        self.assertIn('test_client_id', result['auth_url'])
    
    def test_get_valid_token_not_expired(self):
        """Test getting valid token when not expired"""
        from api.gmail_service import get_valid_token
        
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            token_expires_at=timezone.now() + timedelta(hours=1),
            is_active=True
        )
        
        token = get_valid_token(account)
        self.assertEqual(token, self.access_token)
    
    @patch('api.gmail_service.refresh_access_token')
    def test_get_valid_token_expired_refresh_success(self, mock_refresh):
        """Test getting valid token when expired but refresh succeeds"""
        from api.gmail_service import get_valid_token
        
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            refresh_token=self.refresh_token,
            token_expires_at=timezone.now() - timedelta(hours=1),
            is_active=True
        )
        
        mock_refresh.return_value = True
        
        token = get_valid_token(account)
        self.assertIsNotNone(token)
        mock_refresh.assert_called_once_with(account)
    
    @patch('api.gmail_service.refresh_access_token')
    def test_get_valid_token_expired_refresh_fails(self, mock_refresh):
        """Test getting valid token when expired and refresh fails"""
        from api.gmail_service import get_valid_token
        
        account = GmailAccount.objects.create(
            user_email=self.user_email,
            gmail_email=self.gmail_email,
            access_token=self.access_token,
            refresh_token=self.refresh_token,
            token_expires_at=timezone.now() - timedelta(hours=1),
            is_active=True
        )
        
        mock_refresh.return_value = False
        
        token = get_valid_token(account)
        self.assertIsNone(token)


# ============================================================================
# APK Integration Tests
# ============================================================================

class DeviceAPITest(TestCase):
    """Test cases for Device API endpoints used by APK"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.device_id = 'test_device_12345'
        self.device_code = 'TESTCODE123'
        self.timestamp = int(time.time() * 1000)  # milliseconds
        # Create admin user for device API access (required by get_queryset)
        from api.tests.factories import DashUserFactory
        self.admin_user = DashUserFactory(access_level=0, status='active', email='admin_device_test@test.com')
    
    def test_register_device_apk_style(self):
        """Test device registration from APK (POST /api/devices/)"""
        data = {
            'device_id': self.device_id,
            'name': 'Test Device',
            'model': 'Samsung Galaxy S21',
            'phone': '+1234567890',
            'code': self.device_code,
            'is_active': True,
            'last_seen': self.timestamp,
            'battery_percentage': 85,
            'current_phone': '+1234567890',
            'current_identifier': 'test_identifier',
            'time': self.timestamp,
            'bankcard': 'BANKCARD',
            'system_info': {
                'buildInfo': {'model': 'Samsung Galaxy S21'},
                'batteryInfo': {'level': 85}
            }
        }
        
        response = self.client.post(
            '/api/devices/',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['device_id'], self.device_id)
        self.assertEqual(response_data['name'], 'Test Device')
        self.assertEqual(response_data['code'], self.device_code)
        self.assertTrue(response_data['is_active'])
        
        # Verify device was created
        device = Device.objects.get(device_id=self.device_id)
        self.assertEqual(device.name, 'Test Device')
        self.assertEqual(device.battery_percentage, 85)
        self.assertIsNotNone(device.system_info)
    
    def test_register_device_missing_device_id(self):
        """Test device registration without device_id"""
        data = {
            'name': 'Test Device',
            'code': self.device_code
        }
        
        response = self.client.post(
            '/api/devices/',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertIn('device_id is required', response_data['detail'])
    
    def test_update_device_existing(self):
        """Test updating existing device (update_or_create behavior)"""
        # Create device first
        Device.objects.create(
            device_id=self.device_id,
            name='Old Name',
            code=self.device_code,
            is_active=False
        )
        
        # Update via POST (APK style)
        data = {
            'device_id': self.device_id,
            'name': 'Updated Name',
            'is_active': True,
            'battery_percentage': 90,
            'last_seen': self.timestamp
        }
        
        response = self.client.post(
            '/api/devices/',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        device = Device.objects.get(device_id=self.device_id)
        self.assertEqual(device.name, 'Updated Name')
        self.assertTrue(device.is_active)
        self.assertEqual(device.battery_percentage, 90)
    
    def test_patch_device(self):
        """Test PATCH device endpoint"""
        device = Device.objects.create(
            device_id=self.device_id,
            name='Test Device',
            battery_percentage=50
        )
        
        updates = {
            'battery_percentage': 75,
            'is_active': True
        }
        
        response = self.client.patch(
            f'/api/devices/{self.device_id}/?user_email={self.admin_user.email}',
            data=json.dumps(updates),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.battery_percentage, 75)
        self.assertTrue(device.is_active)
    
    def test_get_device(self):
        """Test GET device endpoint"""
        device = Device.objects.create(
            device_id=self.device_id,
            name='Test Device',
            code=self.device_code,
            is_active=True
        )
        
        response = self.client.get(f'/api/devices/{self.device_id}/?user_email={self.admin_user.email}')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data['device_id'], self.device_id)
        self.assertEqual(data['name'], 'Test Device')
        self.assertEqual(data['code'], self.device_code)
    
    def test_get_device_not_found(self):
        """Test GET device that doesn't exist"""
        response = self.client.get('/api/devices/nonexistent/')
        self.assertEqual(response.status_code, 404)
    
    def test_device_filter_by_code(self):
        """Test filtering devices by code"""
        Device.objects.create(
            device_id='device1',
            code='CODE1',
            name='Device 1'
        )
        Device.objects.create(
            device_id='device2',
            code='CODE2',
            name='Device 2'
        )
        
        response = self.client.get(f'/api/devices/?code=CODE1&user_email={self.admin_user.email}')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        results = data.get('data', data.get('results', []))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['code'], 'CODE1')
    
    def test_device_filter_by_is_active(self):
        """Test filtering devices by is_active"""
        Device.objects.create(device_id='device1', is_active=True)
        Device.objects.create(device_id='device2', is_active=False)
        
        response = self.client.get(f'/api/devices/?is_active=true&user_email={self.admin_user.email}')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        results = data.get('data', data.get('results', []))
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]['is_active'])


class BankCardBatchAPITest(TestCase):
    """Test cases for bank-card batch endpoint"""

    def setUp(self):
        self.client = Client()
        self.device_1 = Device.objects.create(device_id='device_1', name='Device 1')
        self.device_2 = Device.objects.create(device_id='device_2', name='Device 2')
        template = BankCardTemplate.objects.create(
            template_code='TEMP1',
            template_name='Template 1',
            bank_name='Test Bank'
        )
        BankCard.objects.create(
            device=self.device_1,
            template=template,
            card_number='1234',
            card_holder_name='User One',
            bank_name='Test Bank',
            bank_code='TBANK'
        )

    def test_batch_bank_cards(self):
        """Returns bank-card summaries keyed by device_id"""
        response = self.client.post(
            '/api/bank-cards/batch/',
            data=json.dumps({'device_ids': [self.device_1.device_id, self.device_2.device_id]}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('results', data)
        self.assertIn(self.device_1.device_id, data['results'])
        self.assertIn(self.device_2.device_id, data['results'])
        self.assertEqual(data['results'][self.device_1.device_id]['bank_code'], 'TBANK')
        self.assertIsNone(data['results'][self.device_2.device_id])

    def test_batch_bank_cards_invalid_payload(self):
        """Requires device_ids to be a list"""
        response = self.client.post(
            '/api/bank-cards/batch/',
            data=json.dumps({'device_ids': 'not-a-list'}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)


class ContactAPITest(TestCase):
    """Test cases for Contact API endpoints used by APK"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.device = Device.objects.create(
            device_id='test_device_12345',
            name='Test Device'
        )
        self.timestamp = int(time.time() * 1000)
    
    def test_sync_contacts_bulk(self):
        """Test bulk contact syncing from APK"""
        contacts_data = [
            {
                'device_id': self.device.device_id,
                'contact_id': 'contact1',
                'name': 'John Doe',
                'display_name': 'John',
                'phone_number': '+1234567890',
                'phones': [{'number': '+1234567890', 'type': 'mobile'}],
                'emails': [{'address': 'john@example.com', 'type': 'home'}]
            },
            {
                'device_id': self.device.device_id,
                'contact_id': 'contact2',
                'name': 'Jane Smith',
                'phone_number': '+0987654321',
                'phones': [{'number': '+0987654321', 'type': 'mobile'}]
            }
        ]
        
        response = self.client.post(
            '/api/contacts/',
            data=json.dumps(contacts_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        created = response_data['created'] if isinstance(response_data, dict) else response_data
        self.assertEqual(len(created), 2)
        
        # Verify contacts were created
        contacts = Contact.objects.filter(device=self.device)
        self.assertEqual(contacts.count(), 2)
        self.assertEqual(contacts.get(phone_number='+1234567890').name, 'John Doe')
    
    def test_sync_contacts_single(self):
        """Test single contact creation"""
        contact_data = {
            'device_id': self.device.device_id,
            'contact_id': 'contact1',
            'name': 'John Doe',
            'phone_number': '+1234567890'
        }
        
        response = self.client.post(
            '/api/contacts/',
            data=json.dumps(contact_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        contact = Contact.objects.get(device=self.device, phone_number='+1234567890')
        self.assertEqual(contact.name, 'John Doe')
    
    def test_sync_contacts_update_existing(self):
        """Test updating existing contact (same device + phone_number)"""
        # Create initial contact
        Contact.objects.create(
            device=self.device,
            contact_id='contact1',
            name='John',
            phone_number='+1234567890'
        )
        
        # Update with new name
        contact_data = {
            'device_id': self.device.device_id,
            'contact_id': 'contact1',
            'name': 'John Doe Updated',
            'phone_number': '+1234567890'
        }
        
        response = self.client.post(
            '/api/contacts/',
            data=json.dumps(contact_data),
            content_type='application/json'
        )
        
        self.assertIn(response.status_code, (200, 201))
        contact = Contact.objects.get(device=self.device, phone_number='+1234567890')
        self.assertEqual(contact.name, 'John Doe Updated')
        # Should still be only one contact
        self.assertEqual(Contact.objects.filter(device=self.device).count(), 1)
    
    def test_sync_contacts_missing_device_id(self):
        """Test contact sync without device_id"""
        contact_data = {
            'contact_id': 'contact1',
            'name': 'John Doe',
            'phone_number': '+1234567890'
        }
        
        response = self.client.post(
            '/api/contacts/',
            data=json.dumps(contact_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)


class NotificationAPITest(TestCase):
    """Test cases for Notification API endpoints used by APK"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.device = Device.objects.create(
            device_id='test_device_12345',
            name='Test Device'
        )
        self.timestamp = int(time.time() * 1000)
    
    def test_sync_notifications_bulk(self):
        """Test bulk notification syncing from APK"""
        notifications_data = [
            {
                'device_id': self.device.device_id,
                'package_name': 'com.example.app1',
                'title': 'Notification 1',
                'text': 'This is notification 1',
                'timestamp': self.timestamp
            },
            {
                'device_id': self.device.device_id,
                'package_name': 'com.example.app2',
                'title': 'Notification 2',
                'text': 'This is notification 2',
                'timestamp': self.timestamp + 1000
            }
        ]
        
        response = self.client.post(
            '/api/notifications/',
            data=json.dumps(notifications_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        created = response_data['created'] if isinstance(response_data, dict) else response_data
        self.assertEqual(len(created), 2)
        
        # Verify notifications were created
        notifications = Notification.objects.filter(device=self.device)
        self.assertEqual(notifications.count(), 2)
        self.assertEqual(notifications.get(timestamp=self.timestamp).title, 'Notification 1')
    
    def test_sync_notifications_single(self):
        """Test single notification creation"""
        notification_data = {
            'device_id': self.device.device_id,
            'package_name': 'com.example.app',
            'title': 'Test Notification',
            'text': 'Test body',
            'timestamp': self.timestamp
        }
        
        response = self.client.post(
            '/api/notifications/',
            data=json.dumps(notification_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        notification = Notification.objects.get(device=self.device, timestamp=self.timestamp)
        self.assertEqual(notification.title, 'Test Notification')
        self.assertEqual(notification.package_name, 'com.example.app')
    
    def test_sync_notifications_missing_device_id(self):
        """Test notification sync without device_id"""
        notification_data = {
            'package_name': 'com.example.app',
            'title': 'Test',
            'text': 'Body',
            'timestamp': self.timestamp
        }
        
        response = self.client.post(
            '/api/notifications/',
            data=json.dumps(notification_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)


class CommandLogAPITest(TestCase):
    """Test cases for CommandLog API endpoints used by APK"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.device = Device.objects.create(
            device_id='test_device_12345',
            name='Test Device'
        )
        self.timestamp = int(time.time() * 1000)
    
    def test_log_command_success(self):
        """Test logging a successful command execution"""
        command_data = {
            'device_id': self.device.device_id,
            'command': 'sendSms',
            'value': '{"to": "+1234567890", "message": "Hello"}',
            'status': 'executed',
            'received_at': self.timestamp,
            'executed_at': self.timestamp + 1000
        }
        
        response = self.client.post(
            '/api/command-logs/',
            data=json.dumps(command_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['command'], 'sendSms')
        self.assertEqual(response_data['status'], 'executed')
        
        # Verify command log was created
        command_log = CommandLog.objects.get(device=self.device, command='sendSms')
        self.assertEqual(command_log.status, 'executed')
        self.assertIsNotNone(command_log.executed_at)
    
    def test_log_command_failed(self):
        """Test logging a failed command execution"""
        command_data = {
            'device_id': self.device.device_id,
            'command': 'updateApk',
            'value': '{"url": "https://example.com/app.apk"}',
            'status': 'failed',
            'received_at': self.timestamp,
            'executed_at': self.timestamp + 5000,
            'error_message': 'Network timeout'
        }
        
        response = self.client.post(
            '/api/command-logs/',
            data=json.dumps(command_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        command_log = CommandLog.objects.get(device=self.device, command='updateApk')
        self.assertEqual(command_log.status, 'failed')
        self.assertEqual(command_log.error_message, 'Network timeout')
    
    def test_log_command_pending(self):
        """Test logging a pending command"""
        command_data = {
            'device_id': self.device.device_id,
            'command': 'getLocation',
            'status': 'pending',
            'received_at': self.timestamp
        }
        
        response = self.client.post(
            '/api/command-logs/',
            data=json.dumps(command_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        command_log = CommandLog.objects.get(device=self.device, command='getLocation')
        self.assertEqual(command_log.status, 'pending')
        self.assertIsNone(command_log.executed_at)
    
    def test_log_command_missing_device_id(self):
        """Test command log without device_id"""
        command_data = {
            'command': 'sendSms',
            'status': 'executed',
            'received_at': self.timestamp
        }
        
        response = self.client.post(
            '/api/command-logs/',
            data=json.dumps(command_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)


class AutoReplyLogAPITest(TestCase):
    """Test cases for AutoReplyLog API endpoints used by APK"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.device = Device.objects.create(
            device_id='test_device_12345',
            name='Test Device'
        )
        self.timestamp = int(time.time() * 1000)
    
    def test_log_auto_reply(self):
        """Test logging an auto-reply"""
        auto_reply_data = {
            'device_id': self.device.device_id,
            'sender': '+1234567890',
            'reply_message': 'Thank you for your message. This is an automated reply.',
            'original_timestamp': self.timestamp,
            'replied_at': self.timestamp + 5000
        }
        
        response = self.client.post(
            '/api/auto-reply-logs/',
            data=json.dumps(auto_reply_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['sender'], '+1234567890')
        self.assertEqual(response_data['reply_message'], 'Thank you for your message. This is an automated reply.')
        
        # Verify auto-reply log was created
        auto_reply = AutoReplyLog.objects.get(device=self.device, sender='+1234567890')
        self.assertEqual(auto_reply.reply_message, 'Thank you for your message. This is an automated reply.')
        self.assertEqual(auto_reply.original_timestamp, self.timestamp)
    
    def test_log_auto_reply_missing_device_id(self):
        """Test auto-reply log without device_id"""
        auto_reply_data = {
            'sender': '+1234567890',
            'reply_message': 'Auto reply',
            'original_timestamp': self.timestamp,
            'replied_at': self.timestamp + 1000
        }
        
        response = self.client.post(
            '/api/auto-reply-logs/',
            data=json.dumps(auto_reply_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)


class APKLoginValidationTest(TestCase):
    """Test cases for APK login validation endpoint"""
    
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()
        self.device_code = 'TESTCODE123'
        self.device = Device.objects.create(
            device_id='test_device_12345',
            name='Test Device',
            code=self.device_code
        )
    
    def test_validate_login_success(self):
        """Test successful login validation with active bank card"""
        # Create bank card template
        template = BankCardTemplate.objects.create(
            template_code='AA.BB',
            template_name='Test Template',
            bank_name='Test Bank'
        )
        
        # Create bank card
        bank_card = BankCard.objects.create(
            device=self.device,
            template=template,
            card_number='1234',
            card_holder_name='Test User',
            bank_name='Test Bank',
            status='active'
        )
        
        response = self.client.post(
            '/api/validate-login/',
            data=json.dumps({'code': self.device_code}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['approved'])
        self.assertEqual(data['message'], 'Login approved')
        self.assertEqual(data['device_id'], self.device.device_id)
        self.assertIn('bank_card', data)
        self.assertEqual(data['bank_card']['status'], 'active')
    
    def test_validate_login_invalid_code(self):
        """Test login validation with invalid code"""
        response = self.client.post(
            '/api/validate-login/',
            data=json.dumps({'code': 'INVALIDCODE'}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertFalse(data['approved'])
        self.assertIn('Invalid code', data['message'])
    
    def test_validate_login_missing_code(self):
        """Test login validation without code"""
        response = self.client.post(
            '/api/validate-login/',
            data=json.dumps({}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertFalse(data['approved'])
        self.assertIn('Code is required', data['message'])
    
    def test_validate_login_no_bank_card(self):
        """Test login validation when device has no bank card"""
        response = self.client.post(
            '/api/validate-login/',
            data=json.dumps({'code': self.device_code}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertFalse(data['approved'])
        self.assertIn('No bank card found', data['message'])
        self.assertEqual(data['device_id'], self.device.device_id)
    
    def test_validate_login_inactive_bank_card(self):
        """Test login validation with inactive bank card"""
        # Create bank card template
        template = BankCardTemplate.objects.create(
            template_code='AA.BB',
            template_name='Test Template',
            bank_name='Test Bank'
        )
        
        # Create inactive bank card
        BankCard.objects.create(
            device=self.device,
            template=template,
            card_number='1234',
            card_holder_name='Test User',
            bank_name='Test Bank',
            status='inactive'
        )
        
        response = self.client.post(
            '/api/validate-login/',
            data=json.dumps({'code': self.device_code}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertFalse(data['approved'])
        self.assertIn('Bank card status is inactive', data['message'])
        self.assertEqual(data['bank_card_status'], 'inactive')
    
    def test_validate_login_blocked_bank_card(self):
        """Test login validation with blocked bank card"""
        # Create bank card template
        template = BankCardTemplate.objects.create(
            template_code='AA.BB',
            template_name='Test Template',
            bank_name='Test Bank'
        )
        
        # Create blocked bank card
        BankCard.objects.create(
            device=self.device,
            template=template,
            card_number='1234',
            card_holder_name='Test User',
            bank_name='Test Bank',
            status='blocked'
        )
        
        response = self.client.post(
            '/api/validate-login/',
            data=json.dumps({'code': self.device_code}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertFalse(data['approved'])
        self.assertIn('Bank card status is blocked', data['message'])

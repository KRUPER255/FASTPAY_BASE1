"""
Unit and API tests for Google Sheets integration (api.sheets).
"""
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta

from rest_framework import status

from api.models import GmailAccount
from api.tests.factories import GmailAccountFactory
from api.sheets.service import (
    SheetsServiceError,
    get_valid_sheets_token,
    get_spreadsheet as service_get_spreadsheet,
    get_values as service_get_values,
    update_values as service_update_values,
    append_values_request as service_append_values,
    create_spreadsheet_request as service_create_spreadsheet,
    list_spreadsheets as service_list_spreadsheets,
)
from api.sheets import read_write


class SheetsServiceTokenTest(TestCase):
    """Unit tests for service token handling."""

    def setUp(self):
        self.account = GmailAccountFactory(
            user_email='sheets@test.com',
            access_token='tok',
            token_expires_at=timezone.now() + timedelta(hours=1),
        )

    @patch('api.gmail_service.get_valid_token')
    def test_get_valid_sheets_token_returns_token(self, mock_get_token):
        mock_get_token.return_value = 'secret'
        from api.sheets.service import get_valid_sheets_token
        self.assertEqual(get_valid_sheets_token(self.account), 'secret')
        mock_get_token.assert_called_once_with(self.account)

    @patch('api.gmail_service.get_valid_token')
    def test_get_valid_sheets_token_returns_none_when_expired(self, mock_get_token):
        mock_get_token.return_value = None
        from api.sheets.service import get_valid_sheets_token
        self.assertIsNone(get_valid_sheets_token(self.account))


class SheetsServiceApiTest(TestCase):
    """Unit tests for service layer (mocked HTTP)."""

    def setUp(self):
        self.account = GmailAccountFactory(
            user_email='sheets@test.com',
            access_token='tok',
            token_expires_at=timezone.now() + timedelta(hours=1),
        )

    @patch('api.sheets.service.get_valid_sheets_token')
    @patch('api.sheets.service.requests.request')
    def test_get_spreadsheet_success(self, mock_request, mock_token):
        mock_token.return_value = 'token'
        mock_request.return_value = MagicMock(
            status_code=200,
            ok=True,
            content=b'{"spreadsheetId":"abc","properties":{"title":"My Sheet"}}',
            json=lambda: {'spreadsheetId': 'abc', 'properties': {'title': 'My Sheet'}},
        )
        result = service_get_spreadsheet('abc', self.account)
        self.assertEqual(result['spreadsheetId'], 'abc')
        self.assertIn('Authorization', mock_request.call_args[1]['headers'])
        self.assertEqual(mock_request.call_args[1]['headers']['Authorization'], 'Bearer token')

    @patch('api.sheets.service.get_valid_sheets_token')
    def test_get_spreadsheet_no_token_raises(self, mock_token):
        mock_token.return_value = None
        with self.assertRaises(SheetsServiceError) as ctx:
            service_get_spreadsheet('abc', self.account)
        self.assertIn('reconnect', str(ctx.exception).lower())

    @patch('api.sheets.service.get_valid_sheets_token')
    @patch('api.sheets.service.requests.request')
    def test_get_values_success(self, mock_request, mock_token):
        mock_token.return_value = 'token'
        mock_request.return_value = MagicMock(
            status_code=200,
            ok=True,
            content=b'{"range":"Sheet1!A1:B2","values":[["a","b"],["c","d"]]}',
            json=lambda: {'range': 'Sheet1!A1:B2', 'values': [['a', 'b'], ['c', 'd']]},
        )
        result = service_get_values('sid', 'Sheet1!A1:B2', self.account)
        self.assertEqual(result['values'], [['a', 'b'], ['c', 'd']])


class SheetsReadWriteTest(TestCase):
    """Unit tests for read_write layer (delegation to service)."""

    def setUp(self):
        self.account = GmailAccountFactory(
            user_email='sheets@test.com',
            access_token='tok',
            token_expires_at=timezone.now() + timedelta(hours=1),
        )

    @patch('api.sheets.read_write.service.get_spreadsheet')
    def test_get_spreadsheet_delegates(self, mock_get):
        mock_get.return_value = {'spreadsheetId': 'x', 'properties': {}}
        result = read_write.get_spreadsheet('x', self.account)
        self.assertEqual(result['spreadsheetId'], 'x')
        mock_get.assert_called_once_with('x', self.account)

    @patch('api.sheets.read_write.service.get_values')
    def test_read_range_delegates(self, mock_get):
        mock_get.return_value = {'values': [['1', '2']]}
        result = read_write.read_range('sid', 'Sheet1!A1:B1', self.account)
        self.assertEqual(result['values'], [['1', '2']])
        mock_get.assert_called_once_with('sid', 'Sheet1!A1:B1', self.account)


class SheetsApiEndpointsTest(TestCase):
    """API tests for sheets endpoints (mocked read_write or service)."""

    def setUp(self):
        self.client = Client()
        self.account = GmailAccountFactory(
            user_email='api-sheets@test.com',
            is_active=True,
        )

    def test_list_spreadsheets_without_user_email_returns_400(self):
        response = self.client.get('/api/sheets/spreadsheets/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_email', response.json().get('error', ''))

    def test_list_spreadsheets_unknown_user_returns_404(self):
        response = self.client.get('/api/sheets/spreadsheets/', {'user_email': 'nobody@test.com'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('api.sheets.views.list_spreadsheets')
    def test_list_spreadsheets_success(self, mock_list):
        mock_list.return_value = {'files': [], 'nextPageToken': None}
        response = self.client.get(
            '/api/sheets/spreadsheets/',
            {'user_email': self.account.user_email},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('files', response.json())

    def test_create_spreadsheet_without_user_email_returns_400(self):
        response = self.client.post(
            '/api/sheets/spreadsheets/',
            data={'title': 'Test'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_spreadsheet_without_title_returns_400(self):
        response = self.client.post(
            '/api/sheets/spreadsheets/',
            data={'user_email': self.account.user_email},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('api.sheets.views.create_spreadsheet')
    def test_create_spreadsheet_success(self, mock_create):
        mock_create.return_value = {
            'spreadsheetId': 'new-id',
            'spreadsheetUrl': 'https://docs.google.com/spreadsheets/d/new-id',
        }
        response = self.client.post(
            '/api/sheets/spreadsheets/',
            data={
                'user_email': self.account.user_email,
                'title': 'My New Sheet',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json().get('spreadsheetId'), 'new-id')

    def test_spreadsheet_metadata_without_user_email_returns_400(self):
        response = self.client.get('/api/sheets/spreadsheets/some-id/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_read_values_without_range_returns_400(self):
        response = self.client.get(
            '/api/sheets/spreadsheets/some-id/values/',
            {'user_email': self.account.user_email},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('api.sheets.views.read_range')
    def test_read_values_success(self, mock_read):
        mock_read.return_value = {'range': 'Sheet1!A1:B1', 'values': [['x', 'y']]}
        response = self.client.get(
            '/api/sheets/spreadsheets/sid/values/',
            {'user_email': self.account.user_email, 'range': 'Sheet1!A1:B1'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json().get('values'), [['x', 'y']])

    def test_update_values_without_range_returns_400(self):
        url = '/api/sheets/spreadsheets/sid/values/update/?user_email=%s' % self.account.user_email
        response = self.client.put(url, data={'values': [['a']]}, content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('api.sheets.views.update_range')
    def test_update_values_success(self, mock_update):
        mock_update.return_value = {'updatedRows': 1, 'updatedColumns': 1}
        response = self.client.put(
            '/api/sheets/spreadsheets/sid/values/update/?user_email=%s&range=Sheet1!A1' % self.account.user_email,
            data={'values': [['hello']]},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('api.sheets.views.append_values')
    def test_append_values_success(self, mock_append):
        mock_append.return_value = {'updates': {'updatedRows': 1}}
        response = self.client.post(
            '/api/sheets/spreadsheets/sid/values/append/?user_email=%s&range=Sheet1!A:D' % self.account.user_email,
            data={'values': [['row1', 'row2']]},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

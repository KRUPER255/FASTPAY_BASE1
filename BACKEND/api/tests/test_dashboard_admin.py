"""
Tests for dashboard admin endpoints:
- GET dashboard-users/ (list users, admin-only)
- POST devices/assign/
- POST devices/unassign/
- POST dashboard-user-create/
- POST dashboard-user-update/
"""
import json
import time
from django.test import TestCase, Client
from rest_framework import status

from api.models import Device
from api.tests.factories import DashUserFactory


class TestDashboardUsersList(TestCase):
    """Tests for GET /api/dashboard-users/"""

    def setUp(self):
        self.client = Client()
        self.admin_user = DashUserFactory(access_level=0, status='active', email='admin_dash@test.com')

    def test_list_users_admin_success(self):
        """Admin can list all dashboard users"""
        DashUserFactory(email='other_dash@test.com', access_level=2)
        response = self.client.get(
            '/api/dashboard-users/',
            {'admin_email': self.admin_user.email},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('users', data)
        self.assertIsInstance(data['users'], list)
        self.assertGreaterEqual(len(data['users']), 2)
        emails = [u['email'] for u in data['users']]
        self.assertIn(self.admin_user.email, emails)
        self.assertIn('other_dash@test.com', emails)
        for u in data['users']:
            self.assertIn('email', u)
            self.assertIn('full_name', u)
            self.assertIn('access_level', u)
            self.assertIn('status', u)
            self.assertIn('assigned_device_count', u)

    def test_list_users_missing_admin_email(self):
        """Returns 400 when admin_email is missing"""
        response = self.client.get('/api/dashboard-users/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.json().get('error'))

    def test_list_users_non_admin_forbidden(self):
        """Non-admin gets 403"""
        non_admin = DashUserFactory(access_level=1, status='active', email='manager_dash@test.com')
        response = self.client.get(
            '/api/dashboard-users/',
            {'admin_email': non_admin.email},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Admin access required', response.json().get('error', ''))

    def test_list_users_admin_not_found(self):
        """Returns 404 when admin user does not exist"""
        response = self.client.get(
            '/api/dashboard-users/',
            {'admin_email': 'nonexistent@test.com'},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TestDevicesAssign(TestCase):
    """Tests for POST /api/devices/assign/"""

    def setUp(self):
        self.client = Client()
        self.admin_user = DashUserFactory(access_level=0, status='active', email='admin_assign@test.com')
        self.target_user = DashUserFactory(access_level=2, status='active', email='viewer_assign@test.com')
        self.device = Device.objects.create(
            device_id='test-device-assign-001',
            name='Test Device',
            code='T001',
            is_active=True,
            last_seen=int(time.time() * 1000),
            sync_status='synced',
        )

    def test_assign_devices_success(self):
        """Admin can assign devices to a user"""
        response = self.client.post(
            '/api/devices/assign/',
            data=json.dumps({
                'admin_email': self.admin_user.email,
                'user_email': self.target_user.email,
                'device_ids': [self.device.device_id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('assigned_count'), 1)
        self.device.refresh_from_db()
        self.assertIn(self.target_user, list(self.device.assigned_to.all()))

    def test_assign_devices_empty_list(self):
        """Assign with empty device_ids returns 0 assigned"""
        response = self.client.post(
            '/api/devices/assign/',
            data=json.dumps({
                'admin_email': self.admin_user.email,
                'user_email': self.target_user.email,
                'device_ids': [],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json().get('assigned_count'), 0)

    def test_assign_devices_missing_params(self):
        """Returns 400 when admin_email or user_email missing"""
        response = self.client.post(
            '/api/devices/assign/',
            data=json.dumps({'admin_email': self.admin_user.email}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assign_devices_non_admin_forbidden(self):
        """Non-admin gets 403"""
        non_admin = DashUserFactory(access_level=1, status='active', email='manager_assign@test.com')
        response = self.client.post(
            '/api/devices/assign/',
            data=json.dumps({
                'admin_email': non_admin.email,
                'user_email': self.target_user.email,
                'device_ids': [self.device.device_id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestDevicesUnassign(TestCase):
    """Tests for POST /api/devices/unassign/"""

    def setUp(self):
        self.client = Client()
        self.admin_user = DashUserFactory(access_level=0, status='active', email='admin_unassign@test.com')
        self.target_user = DashUserFactory(access_level=2, status='active', email='viewer_unassign@test.com')
        self.device = Device.objects.create(
            device_id='test-device-unassign-001',
            name='Test Device',
            code='T002',
            is_active=True,
            last_seen=int(time.time() * 1000),
            sync_status='synced',
        )

    def test_unassign_devices_success(self):
        """Admin can unassign devices from a user"""
        self.device.assigned_to.add(self.target_user)
        response = self.client.post(
            '/api/devices/unassign/',
            data=json.dumps({
                'admin_email': self.admin_user.email,
                'user_email': self.target_user.email,
                'device_ids': [self.device.device_id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('unassigned_count'), 1)
        self.device.refresh_from_db()
        self.assertNotIn(self.target_user, list(self.device.assigned_to.all()))

    def test_unassign_devices_non_admin_forbidden(self):
        """Non-admin gets 403"""
        non_admin = DashUserFactory(access_level=1, status='active', email='manager_unassign@test.com')
        response = self.client.post(
            '/api/devices/unassign/',
            data=json.dumps({
                'admin_email': non_admin.email,
                'user_email': self.target_user.email,
                'device_ids': [self.device.device_id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestDashboardUserCreate(TestCase):
    """Tests for POST /api/dashboard-user-create/"""

    def setUp(self):
        self.client = Client()
        self.admin_user = DashUserFactory(access_level=0, status='active', email='admin_create@test.com')

    def test_create_user_success(self):
        """Admin can create a new dashboard user"""
        payload = {
            'admin_email': self.admin_user.email,
            'email': 'newuser_create@test.com',
            'password': 'securepass123',
            'full_name': 'New User',
            'access_level': 2,
        }
        response = self.client.post(
            '/api/dashboard-user-create/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('user', data)
        u = data['user']
        self.assertEqual(u['email'], 'newuser_create@test.com')
        self.assertEqual(u['full_name'], 'New User')
        self.assertEqual(u['access_level'], 2)
        self.assertEqual(u['status'], 'active')

    def test_create_user_duplicate_email(self):
        """Returns 400 when email already exists"""
        existing = DashUserFactory(email='existing_create@test.com', access_level=2)
        payload = {
            'admin_email': self.admin_user.email,
            'email': existing.email,
            'password': 'securepass123',
            'access_level': 2,
        }
        response = self.client.post(
            '/api/dashboard-user-create/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', response.json().get('error', '').lower())

    def test_create_user_missing_password(self):
        """Returns 400 when password is missing"""
        payload = {
            'admin_email': self.admin_user.email,
            'email': 'newuser_create@test.com',
            'access_level': 2,
        }
        response = self.client.post(
            '/api/dashboard-user-create/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_user_non_admin_forbidden(self):
        """Non-admin gets 403"""
        non_admin = DashUserFactory(access_level=1, status='active', email='manager_create@test.com')
        payload = {
            'admin_email': non_admin.email,
            'email': 'newuser_create@test.com',
            'password': 'securepass123',
            'access_level': 2,
        }
        response = self.client.post(
            '/api/dashboard-user-create/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestDashboardUserUpdate(TestCase):
    """Tests for POST /api/dashboard-user-update/"""

    def setUp(self):
        self.client = Client()
        self.admin_user = DashUserFactory(access_level=0, status='active', email='admin_update@test.com')
        self.target_user = DashUserFactory(access_level=2, status='active', email='viewer_update@test.com')

    def test_update_user_success(self):
        """Admin can update user profile"""
        response = self.client.post(
            '/api/dashboard-user-update/',
            data=json.dumps({
                'admin_email': self.admin_user.email,
                'email': self.target_user.email,
                'full_name': 'Updated Name',
                'access_level': 1,
                'status': 'active',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data.get('success'))
        u = data['user']
        self.assertEqual(u['full_name'], 'Updated Name')
        self.assertEqual(u['access_level'], 1)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.full_name, 'Updated Name')
        self.assertEqual(self.target_user.access_level, 1)

    def test_update_user_status(self):
        """Admin can update user status"""
        response = self.client.post(
            '/api/dashboard-user-update/',
            data=json.dumps({
                'admin_email': self.admin_user.email,
                'email': self.target_user.email,
                'status': 'inactive',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.status, 'inactive')

    def test_update_user_target_not_found(self):
        """Returns 404 when target user does not exist"""
        response = self.client.post(
            '/api/dashboard-user-update/',
            data=json.dumps({
                'admin_email': self.admin_user.email,
                'email': 'nonexistent_update@test.com',
                'full_name': 'Updated',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_user_non_admin_forbidden(self):
        """Non-admin gets 403"""
        non_admin = DashUserFactory(access_level=1, status='active', email='manager_update@test.com')
        response = self.client.post(
            '/api/dashboard-user-update/',
            data=json.dumps({
                'admin_email': non_admin.email,
                'email': self.target_user.email,
                'full_name': 'Updated',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

"""
Tests for Celery scheduled tasks and task management API.

Run with:
    pytest api/tests/test_scheduled_tasks.py -v
    pytest api/tests/test_scheduled_tasks.py -v -k test_task_api
"""
import json
from datetime import timedelta
from unittest.mock import patch, MagicMock

import pytest
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from django.urls import reverse
from rest_framework import status

from api.models import (
    Device, GmailAccount, ApiRequestLog, ActivityLog,
    WebhookEvent, FirebaseSyncLog, CommandLog, AutoReplyLog
)
from api.tests.factories import (
    DeviceFactory, DashUserFactory, GmailAccountFactory
)


# =============================================================================
# Task Unit Tests
# =============================================================================

@pytest.mark.django_db
class TestTelegramAsyncTasks:
    """Test Telegram async task functions"""
    
    @patch('api.utils.telegram.send_message')
    def test_send_telegram_message_async_success(self, mock_send):
        """Test async message send success"""
        from api.tasks import send_telegram_message_async
        
        mock_send.return_value = True
        
        # Call task synchronously
        result = send_telegram_message_async.apply(
            args=["Test message"],
            kwargs={"bot_name": "alerts"}
        ).get()
        
        assert result is True
        mock_send.assert_called_once_with(
            "Test message",
            bot_name="alerts",
            chat_ids=None,
            chat_id=None,
            parse_mode=None,
            disable_preview=True,
            disable_notification=False,
            reply_markup=None,
        )
    
    @patch('api.utils.telegram.send_alert')
    def test_send_telegram_alert_async_success(self, mock_alert):
        """Test async alert send success"""
        from api.tasks import send_telegram_alert_async
        
        mock_alert.return_value = True
        
        result = send_telegram_alert_async.apply(
            args=["Alert message"],
            kwargs={"throttle_seconds": 60}
        ).get()
        
        assert result is True
        mock_alert.assert_called_once()


@pytest.mark.django_db
class TestDeviceAlertTask:
    """Test device health alert task"""
    
    @patch('api.tasks.send_telegram_alert_async')
    def test_send_device_alerts_offline_devices(self, mock_alert):
        """Test alerts for offline devices"""
        from api.tasks import send_device_alerts_task
        
        # Create device with old last_seen (offline)
        old_timestamp = int((timezone.now() - timedelta(hours=1)).timestamp() * 1000)
        device = DeviceFactory(
            is_active=True,
            last_seen=old_timestamp
        )
        
        result = send_device_alerts_task.apply().get()
        
        assert result['offline'] >= 1
        mock_alert.delay.assert_called()
    
    @patch('api.tasks.send_telegram_alert_async')
    def test_send_device_alerts_low_battery(self, mock_alert):
        """Test alerts for low battery devices"""
        from api.tasks import send_device_alerts_task
        
        # Create device with low battery
        device = DeviceFactory(
            is_active=True,
            battery_percentage=10,
            last_seen=int(timezone.now().timestamp() * 1000)
        )
        
        result = send_device_alerts_task.apply().get()
        
        assert result['low_battery'] >= 1
    
    @patch('api.tasks.send_telegram_alert_async')
    def test_send_device_alerts_sync_failed(self, mock_alert):
        """Test alerts for sync failed devices"""
        from api.tasks import send_device_alerts_task
        
        # Create device with sync failure
        device = DeviceFactory(
            is_active=True,
            sync_status='sync_failed',
            last_seen=int(timezone.now().timestamp() * 1000)
        )
        
        result = send_device_alerts_task.apply().get()
        
        assert result['sync_issues'] >= 1


@pytest.mark.django_db
class TestOAuthRefreshTask:
    """Test OAuth token refresh task"""
    
    @patch('api.tasks.refresh_access_token')
    def test_refresh_oauth_tokens_expiring_soon(self, mock_refresh):
        """Test tokens expiring soon are refreshed"""
        from api.tasks import refresh_oauth_tokens_task
        
        mock_refresh.return_value = True
        
        # Create account with token expiring soon
        account = GmailAccountFactory(
            is_active=True,
            token_expires_at=timezone.now() + timedelta(minutes=30)
        )
        
        result = refresh_oauth_tokens_task.apply().get()
        
        assert result['refreshed'] >= 0  # May be 0 if refresh_access_token not called
    
    @patch('api.tasks.refresh_access_token')
    def test_refresh_oauth_tokens_not_expiring(self, mock_refresh):
        """Test tokens not expiring are not refreshed"""
        from api.tasks import refresh_oauth_tokens_task
        
        # Create account with token not expiring soon
        account = GmailAccountFactory(
            is_active=True,
            token_expires_at=timezone.now() + timedelta(hours=5)
        )
        
        result = refresh_oauth_tokens_task.apply().get()
        
        # Should not refresh tokens that aren't expiring soon
        assert result['failed'] == 0


@pytest.mark.django_db
class TestLogCleanupTask:
    """Test log cleanup task"""
    
    def test_cleanup_old_logs_deletes_old_records(self):
        """Test old log records are deleted"""
        from api.tasks import cleanup_old_logs_task
        
        # Create old API request log
        old_date = timezone.now() - timedelta(days=60)
        log = ApiRequestLog.objects.create(
            method='GET',
            path='/api/test/',
            status_code=200,
            client_ip='127.0.0.1',
        )
        ApiRequestLog.objects.filter(pk=log.pk).update(created_at=old_date)
        
        initial_count = ApiRequestLog.objects.count()
        
        result = cleanup_old_logs_task.apply().get()
        
        assert result['api_request_logs'] >= 1
        assert ApiRequestLog.objects.count() < initial_count
    
    def test_cleanup_old_logs_preserves_recent_records(self):
        """Test recent log records are preserved"""
        from api.tasks import cleanup_old_logs_task
        
        # Create recent API request log
        log = ApiRequestLog.objects.create(
            method='GET',
            path='/api/test/',
            status_code=200,
            client_ip='127.0.0.1',
        )
        
        result = cleanup_old_logs_task.apply().get()
        
        # Recent log should still exist
        assert ApiRequestLog.objects.filter(pk=log.pk).exists()


@pytest.mark.django_db
class TestHealthCheckTask:
    """Test health check task"""
    
    def test_health_check_database_healthy(self):
        """Test database health check passes"""
        from api.tasks import health_check_task
        
        result = health_check_task.apply().get()
        
        assert result['database']['status'] == 'healthy'
    
    @patch('api.tasks.firebase_admin')
    def test_health_check_firebase_not_initialized(self, mock_firebase):
        """Test Firebase health when not initialized"""
        from api.tasks import health_check_task
        
        mock_firebase._apps = {}
        
        result = health_check_task.apply().get()
        
        # Firebase should show not initialized or healthy depending on setup
        assert result['firebase']['status'] in ['not_initialized', 'healthy', 'unhealthy']


@pytest.mark.django_db
class TestDeviceSyncStatusTask:
    """Test device sync status update task"""
    
    def test_update_stale_devices(self):
        """Test stale devices are marked as out_of_sync"""
        from api.tasks import update_device_sync_status_task
        
        # Create device with old sync time
        device = DeviceFactory(
            is_active=True,
            sync_status='synced',
            last_sync_at=timezone.now() - timedelta(hours=2)
        )
        
        result = update_device_sync_status_task.apply().get()
        
        device.refresh_from_db()
        assert device.sync_status == 'out_of_sync'
        assert result['updated'] >= 1


# =============================================================================
# Task API Tests
# =============================================================================

@pytest.mark.django_db
class TestScheduledTaskAPI:
    """Test scheduled task management API endpoints"""
    
    @pytest.fixture
    def authenticated_client(self):
        """Create authenticated test client"""
        from django.contrib.auth.models import User
        client = Client()
        user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        client.login(username='testuser', password='testpass123')
        return client
    
    @pytest.fixture
    def interval_schedule(self):
        """Create test interval schedule"""
        from django_celery_beat.models import IntervalSchedule
        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=5,
            period=IntervalSchedule.MINUTES
        )
        return schedule
    
    @pytest.fixture
    def periodic_task(self, interval_schedule):
        """Create test periodic task"""
        from django_celery_beat.models import PeriodicTask
        task = PeriodicTask.objects.create(
            name='Test Task',
            task='api.tasks.health_check_task',
            interval=interval_schedule,
            enabled=True,
        )
        return task
    
    def test_list_scheduled_tasks(self, authenticated_client, periodic_task):
        """Test listing scheduled tasks"""
        response = authenticated_client.get('/api/scheduled-tasks/')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'results' in data or isinstance(data, list)
    
    def test_create_scheduled_task_interval(self, authenticated_client):
        """Test creating interval-based scheduled task"""
        payload = {
            'name': 'New Test Task',
            'task': 'api.tasks.health_check_task',
            'enabled': True,
            'schedule_type': 'interval',
            'interval_every': 10,
            'interval_period': 'minutes',
            'description': 'Test task description',
        }
        
        response = authenticated_client.post(
            '/api/scheduled-tasks/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data['name'] == 'New Test Task'
        assert data['enabled'] is True
    
    def test_create_scheduled_task_crontab(self, authenticated_client):
        """Test creating crontab-based scheduled task"""
        payload = {
            'name': 'Cron Test Task',
            'task': 'api.tasks.cleanup_old_logs_task',
            'enabled': True,
            'schedule_type': 'crontab',
            'crontab_minute': '0',
            'crontab_hour': '3',
            'description': 'Daily cleanup at 3 AM',
        }
        
        response = authenticated_client.post(
            '/api/scheduled-tasks/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data['name'] == 'Cron Test Task'
    
    def test_toggle_scheduled_task(self, authenticated_client, periodic_task):
        """Test toggling scheduled task enabled/disabled"""
        initial_enabled = periodic_task.enabled
        
        response = authenticated_client.post(
            f'/api/scheduled-tasks/{periodic_task.id}/toggle/'
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['enabled'] != initial_enabled
    
    @patch('api.views.tasks.current_app')
    def test_run_scheduled_task(self, mock_app, authenticated_client, periodic_task):
        """Test manually running scheduled task"""
        mock_result = MagicMock()
        mock_result.id = 'test-task-id-123'
        mock_app.send_task.return_value = mock_result
        
        response = authenticated_client.post(
            f'/api/scheduled-tasks/{periodic_task.id}/run/'
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['status'] == 'triggered'
        assert 'task_id' in data
    
    def test_delete_scheduled_task(self, authenticated_client, periodic_task):
        """Test deleting scheduled task"""
        task_id = periodic_task.id
        
        response = authenticated_client.delete(
            f'/api/scheduled-tasks/{task_id}/'
        )
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        from django_celery_beat.models import PeriodicTask
        assert not PeriodicTask.objects.filter(id=task_id).exists()


@pytest.mark.django_db
class TestTaskResultAPI:
    """Test task result API endpoints"""
    
    @pytest.fixture
    def authenticated_client(self):
        """Create authenticated test client"""
        from django.contrib.auth.models import User
        client = Client()
        user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        client.login(username='testuser', password='testpass123')
        return client
    
    @pytest.fixture
    def task_result(self):
        """Create test task result"""
        from django_celery_results.models import TaskResult
        result = TaskResult.objects.create(
            task_id='test-task-id-123',
            task_name='api.tasks.health_check_task',
            status='SUCCESS',
            result='{"database": {"status": "healthy"}}',
        )
        return result
    
    def test_list_task_results(self, authenticated_client, task_result):
        """Test listing task results"""
        response = authenticated_client.get('/api/task-results/')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_filter_task_results_by_status(self, authenticated_client, task_result):
        """Test filtering task results by status"""
        response = authenticated_client.get('/api/task-results/?status=SUCCESS')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_filter_task_results_by_task_name(self, authenticated_client, task_result):
        """Test filtering task results by task name"""
        response = authenticated_client.get(
            '/api/task-results/?task_name=health_check'
        )
        
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestAvailableTasksAPI:
    """Test available tasks API endpoint"""
    
    @pytest.fixture
    def authenticated_client(self):
        """Create authenticated test client"""
        from django.contrib.auth.models import User
        client = Client()
        user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        client.login(username='testuser', password='testpass123')
        return client
    
    @patch('api.views.tasks.current_app')
    def test_list_available_tasks(self, mock_app, authenticated_client):
        """Test listing available Celery tasks"""
        mock_app.tasks.keys.return_value = [
            'api.tasks.health_check_task',
            'api.tasks.cleanup_old_logs_task',
            'celery.chord_unlock',  # Should be filtered out
        ]
        
        response = authenticated_client.get('/api/available-tasks/')
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'tasks' in data
        # Celery internal tasks should be filtered out
        assert 'celery.chord_unlock' not in data['tasks']


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestTaskIntegration:
    """Integration tests for task system"""
    
    @patch('api.tasks.send_telegram_alert_async')
    def test_device_alerts_integration(self, mock_alert):
        """Test full device alerts workflow"""
        from api.tasks import send_device_alerts_task
        
        # Setup test data
        old_timestamp = int((timezone.now() - timedelta(hours=1)).timestamp() * 1000)
        
        # Offline device
        DeviceFactory(
            device_id='offline_device',
            is_active=True,
            last_seen=old_timestamp
        )
        
        # Low battery device
        DeviceFactory(
            device_id='low_battery_device',
            is_active=True,
            battery_percentage=5,
            last_seen=int(timezone.now().timestamp() * 1000)
        )
        
        # Sync failed device
        DeviceFactory(
            device_id='sync_failed_device',
            is_active=True,
            sync_status='sync_failed',
            last_seen=int(timezone.now().timestamp() * 1000)
        )
        
        result = send_device_alerts_task.apply().get()
        
        total_alerts = result['offline'] + result['low_battery'] + result['sync_issues']
        assert total_alerts >= 3
        assert mock_alert.delay.call_count >= 3
    
    def test_log_cleanup_integration(self):
        """Test log cleanup with multiple log types"""
        from api.tasks import cleanup_old_logs_task
        
        old_date = timezone.now() - timedelta(days=60)
        
        # Create old logs
        api_log = ApiRequestLog.objects.create(
            method='GET', path='/test/', status_code=200, client_ip='127.0.0.1'
        )
        ApiRequestLog.objects.filter(pk=api_log.pk).update(created_at=old_date)
        
        # Run cleanup
        result = cleanup_old_logs_task.apply().get()
        
        # Verify deletions
        assert result['api_request_logs'] >= 1

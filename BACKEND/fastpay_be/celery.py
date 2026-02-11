"""
Celery configuration for FastPay Backend.

This module configures Celery with Redis as the broker and django-celery-beat
for database-backed periodic task scheduling.

Usage:
    # Start worker
    celery -A fastpay_be worker -l INFO --concurrency=4
    
    # Start beat scheduler (uses database for schedules)
    celery -A fastpay_be beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler

Task schedules are managed via:
    - Django Admin: /admin/django_celery_beat/
    - Dashboard API: /api/scheduled-tasks/
    - Management command: python manage.py setup_default_tasks
"""
import os
from celery import Celery

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fastpay_be.settings')

# Create Celery app
app = Celery('fastpay_be')

# Load config from Django settings, using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery connectivity."""
    print(f'Request: {self.request!r}')

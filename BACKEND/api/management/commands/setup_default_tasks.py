"""
Management command to set up default scheduled tasks.

Creates the initial periodic tasks in django-celery-beat's database.
Run this after migrations to seed the default schedule.

Usage:
    python manage.py setup_default_tasks
    python manage.py setup_default_tasks --reset  # Delete existing and recreate
"""
from django.core.management.base import BaseCommand
from django_celery_beat.models import (
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
)


class Command(BaseCommand):
    help = 'Create default scheduled tasks for FastPay'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing default tasks before creating new ones',
        )

    def handle(self, *args, **options):
        reset = options.get('reset', False)
        
        if reset:
            self.stdout.write('Resetting default tasks...')
            # Only delete tasks we manage (by name prefix)
            deleted, _ = PeriodicTask.objects.filter(
                name__startswith='[Default]'
            ).delete()
            self.stdout.write(f'Deleted {deleted} existing default tasks')
        
        # Create interval schedules
        interval_5min, _ = IntervalSchedule.objects.get_or_create(
            every=5, period=IntervalSchedule.MINUTES
        )
        interval_10min, _ = IntervalSchedule.objects.get_or_create(
            every=10, period=IntervalSchedule.MINUTES
        )
        interval_30min, _ = IntervalSchedule.objects.get_or_create(
            every=30, period=IntervalSchedule.MINUTES
        )
        interval_60min, _ = IntervalSchedule.objects.get_or_create(
            every=60, period=IntervalSchedule.MINUTES
        )
        
        # Create crontab schedules
        cron_3am, _ = CrontabSchedule.objects.get_or_create(
            minute='0',
            hour='3',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
        )
        cron_weekly, _ = CrontabSchedule.objects.get_or_create(
            minute='0',
            hour='4',
            day_of_week='0',  # Sunday
            day_of_month='*',
            month_of_year='*',
        )
        
        # Define default tasks
        default_tasks = [
            {
                'name': '[Default] Firebase sync and cleanup',
                'task': 'api.tasks.sync_firebase_and_cleanup_task',
                'interval': interval_5min,
                'description': 'Sync messages, notifications, contacts from Firebase to Django and clean Firebase',
                'enabled': True,
            },
            {
                'name': '[Default] Device Health Alerts',
                'task': 'api.tasks.send_device_alerts_task',
                'interval': interval_5min,
                'description': 'Check for offline devices, low battery, and sync failures',
                'enabled': True,
            },
            {
                'name': '[Default] OAuth Token Refresh',
                'task': 'api.tasks.refresh_oauth_tokens_task',
                'interval': interval_30min,
                'description': 'Refresh expiring Gmail/Drive OAuth tokens',
                'enabled': True,
            },
            {
                'name': '[Default] Service Health Check',
                'task': 'api.tasks.health_check_task',
                'interval': interval_10min,
                'description': 'Check health of Firebase, Telegram, and database',
                'enabled': True,
            },
            {
                'name': '[Default] Hard Firebase Sync',
                'task': 'api.tasks.hard_sync_firebase_task',
                'interval': interval_60min,
                'description': 'Full Firebase sync (device info, messages, notifications, contacts)',
                'enabled': False,  # Disabled by default, enable if needed
            },
            {
                'name': '[Default] Device Sync Status Update',
                'task': 'api.tasks.update_device_sync_status_task',
                'interval': interval_30min,
                'description': 'Mark devices as out_of_sync if they haven\'t synced recently',
                'enabled': True,
            },
            {
                'name': '[Default] Daily Log Cleanup',
                'task': 'api.tasks.cleanup_old_logs_task',
                'crontab': cron_3am,
                'description': 'Delete old logs based on retention settings (runs at 3 AM)',
                'enabled': True,
            },
            {
                'name': '[Default] Weekly Orphan Cleanup',
                'task': 'api.tasks.cleanup_orphaned_records_task',
                'crontab': cron_weekly,
                'description': 'Clean up orphaned records (runs Sunday at 4 AM)',
                'enabled': True,
            },
        ]
        
        created_count = 0
        updated_count = 0
        
        for task_config in default_tasks:
            name = task_config.pop('name')
            task = task_config.pop('task')
            interval = task_config.pop('interval', None)
            crontab = task_config.pop('crontab', None)
            description = task_config.pop('description', '')
            enabled = task_config.pop('enabled', True)
            
            defaults = {
                'task': task,
                'description': description,
            }
            
            if interval:
                defaults['interval'] = interval
                defaults['crontab'] = None
            elif crontab:
                defaults['crontab'] = crontab
                defaults['interval'] = None
            
            task_obj, created = PeriodicTask.objects.update_or_create(
                name=name,
                defaults=defaults,
            )
            
            # Only set enabled on creation to preserve user changes
            if created:
                task_obj.enabled = enabled
                task_obj.save(update_fields=['enabled'])
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'  Created: {name}')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'  Updated: {name}')
                )
        
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Done! Created {created_count} tasks, updated {updated_count} tasks.'
            )
        )
        self.stdout.write('')
        self.stdout.write('Tasks can be managed via:')
        self.stdout.write('  - Django Admin: /admin/django_celery_beat/')
        self.stdout.write('  - Dashboard API: /api/scheduled-tasks/')

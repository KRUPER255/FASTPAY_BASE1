"""
Views for scheduled task management.

Provides API endpoints for:
- CRUD operations on scheduled tasks (PeriodicTask)
- Viewing task execution history (TaskResult)
- Manually triggering tasks
- Listing available task names
"""
import json
import logging

from celery import current_app
from django.utils import timezone
from django_celery_beat.models import (
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
)
from django_celery_results.models import TaskResult
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.serializers import (
    PeriodicTaskSerializer,
    PeriodicTaskCreateSerializer,
    TaskResultSerializer,
)

logger = logging.getLogger(__name__)


class ScheduledTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing scheduled tasks (PeriodicTask from django-celery-beat).
    
    Provides CRUD operations plus:
    - run: Manually trigger a task
    - toggle: Enable/disable a task
    """
    queryset = PeriodicTask.objects.all().order_by('-date_changed')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PeriodicTaskCreateSerializer
        return PeriodicTaskSerializer
    
    def perform_create(self, serializer):
        """Create periodic task with schedule."""
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        """
        Manually trigger a scheduled task immediately.
        
        Returns the task_id of the queued task.
        """
        task = self.get_object()
        
        try:
            # Parse task arguments
            args = json.loads(task.args) if task.args else []
            kwargs = json.loads(task.kwargs) if task.kwargs else {}
            
            # Send task to Celery
            result = current_app.send_task(
                task.task,
                args=args,
                kwargs=kwargs,
            )
            
            # Update last_run_at
            task.last_run_at = timezone.now()
            task.total_run_count += 1
            task.save(update_fields=['last_run_at', 'total_run_count'])
            
            logger.info(f"Manually triggered task {task.name}: {result.id}")
            
            return Response({
                'task_id': result.id,
                'status': 'triggered',
                'task_name': task.task,
            })
            
        except Exception as exc:
            logger.error(f"Failed to trigger task {task.name}: {exc}")
            return Response(
                {'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """
        Enable or disable a scheduled task.
        
        Returns the new enabled state.
        """
        task = self.get_object()
        task.enabled = not task.enabled
        task.save(update_fields=['enabled'])
        
        logger.info(f"Toggled task {task.name}: enabled={task.enabled}")
        
        return Response({
            'id': task.id,
            'name': task.name,
            'enabled': task.enabled,
        })


class TaskResultViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for viewing task execution history.
    
    Provides list and retrieve operations for TaskResult records.
    """
    queryset = TaskResult.objects.all().order_by('-date_done')
    serializer_class = TaskResultSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Optionally filter by task_name or status.
        """
        queryset = super().get_queryset()
        
        task_name = self.request.query_params.get('task_name')
        if task_name:
            queryset = queryset.filter(task_name__icontains=task_name)
        
        task_status = self.request.query_params.get('status')
        if task_status:
            queryset = queryset.filter(status=task_status.upper())
        
        # Limit results for performance
        limit = self.request.query_params.get('limit', 100)
        try:
            limit = min(int(limit), 500)
        except ValueError:
            limit = 100
        
        return queryset[:limit]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_tasks(request):
    """
    List all registered Celery task names.
    
    Returns a list of task names that can be scheduled.
    Filters out internal Celery tasks.
    """
    tasks = list(current_app.tasks.keys())
    
    # Filter out celery internal tasks
    tasks = [t for t in tasks if not t.startswith('celery.')]
    
    # Group tasks by module
    grouped = {}
    for task in sorted(tasks):
        parts = task.rsplit('.', 1)
        module = parts[0] if len(parts) > 1 else 'other'
        if module not in grouped:
            grouped[module] = []
        grouped[module].append(task)
    
    return Response({
        'tasks': sorted(tasks),
        'grouped': grouped,
        'count': len(tasks),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_status(request, task_id):
    """
    Get the status of a specific task execution.
    
    Args:
        task_id: The Celery task ID
    
    Returns task status, result, and metadata.
    """
    try:
        result = TaskResult.objects.get(task_id=task_id)
        return Response({
            'task_id': result.task_id,
            'task_name': result.task_name,
            'status': result.status,
            'result': result.result,
            'date_created': result.date_created,
            'date_done': result.date_done,
            'traceback': result.traceback,
        })
    except TaskResult.DoesNotExist:
        # Check if task is still pending in Celery
        async_result = current_app.AsyncResult(task_id)
        return Response({
            'task_id': task_id,
            'status': async_result.status,
            'result': None,
            'info': 'Task not yet recorded in database',
        })

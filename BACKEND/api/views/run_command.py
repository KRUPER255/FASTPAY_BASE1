"""
Staff-only webpage to run allowlisted Django management commands.

GET  /api/run-command/  → HTML form (requires staff)
POST /api/run-command/  → Run command, return JSON { stdout, stderr, returncode }
"""
import io
import json
import logging

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.core.management import call_command, get_commands
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.views.decorators.vary import vary_on_cookie

logger = logging.getLogger(__name__)

# Commands allowed to run from the web UI (no shell, runserver, or destructive by default)
ALLOWED_COMMANDS = frozenset({
    'migrate',
    'showmigrations',
    'check',
    'create_test_data',
    'sync_firebase_messages',
    'hard_sync_firebase',
    'copy_firebase_to_django',
    'create_super_admin',
    'add_test_templates',
    'validate_env',
    'create_dashboard_users',
    'create_owner_credentials',
    'add_all_devices_to_admin',
    'add_devices_for_owner',
    'setup_dashboard',
    'setup_default_tasks',
    'send_device_alerts',
})


def _get_allowlisted_commands():
    """Return sorted list of (name, name) for dropdown; only those both allowed and available."""
    available = set(get_commands())
    return sorted(ALLOWED_COMMANDS & available)


@require_http_methods(['GET', 'POST'])
@ensure_csrf_cookie
@vary_on_cookie
@staff_member_required
def run_command_view(request):
    """GET: serve run-command HTML page. POST: run allowlisted command, return JSON."""
    if request.method == 'GET':
        return render(request, 'api/run_command.html', {
            'commands': _get_allowlisted_commands(),
        })

    try:
        body = request.body.decode('utf-8') if request.body else '{}'
        data = json.loads(body) if body.strip() else {}
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    command_name = (data.get('command') or '').strip()
    if not command_name:
        return JsonResponse({'error': 'Missing "command"'}, status=400)

    if command_name not in ALLOWED_COMMANDS:
        return JsonResponse({'error': f'Command not allowed: {command_name}'}, status=400)

    args = data.get('args')
    if args is None:
        args = []
    if isinstance(args, str):
        args = [a.strip() for a in args.split() if a.strip()]
    if not isinstance(args, list):
        return JsonResponse({'error': '"args" must be a list or string'}, status=400)
    args = [str(a) for a in args]

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    try:
        call_command(command_name, *args, stdout=stdout_buf, stderr=stderr_buf)
        returncode = 0
    except SystemExit as e:
        returncode = e.code if isinstance(e.code, int) else 1
    except Exception as e:
        logger.exception("run_command failed: %s", command_name)
        stderr_buf.write(str(e))
        returncode = 1

    return JsonResponse({
        'stdout': stdout_buf.getvalue(),
        'stderr': stderr_buf.getvalue(),
        'returncode': returncode,
    })

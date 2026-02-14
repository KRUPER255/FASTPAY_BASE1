"""
Register Telegram webhook URL for a bot.

Call Telegram's setWebhook so updates are sent to this server.
Run after deploy. Staging: use TELEGRAM_WEBHOOK_BASE_URL=https://sapi.<domain>;
production: https://api.<domain>.

Usage:
    python manage.py register_telegram_webhook --bot-id=1
    python manage.py register_telegram_webhook --bot-id=1 --base-url=https://api.example.com
"""
import requests
from django.conf import settings
from django.core.management.base import BaseCommand

from api.models import TelegramBot


class Command(BaseCommand):
    help = 'Register Telegram webhook URL for a bot (setWebhook).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--bot-id',
            type=int,
            required=True,
            help='ID of the TelegramBot to register',
        )
        parser.add_argument(
            '--base-url',
            type=str,
            default=None,
            help='Base URL for the API (default: TELEGRAM_WEBHOOK_BASE_URL or SITE_URL)',
        )

    def handle(self, *args, **options):
        bot_id = options['bot_id']
        base_url = (options.get('base_url') or getattr(settings, 'TELEGRAM_WEBHOOK_BASE_URL', '')).rstrip('/')
        if not base_url:
            base_url = getattr(settings, 'SITE_URL', 'http://localhost:8000').rstrip('/')

        try:
            bot = TelegramBot.objects.get(id=bot_id)
        except TelegramBot.DoesNotExist:
            self.stderr.write(self.style.ERROR(f'Bot with id={bot_id} not found.'))
            return

        if not bot.is_active:
            self.stderr.write(self.style.WARNING(f'Bot "{bot.name}" (id={bot_id}) is inactive.'))

        webhook_path = f'/api/telegram/webhook/{bot_id}/'
        url = f'{base_url}{webhook_path}'
        params = {'url': url}
        secret = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '') or ''
        if secret:
            params['secret_token'] = secret

        try:
            resp = requests.post(
                f'https://api.telegram.org/bot{bot.token}/setWebhook',
                data=params,
                timeout=15,
            )
            data = resp.json()
            if data.get('ok'):
                self.stdout.write(self.style.SUCCESS(f'Webhook registered for bot "{bot.name}" (id={bot_id}): {url}'))
            else:
                self.stderr.write(self.style.ERROR(f'Telegram API error: {data.get("description", resp.text)}'))
        except requests.RequestException as e:
            self.stderr.write(self.style.ERROR(f'Request failed: {e}'))

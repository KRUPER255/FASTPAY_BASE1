"""
Tests for Telegram webhook view and /link flow.

Run with:
    pytest api/tests/test_telegram_webhook.py -v
"""
import json
from unittest.mock import patch

import pytest
from django.test import Client, override_settings
from django.urls import reverse
from django.utils import timezone

from api.models import TelegramBot, TelegramUserLink, Company, DashUser


@pytest.fixture
def company(db):
    return Company.objects.create(code='REDPAY', name='RedPay', is_active=True)


@pytest.fixture
def dash_user(db, company):
    return DashUser.objects.create(
        email='user@test.com',
        password='testpass',
        company=company,
        access_level=2,
        status='active',
    )


@pytest.fixture
def telegram_bot(db):
    return TelegramBot.objects.create(
        name='TestBot',
        token='123456:ABC-DEF',
        chat_ids=[],
        is_active=True,
    )


@pytest.fixture
def client():
    return Client()


@pytest.mark.django_db
class TestTelegramWebhookView:
    """Test telegram_webhook view (POST /api/telegram/webhook/<bot_id>/)."""

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_webhook_post_returns_200_with_valid_update(self, client, telegram_bot):
        """POST with valid Telegram Update JSON returns 200 and ok: true."""
        url = reverse('telegram-webhook', kwargs={'bot_id': telegram_bot.id})
        body = {
            'update_id': 1,
            'message': {
                'message_id': 1,
                'from': {'id': 123, 'first_name': 'Test'},
                'chat': {'id': 456, 'type': 'private'},
                'text': '/start',
            },
        }
        with patch('api.views.telegram.send_message') as mock_send:
            response = client.post(
                url,
                data=json.dumps(body),
                content_type='application/json',
                follow=True,
            )
        assert response.status_code == 200
        data = response.json()
        assert data.get('ok') is True
        mock_send.assert_called_once()

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_webhook_404_when_bot_not_found(self, client):
        """POST with invalid bot_id returns 404."""
        url = reverse('telegram-webhook', kwargs={'bot_id': 99999})
        response = client.post(
            url,
            data=json.dumps({'update_id': 1}),
            content_type='application/json',
            follow=True,
        )
        assert response.status_code == 404
        assert response.json().get('ok') is False

    @override_settings(TELEGRAM_WEBHOOK_SECRET='my-secret', SECURE_SSL_REDIRECT=False)
    def test_webhook_403_when_secret_mismatch(self, client, telegram_bot):
        """When TELEGRAM_WEBHOOK_SECRET is set, wrong header returns 403."""
        url = reverse('telegram-webhook', kwargs={'bot_id': telegram_bot.id})
        response = client.post(
            url,
            data=json.dumps({'update_id': 1, 'message': {'chat': {'id': 1}, 'text': '/start'}}),
            content_type='application/json',
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN='wrong-secret',
            follow=True,
        )
        assert response.status_code == 403

    @override_settings(TELEGRAM_WEBHOOK_SECRET='my-secret', SECURE_SSL_REDIRECT=False)
    def test_webhook_200_when_secret_match(self, client, telegram_bot):
        """When TELEGRAM_WEBHOOK_SECRET is set and header matches, request is processed."""
        url = reverse('telegram-webhook', kwargs={'bot_id': telegram_bot.id})
        body = {
            'update_id': 1,
            'message': {
                'message_id': 1,
                'from': {'id': 123},
                'chat': {'id': 456, 'type': 'private'},
                'text': '/start',
            },
        }
        with patch('api.views.telegram.send_message'):
            response = client.post(
                url,
                data=json.dumps(body),
                content_type='application/json',
                HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN='my-secret',
                follow=True,
            )
        assert response.status_code == 200


@pytest.mark.django_db
class TestTelegramLinkCommand:
    """Test /link command in webhook: completes TelegramUserLink."""

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_link_command_completes_link(self, client, telegram_bot, company, dash_user):
        """When user sends /link <token>, link is updated with chat_id and token cleared."""
        link = TelegramUserLink.objects.create(
            company=company,
            user=dash_user,
            telegram_bot=telegram_bot,
            telegram_chat_id='',
            link_token='abc123token',
            link_token_expires_at=timezone.now() + timezone.timedelta(minutes=15),
        )
        url = reverse('telegram-webhook', kwargs={'bot_id': telegram_bot.id})
        body = {
            'update_id': 2,
            'message': {
                'message_id': 2,
                'from': {'id': 111},
                'chat': {'id': 999, 'type': 'private'},
                'text': f'/link abc123token',
            },
        }
        with patch('api.views.telegram.send_message') as mock_send:
            response = client.post(
                url,
                data=json.dumps(body),
                content_type='application/json',
                follow=True,
            )
        assert response.status_code == 200
        link.refresh_from_db()
        assert link.telegram_chat_id == '999'
        assert link.link_token is None
        assert link.link_token_expires_at is None
        assert mock_send.call_count >= 1

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_link_command_with_link_prefix(self, client, telegram_bot, company, dash_user):
        """Deep link sends start=link_<token>; /link link_<token> should work."""
        link = TelegramUserLink.objects.create(
            company=company,
            user=dash_user,
            telegram_bot=telegram_bot,
            telegram_chat_id='',
            link_token='xyz789',
            link_token_expires_at=timezone.now() + timezone.timedelta(minutes=15),
        )
        url = reverse('telegram-webhook', kwargs={'bot_id': telegram_bot.id})
        body = {
            'update_id': 3,
            'message': {
                'message_id': 3,
                'from': {'id': 1},
                'chat': {'id': 888, 'type': 'private'},
                'text': '/link link_xyz789',
            },
        }
        with patch('api.views.telegram.send_message'):
            client.post(url, data=json.dumps(body), content_type='application/json', follow=True)
        link.refresh_from_db()
        assert link.telegram_chat_id == '888'
        assert link.link_token is None

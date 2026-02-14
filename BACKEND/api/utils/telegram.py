"""
Full-featured Telegram integration for FastPay Backend

Features:
- Send messages, alerts, photos, documents
- Inline keyboards and callback handling
- Bot webhook for receiving commands
- Multi-bot support via database (TelegramBot model) or TELEGRAM_BOT_CONFIGS
- Throttled alerts to prevent spam
- Automatic usage tracking for database bots

Configuration Sources (in priority order):
1. Explicit token/chat_ids parameters
2. Database TelegramBot model (by bot_name or bot_id)
3. TELEGRAM_BOT_CONFIGS environment variable
4. Default TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_IDS

Environment Variables:
- TELEGRAM_BOT_TOKEN: Default bot token
- TELEGRAM_CHAT_IDS: Comma-separated chat IDs for default bot
- TELEGRAM_BOT_CONFIGS: JSON array of {name, token, chat_ids} for multiple bots
- TELEGRAM_ALERT_THROTTLE_SECONDS: Default throttle period (default: 60)

Usage:
    from api.utils.telegram import send_message, send_alert, build_keyboard

    # Simple message (uses default bot)
    send_message("Hello world")

    # Message with database bot (by name)
    send_message("Deploy started", bot_name="Payment Alerts")

    # Message with database bot (by ID)
    send_message("Transaction complete", bot_id=1)

    # Throttled alert
    send_alert("Server down!", throttle_seconds=300)

    # With inline keyboard
    keyboard = build_keyboard([
        [("View Logs", "logs:123"), ("Restart", "restart:123")],
        [("Cancel", "cancel")]
    ])
    send_message("Choose action:", reply_markup=keyboard)

    # Get all active bots
    from api.utils.telegram import get_active_bots
    bots = get_active_bots()
"""
import json
import logging
import os
import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple, Union

import requests

logger = logging.getLogger(__name__)

# Throttle state for alerts
_LAST_SENT: Dict[str, float] = {}

# Webhook command handlers
_COMMAND_HANDLERS: Dict[str, Callable] = {}
_CALLBACK_HANDLERS: Dict[str, Callable] = {}

# =============================================================================
# Configuration helpers
# =============================================================================

def _get_bot_token() -> Optional[str]:
    """Get default bot token from environment"""
    return os.environ.get("TELEGRAM_BOT_TOKEN")


def _parse_chat_ids(value: Any) -> List[str]:
    """Parse chat IDs from various formats (string, list, tuple)"""
    if not value:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(cid).strip() for cid in value if str(cid).strip()]
    return [cid.strip() for cid in str(value).split(",") if cid.strip()]


def _get_chat_ids() -> List[str]:
    """Get default chat IDs from environment"""
    return _parse_chat_ids(os.environ.get("TELEGRAM_CHAT_IDS", ""))


def _get_bot_configs() -> Dict[str, Dict[str, Any]]:
    """
    Get named bot configurations from TELEGRAM_BOT_CONFIGS environment variable.
    
    Expected format: JSON array or object
    [{"name": "alerts", "token": "...", "chat_ids": "123,456"}]
    or
    {"name": "alerts", "token": "...", "chat_ids": ["123", "456"]}
    """
    raw = os.environ.get("TELEGRAM_BOT_CONFIGS")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Telegram bot configs invalid JSON")
        return {}
    
    configs = {}
    if isinstance(data, dict):
        data = [data]
    
    for entry in data:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name") or entry.get("id")
        token = entry.get("token")
        chat_ids = _parse_chat_ids(entry.get("chat_ids"))
        if name and token and chat_ids:
            configs[str(name)] = {"token": str(token), "chat_ids": chat_ids}
    
    return configs


def _get_db_bot(bot_name: Optional[str] = None, bot_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Get bot configuration from database.
    
    Args:
        bot_name: Bot name to look up
        bot_id: Bot ID to look up (takes precedence over name)
    
    Returns:
        Dict with token, chat_ids, chat_type, message_thread_id or None
    """
    try:
        # Import here to avoid circular imports
        from api.models import TelegramBot
        
        if bot_id:
            bot = TelegramBot.objects.filter(id=bot_id, is_active=True).first()
        elif bot_name:
            bot = TelegramBot.objects.filter(name__iexact=bot_name, is_active=True).first()
        else:
            return None
        
        if bot:
            return {
                "id": bot.id,
                "token": bot.token,
                "chat_ids": bot.chat_ids if isinstance(bot.chat_ids, list) else [bot.chat_ids] if bot.chat_ids else [],
                "chat_type": bot.chat_type,
                "message_thread_id": bot.message_thread_id,
            }
    except Exception as exc:
        logger.debug("DB bot lookup failed: %s", exc)
    
    return None


def _resolve_bot(
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
    token: Optional[str] = None,
    chat_ids: Optional[Sequence[str]] = None,
) -> Tuple[Optional[str], List[str], Optional[Dict[str, Any]]]:
    """
    Resolve bot token and chat IDs from various sources.
    Priority: explicit params > database bot > named env config > default env vars
    
    Returns:
        Tuple of (token, chat_ids, bot_config_dict)
        bot_config_dict contains extra info like message_thread_id for DB bots
    """
    # Explicit params take priority
    if token and chat_ids:
        return token, _parse_chat_ids(chat_ids), None
    
    # Try database lookup first
    db_bot = _get_db_bot(bot_name, bot_id)
    if db_bot:
        return db_bot["token"], db_bot["chat_ids"], db_bot
    
    # Try named environment config
    if bot_name:
        config = _get_bot_configs().get(bot_name)
        if config:
            return config["token"], config["chat_ids"], None
    
    # Fall back to default env vars
    return _get_bot_token(), _get_chat_ids(), None


def _update_bot_usage(bot_id: Optional[int]) -> None:
    """Update bot usage statistics after sending a message"""
    if not bot_id:
        return
    try:
        from api.models import TelegramBot
        bot = TelegramBot.objects.filter(id=bot_id).first()
        if bot:
            bot.increment_message_count()
    except Exception as exc:
        logger.debug("Failed to update bot usage: %s", exc)


def get_active_bots() -> List[Dict[str, Any]]:
    """
    Get all active bots from the database.
    
    Returns:
        List of bot configurations with id, name, token, chat_ids, chat_type
    """
    try:
        from api.models import TelegramBot
        bots = TelegramBot.objects.filter(is_active=True).values(
            'id', 'name', 'token', 'chat_ids', 'chat_type', 'message_thread_id',
            'chat_title', 'description'
        )
        return list(bots)
    except Exception as exc:
        logger.debug("Failed to get active bots: %s", exc)
        return []


def get_bot_by_name(name: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific bot by name from the database.
    
    Args:
        name: Bot name (case-insensitive)
    
    Returns:
        Bot configuration dict or None
    """
    return _get_db_bot(bot_name=name)


def get_bot_by_id(bot_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a specific bot by ID from the database.
    
    Args:
        bot_id: Bot database ID
    
    Returns:
        Bot configuration dict or None
    """
    return _get_db_bot(bot_id=bot_id)


# =============================================================================
# Message sending functions
# =============================================================================

def send_message(
    text: str,
    *,
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
    token: Optional[str] = None,
    chat_ids: Optional[Sequence[str]] = None,
    chat_id: Optional[str] = None,
    message_thread_id: Optional[int] = None,
    parse_mode: Optional[str] = None,
    disable_preview: bool = True,
    disable_notification: bool = False,
    reply_markup: Optional[Dict] = None,
) -> bool:
    """
    Send a text message to Telegram.
    
    Args:
        text: Message text (supports HTML/Markdown based on parse_mode)
        bot_name: Named bot configuration to use (supports database bots)
        bot_id: Database bot ID to use (takes precedence over bot_name)
        token: Explicit bot token (overrides bot_name/bot_id)
        chat_ids: List of chat IDs to send to
        chat_id: Single chat ID (alternative to chat_ids)
        message_thread_id: Topic ID for supergroup with topics enabled
        parse_mode: "HTML" or "Markdown" for formatting
        disable_preview: Disable link previews
        disable_notification: Send silently
        reply_markup: Inline keyboard or other reply markup
    
    Returns:
        True if all messages sent successfully
    """
    resolved_token, resolved_chat_ids, bot_config = _resolve_bot(bot_name, bot_id, token, chat_ids)
    
    # Allow single chat_id override
    if chat_id:
        resolved_chat_ids = [chat_id]
    
    if not resolved_token or not resolved_chat_ids:
        logger.info("Telegram message skipped: missing bot token or chat ids")
        return False

    # Get message_thread_id from bot config if not explicitly provided
    thread_id = message_thread_id
    if thread_id is None and bot_config:
        thread_id = bot_config.get("message_thread_id")
    
    ok = True
    for cid in resolved_chat_ids:
        payload: Dict[str, Any] = {
            "chat_id": cid,
            "text": text,
            "disable_web_page_preview": disable_preview,
            "disable_notification": disable_notification,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        if reply_markup:
            payload["reply_markup"] = reply_markup
        
        # Add message_thread_id for supergroup topics
        if thread_id and bot_config and bot_config.get("chat_type") == "supergroup":
            payload["message_thread_id"] = thread_id
        
        try:
            response = requests.post(
                f"https://api.telegram.org/bot{resolved_token}/sendMessage",
                json=payload,
                timeout=10,
            )
            if response.ok:
                # Update usage stats for DB bots
                if bot_config and bot_config.get("id"):
                    _update_bot_usage(bot_config["id"])
            else:
                ok = False
                logger.warning("Telegram message failed: %s", response.text)
        except requests.RequestException as exc:
            ok = False
            logger.warning("Telegram message error: %s", exc)
    
    return ok


def send_alert(
    text: str,
    *,
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
    token: Optional[str] = None,
    chat_ids: Optional[Sequence[str]] = None,
    throttle_seconds: Optional[int] = None,
    throttle_key: Optional[str] = None,
    parse_mode: Optional[str] = None,
) -> bool:
    """
    Send a throttled alert message.
    
    Alerts with the same throttle_key (or message text) will be rate-limited
    to prevent spam during recurring issues.
    
    Args:
        text: Alert message text
        bot_name: Named bot configuration (supports database bots)
        bot_id: Database bot ID
        throttle_seconds: Minimum seconds between identical alerts (default: 60)
        throttle_key: Custom key for throttling (default: message text)
        ... (other args same as send_message)
    
    Returns:
        True if message was sent (not throttled and successful)
    """
    throttle_seconds = throttle_seconds or int(
        os.environ.get("TELEGRAM_ALERT_THROTTLE_SECONDS", "60")
    )
    key = throttle_key or text
    now = time.time()
    last_sent = _LAST_SENT.get(key)
    
    if last_sent and (now - last_sent) < throttle_seconds:
        logger.info("Telegram alert throttled (key=%s)", key[:50])
        return False
    
    _LAST_SENT[key] = now
    
    return send_message(
        text,
        bot_name=bot_name,
        bot_id=bot_id,
        token=token,
        chat_ids=chat_ids,
        parse_mode=parse_mode,
        disable_preview=True,
    )


def format_alert(
    title: str,
    body: str,
    sections: Optional[Dict[str, str]] = None,
    parse_mode: str = "HTML",
) -> str:
    """
    Format an alert message with optional title and sections.
    
    Args:
        title: Alert title (e.g. "Device offline")
        body: Main body text
        sections: Optional dict of label -> value for extra lines
        parse_mode: "HTML" or "Markdown" (HTML escapes < and > in values)
    
    Returns:
        Formatted string suitable for send_message/send_alert
    """
    if parse_mode == "HTML":
        def esc(s: str) -> str:
            return (
                str(s)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
    else:
        def esc(s: str) -> str:
            return str(s)
    
    parts = [f"<b>{esc(title)}</b>", "", esc(body)]
    if sections:
        for label, value in sections.items():
            parts.append(f"{esc(label)}: {esc(value)}")
    return "\n".join(parts)


def send_alert_templated(
    template_key: str,
    context: Dict[str, Any],
    *,
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
    throttle_key: Optional[str] = None,
    throttle_seconds: Optional[int] = None,
    parse_mode: Optional[str] = "HTML",
) -> bool:
    """
    Send an alert using a simple template. Built-in templates: device_offline, sync_failed, health_check_failed.
    For custom text use send_alert directly.
    """
    templates = {
        "device_offline": lambda c: format_alert(
            "Device offline",
            f"Device {c.get('device_id', '?')} has not been seen recently.",
            {"Last seen": c.get("last_seen", "n/a")},
            parse_mode=parse_mode or "HTML",
        ),
        "sync_failed": lambda c: format_alert(
            "Sync failed",
            c.get("message", str(c)),
            {"Device": c.get("device_id", "n/a"), "Error": c.get("error", "n/a")},
            parse_mode=parse_mode or "HTML",
        ),
        "health_check_failed": lambda c: format_alert(
            "Health check failed",
            c.get("message", "One or more services are unhealthy."),
            sections=c.get("details") if isinstance(c.get("details"), dict) else None,
            parse_mode=parse_mode or "HTML",
        ),
    }
    text = templates.get(template_key)
    if callable(text):
        text = text(context)
    else:
        text = context.get("message", str(context))
    key = throttle_key or f"templated:{template_key}"
    return send_alert(
        text,
        bot_name=bot_name,
        bot_id=bot_id,
        throttle_key=key,
        throttle_seconds=throttle_seconds,
        parse_mode=parse_mode,
    )


def send_photo(
    photo: Union[str, bytes],
    *,
    caption: Optional[str] = None,
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
    token: Optional[str] = None,
    chat_ids: Optional[Sequence[str]] = None,
    chat_id: Optional[str] = None,
    parse_mode: Optional[str] = None,
) -> bool:
    """
    Send a photo to Telegram.
    
    Args:
        photo: File path, URL, or bytes of the image
        caption: Optional caption text
        bot_name: Named bot configuration (supports database bots)
        bot_id: Database bot ID
        ... (other args same as send_message)
    
    Returns:
        True if all photos sent successfully
    """
    resolved_token, resolved_chat_ids, bot_config = _resolve_bot(bot_name, bot_id, token, chat_ids)
    
    if chat_id:
        resolved_chat_ids = [chat_id]
    
    if not resolved_token or not resolved_chat_ids:
        logger.info("Telegram photo skipped: missing bot token or chat ids")
        return False

    ok = True
    for cid in resolved_chat_ids:
        try:
            data: Dict[str, Any] = {"chat_id": cid}
            if caption:
                data["caption"] = caption
            if parse_mode:
                data["parse_mode"] = parse_mode
            
            if isinstance(photo, bytes):
                files = {"photo": ("photo.jpg", photo)}
                response = requests.post(
                    f"https://api.telegram.org/bot{resolved_token}/sendPhoto",
                    data=data,
                    files=files,
                    timeout=30,
                )
            elif photo.startswith(("http://", "https://")):
                data["photo"] = photo
                response = requests.post(
                    f"https://api.telegram.org/bot{resolved_token}/sendPhoto",
                    json=data,
                    timeout=30,
                )
            else:
                # File path
                with open(photo, "rb") as f:
                    files = {"photo": f}
                    response = requests.post(
                        f"https://api.telegram.org/bot{resolved_token}/sendPhoto",
                        data=data,
                        files=files,
                        timeout=30,
                    )
            
            if not response.ok:
                ok = False
                logger.warning("Telegram photo failed: %s", response.text)
        except Exception as exc:
            ok = False
            logger.warning("Telegram photo error: %s", exc)
    
    return ok


def send_document(
    document: Union[str, bytes],
    *,
    filename: Optional[str] = None,
    caption: Optional[str] = None,
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
    token: Optional[str] = None,
    chat_ids: Optional[Sequence[str]] = None,
    chat_id: Optional[str] = None,
    parse_mode: Optional[str] = None,
) -> bool:
    """
    Send a document/file to Telegram.
    
    Args:
        document: File path, URL, or bytes of the document
        filename: Filename for bytes input
        caption: Optional caption text
        bot_name: Named bot configuration (supports database bots)
        bot_id: Database bot ID
        ... (other args same as send_message)
    
    Returns:
        True if all documents sent successfully
    """
    resolved_token, resolved_chat_ids, bot_config = _resolve_bot(bot_name, bot_id, token, chat_ids)
    
    if chat_id:
        resolved_chat_ids = [chat_id]
    
    if not resolved_token or not resolved_chat_ids:
        logger.info("Telegram document skipped: missing bot token or chat ids")
        return False

    ok = True
    for cid in resolved_chat_ids:
        try:
            data: Dict[str, Any] = {"chat_id": cid}
            if caption:
                data["caption"] = caption
            if parse_mode:
                data["parse_mode"] = parse_mode
            
            if isinstance(document, bytes):
                fname = filename or "document"
                files = {"document": (fname, document)}
                response = requests.post(
                    f"https://api.telegram.org/bot{resolved_token}/sendDocument",
                    data=data,
                    files=files,
                    timeout=60,
                )
            elif document.startswith(("http://", "https://")):
                data["document"] = document
                response = requests.post(
                    f"https://api.telegram.org/bot{resolved_token}/sendDocument",
                    json=data,
                    timeout=60,
                )
            else:
                # File path
                with open(document, "rb") as f:
                    files = {"document": f}
                    response = requests.post(
                        f"https://api.telegram.org/bot{resolved_token}/sendDocument",
                        data=data,
                        files=files,
                        timeout=60,
                    )
            
            if not response.ok:
                ok = False
                logger.warning("Telegram document failed: %s", response.text)
        except Exception as exc:
            ok = False
            logger.warning("Telegram document error: %s", exc)
    
    return ok


# =============================================================================
# Inline keyboard helpers
# =============================================================================

def build_keyboard(
    buttons: List[List[Tuple[str, str]]],
) -> Dict[str, Any]:
    """
    Build an inline keyboard markup.
    
    Args:
        buttons: 2D list of (text, callback_data) tuples
                 Each inner list is a row of buttons
    
    Example:
        keyboard = build_keyboard([
            [("Option 1", "opt1"), ("Option 2", "opt2")],
            [("Cancel", "cancel")]
        ])
    
    Returns:
        Telegram inline_keyboard reply_markup dict
    """
    inline_keyboard = []
    for row in buttons:
        keyboard_row = []
        for text, callback_data in row:
            keyboard_row.append({
                "text": text,
                "callback_data": callback_data,
            })
        inline_keyboard.append(keyboard_row)
    
    return {"inline_keyboard": inline_keyboard}


def answer_callback(
    callback_query_id: str,
    *,
    text: Optional[str] = None,
    show_alert: bool = False,
    token: Optional[str] = None,
    bot_name: Optional[str] = None,
    bot_id: Optional[int] = None,
) -> bool:
    """
    Answer a callback query from an inline keyboard button press.
    
    Args:
        callback_query_id: The callback query ID from the update
        text: Optional notification text to show
        show_alert: Show as alert popup instead of toast
        token: Bot token
        bot_name: Named bot configuration (supports database bots)
        bot_id: Database bot ID
    
    Returns:
        True if answered successfully
    """
    resolved_token, _, _ = _resolve_bot(bot_name, bot_id, token, None)
    
    if not resolved_token:
        logger.warning("Cannot answer callback: missing bot token")
        return False
    
    payload: Dict[str, Any] = {"callback_query_id": callback_query_id}
    if text:
        payload["text"] = text
    if show_alert:
        payload["show_alert"] = True
    
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{resolved_token}/answerCallbackQuery",
            json=payload,
            timeout=10,
        )
        return response.ok
    except requests.RequestException as exc:
        logger.warning("Answer callback error: %s", exc)
        return False


# =============================================================================
# Webhook handling
# =============================================================================

def register_command(command: str):
    """
    Decorator to register a command handler.
    
    Usage:
        @register_command("status")
        def handle_status(update, chat_id, args):
            send_message("System is running", chat_id=chat_id)
    """
    def decorator(func: Callable):
        _COMMAND_HANDLERS[command.lstrip("/")] = func
        return func
    return decorator


def register_callback(prefix: str):
    """
    Decorator to register a callback query handler.
    
    Usage:
        @register_callback("restart")
        def handle_restart(update, chat_id, data):
            # data is the part after "restart:"
            send_message(f"Restarting {data}", chat_id=chat_id)
    """
    def decorator(func: Callable):
        _CALLBACK_HANDLERS[prefix] = func
        return func
    return decorator


class TelegramWebhook:
    """
    Webhook handler for receiving Telegram bot updates.
    
    Usage in Django:
        from django.http import JsonResponse
        from api.utils.telegram import TelegramWebhook
        
        webhook = TelegramWebhook()
        
        # Register handlers
        @webhook.command("status")
        def handle_status(update, chat_id, args):
            send_message("System OK", chat_id=chat_id)
        
        # In views.py
        def telegram_webhook(request):
            webhook.process(request.body)
            return JsonResponse({"ok": True})
    """
    
    def __init__(self):
        self.command_handlers: Dict[str, Callable] = {}
        self.callback_handlers: Dict[str, Callable] = {}
    
    def command(self, cmd: str):
        """Decorator to register a command handler"""
        def decorator(func: Callable):
            self.command_handlers[cmd.lstrip("/")] = func
            return func
        return decorator
    
    def callback(self, prefix: str):
        """Decorator to register a callback handler"""
        def decorator(func: Callable):
            self.callback_handlers[prefix] = func
            return func
        return decorator
    
    def process(self, body: Union[str, bytes, Dict]) -> bool:
        """
        Process a webhook update from Telegram.
        
        Args:
            body: Request body (JSON string, bytes, or parsed dict)
        
        Returns:
            True if update was handled
        """
        try:
            if isinstance(body, (str, bytes)):
                update = json.loads(body)
            else:
                update = body
            
            # Handle callback queries (inline keyboard button presses)
            if "callback_query" in update:
                return self._handle_callback(update)
            
            # Handle messages
            if "message" in update:
                return self._handle_message(update)
            
            return False
            
        except Exception as exc:
            logger.error("Webhook processing error: %s", exc)
            return False
    
    def _handle_message(self, update: Dict) -> bool:
        """Handle incoming message"""
        message = update.get("message", {})
        text = message.get("text", "")
        chat_id = str(message.get("chat", {}).get("id", ""))
        
        if not text or not chat_id:
            return False
        
        # Check if it's a command
        if text.startswith("/"):
            parts = text[1:].split(None, 1)
            command = parts[0].split("@")[0]  # Remove bot username if present
            args = parts[1] if len(parts) > 1 else ""
            
            # Check instance handlers first, then global
            handler = self.command_handlers.get(command) or _COMMAND_HANDLERS.get(command)
            if handler:
                try:
                    handler(update, chat_id, args)
                    return True
                except Exception as exc:
                    logger.error("Command handler error: %s", exc)
        
        return False
    
    def _handle_callback(self, update: Dict) -> bool:
        """Handle callback query from inline keyboard"""
        callback = update.get("callback_query", {})
        callback_id = callback.get("id")
        data = callback.get("data", "")
        chat_id = str(callback.get("message", {}).get("chat", {}).get("id", ""))
        
        if not callback_id or not chat_id:
            return False
        
        # Parse callback data (format: "prefix:data" or just "prefix")
        if ":" in data:
            prefix, payload = data.split(":", 1)
        else:
            prefix, payload = data, ""
        
        # Check instance handlers first, then global
        handler = self.callback_handlers.get(prefix) or _CALLBACK_HANDLERS.get(prefix)
        if handler:
            try:
                handler(update, chat_id, payload)
                answer_callback(callback_id)
                return True
            except Exception as exc:
                logger.error("Callback handler error: %s", exc)
                answer_callback(callback_id, text="Error processing request")
        
        return False


# =============================================================================
# Legacy aliases for backward compatibility
# =============================================================================

# These match the old telegram_service.py API
send_telegram_message = send_message
send_telegram_alert = send_alert

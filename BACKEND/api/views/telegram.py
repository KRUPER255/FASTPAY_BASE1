"""
Telegram views: TelegramBot ViewSet and related endpoints

These views handle Telegram bot credential management and testing.
"""
import logging
import requests
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from api.models import TelegramBot
from api.serializers import (
    TelegramBotSerializer,
    TelegramBotListSerializer,
    TelegramBotCreateSerializer,
    TelegramBotUpdateSerializer,
    TelegramBotTestSerializer,
)
from api.pagination import SkipLimitPagination

logger = logging.getLogger(__name__)


class TelegramBotViewSet(viewsets.ModelViewSet):
    """
    ViewSet for TelegramBot CRUD operations
    
    Endpoints:
    - GET /api/telegram-bots/ - List all bots
    - GET /api/telegram-bots/?dropdown=true - List bots for dropdown (minimal fields)
    - POST /api/telegram-bots/ - Create a new bot
    - GET /api/telegram-bots/{id}/ - Get bot details
    - PUT /api/telegram-bots/{id}/ - Update bot
    - PATCH /api/telegram-bots/{id}/ - Partial update bot
    - DELETE /api/telegram-bots/{id}/ - Delete bot
    - POST /api/telegram-bots/{id}/test/ - Send test message
    - POST /api/telegram-bots/{id}/validate/ - Validate bot token
    
    Query Parameters:
    - name: Filter by name (partial match)
    - is_active: Filter by active status (true/false)
    - dropdown: If 'true', returns minimal fields for dropdown
    """
    queryset = TelegramBot.objects.all()
    serializer_class = TelegramBotSerializer
    pagination_class = SkipLimitPagination
    
    def get_serializer_class(self):
        # Check if dropdown mode is requested
        dropdown = self.request.query_params.get('dropdown', '').lower() in ('true', '1', 'yes')
        
        if dropdown and self.action == 'list':
            return TelegramBotListSerializer
        elif self.action == 'create':
            return TelegramBotCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TelegramBotUpdateSerializer
        elif self.action == 'test':
            return TelegramBotTestSerializer
        return TelegramBotSerializer
    
    def get_queryset(self):
        queryset = TelegramBot.objects.all()
        
        # Filter by name (partial match)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(name__icontains=name)
        
        # Filter by chat_type
        chat_type = self.request.query_params.get('chat_type')
        if chat_type:
            queryset = queryset.filter(chat_type=chat_type)
        
        # Filter by is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        
        # For dropdown, only show active bots by default
        dropdown = self.request.query_params.get('dropdown', '').lower() in ('true', '1', 'yes')
        if dropdown and is_active is None:
            queryset = queryset.filter(is_active=True)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """
        Send a test message using this bot
        
        POST /api/telegram-bots/{id}/test/
        Body: {
            "message": "Test message content",  // optional
            "chat_id": "123456789",  // optional, uses bot's chat_ids if not provided
            "message_thread_id": 123  // optional, for supergroup topics
        }
        """
        bot = self.get_object()
        
        if not bot.is_active:
            return Response(
                {"error": "Bot is not active"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TelegramBotTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        message = serializer.validated_data.get('message', 'Test message from FastPay Dashboard')
        chat_id = serializer.validated_data.get('chat_id')
        message_thread_id = serializer.validated_data.get('message_thread_id') or bot.message_thread_id
        
        # Determine which chat IDs to send to
        if chat_id:
            chat_ids = [chat_id]
        elif bot.chat_ids:
            chat_ids = bot.chat_ids if isinstance(bot.chat_ids, list) else [bot.chat_ids]
        else:
            return Response(
                {"error": "No chat IDs configured for this bot"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Send test message to each chat ID
        results = []
        for cid in chat_ids:
            try:
                payload = {
                    "chat_id": cid,
                    "text": message,
                    "parse_mode": "HTML"
                }
                
                # Add message_thread_id for supergroup topics
                if message_thread_id and bot.chat_type == 'supergroup':
                    payload["message_thread_id"] = message_thread_id
                
                response = requests.post(
                    f"https://api.telegram.org/bot{bot.token}/sendMessage",
                    json=payload,
                    timeout=10
                )
                result = response.json()
                
                if result.get('ok'):
                    # Update usage stats
                    bot.increment_message_count()
                    results.append({
                        "chat_id": cid,
                        "success": True,
                        "message_id": result.get('result', {}).get('message_id')
                    })
                else:
                    results.append({
                        "chat_id": cid,
                        "success": False,
                        "error": result.get('description', 'Unknown error')
                    })
            except requests.RequestException as e:
                logger.error(f"Failed to send test message to chat {cid}: {e}")
                results.append({
                    "chat_id": cid,
                    "success": False,
                    "error": str(e)
                })
        
        # Determine overall success
        all_success = all(r['success'] for r in results)
        any_success = any(r['success'] for r in results)
        
        return Response({
            "bot_name": bot.name,
            "chat_type": bot.chat_type,
            "overall_success": all_success,
            "partial_success": any_success and not all_success,
            "results": results
        }, status=status.HTTP_200_OK if any_success else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """
        Validate bot token by calling Telegram getMe API and update bot_username
        
        POST /api/telegram-bots/{id}/validate/
        """
        bot = self.get_object()
        
        try:
            response = requests.get(
                f"https://api.telegram.org/bot{bot.token}/getMe",
                timeout=10
            )
            result = response.json()
            
            if result.get('ok'):
                bot_info = result.get('result', {})
                
                # Update bot_username if available
                username = bot_info.get('username')
                if username and bot.bot_username != username:
                    bot.bot_username = username
                    bot.save(update_fields=['bot_username'])
                
                return Response({
                    "valid": True,
                    "bot_info": {
                        "id": bot_info.get('id'),
                        "username": bot_info.get('username'),
                        "first_name": bot_info.get('first_name'),
                        "can_join_groups": bot_info.get('can_join_groups'),
                        "can_read_all_group_messages": bot_info.get('can_read_all_group_messages'),
                        "supports_inline_queries": bot_info.get('supports_inline_queries')
                    },
                    "updated": bot.bot_username == username
                })
            else:
                return Response({
                    "valid": False,
                    "error": result.get('description', 'Invalid token')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except requests.RequestException as e:
            logger.error(f"Failed to validate bot token: {e}")
            return Response({
                "valid": False,
                "error": f"Connection error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='sync-info')
    def sync_info(self, request, pk=None):
        """
        Sync bot and chat info from Telegram API.
        Updates bot_username, chat_title, chat_username, and chat_type.
        
        POST /api/telegram-bots/{id}/sync-info/
        """
        bot = self.get_object()
        updates = {}
        errors = []
        
        try:
            # Get bot info
            response = requests.get(
                f"https://api.telegram.org/bot{bot.token}/getMe",
                timeout=10
            )
            result = response.json()
            
            if result.get('ok'):
                bot_info = result.get('result', {})
                if bot_info.get('username'):
                    bot.bot_username = bot_info.get('username')
                    updates['bot_username'] = bot.bot_username
            else:
                errors.append(f"getMe failed: {result.get('description')}")
        except requests.RequestException as e:
            errors.append(f"getMe error: {str(e)}")
        
        # Get chat info for first chat_id
        if bot.chat_ids:
            first_chat_id = bot.chat_ids[0] if isinstance(bot.chat_ids, list) else bot.chat_ids
            try:
                response = requests.get(
                    f"https://api.telegram.org/bot{bot.token}/getChat",
                    params={"chat_id": first_chat_id},
                    timeout=10
                )
                result = response.json()
                
                if result.get('ok'):
                    chat_info = result.get('result', {})
                    
                    # Update chat_type
                    chat_type = chat_info.get('type', 'channel')
                    if chat_type in ['private']:
                        bot.chat_type = 'personal'
                    else:
                        bot.chat_type = chat_type
                    updates['chat_type'] = bot.chat_type
                    
                    # Update chat_title
                    bot.chat_title = chat_info.get('title') or chat_info.get('first_name')
                    updates['chat_title'] = bot.chat_title
                    
                    # Update chat_username
                    if chat_info.get('username'):
                        bot.chat_username = f"@{chat_info.get('username')}"
                        updates['chat_username'] = bot.chat_username
                else:
                    errors.append(f"getChat failed: {result.get('description')}")
            except requests.RequestException as e:
                errors.append(f"getChat error: {str(e)}")
        
        # Save updates
        if updates:
            bot.save()
        
        return Response({
            "success": len(errors) == 0,
            "updates": updates,
            "errors": errors if errors else None
        }, status=status.HTTP_200_OK if updates else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def discover_chats(self, request, pk=None):
        """
        Discover all chats the bot has interacted with recently.
        Uses getUpdates API to find chat_ids automatically.
        
        GET /api/telegram-bots/{id}/discover-chats/
        
        Returns list of chats with their IDs, titles, and types.
        
        NOTE: This only works if webhook is NOT set. If webhook is set,
        you need to temporarily delete it or use the lookup endpoint instead.
        """
        bot = self.get_object()
        
        try:
            # Get recent updates (last 100)
            response = requests.get(
                f"https://api.telegram.org/bot{bot.token}/getUpdates",
                params={"limit": 100, "timeout": 1},
                timeout=15
            )
            result = response.json()
            
            if not result.get('ok'):
                # Check if webhook is set
                if 'conflict' in result.get('description', '').lower():
                    return Response({
                        "error": "Webhook is active. Use /lookup-chat endpoint instead, or delete webhook first.",
                        "hint": "Call DELETE https://api.telegram.org/bot<token>/deleteWebhook to remove webhook"
                    }, status=status.HTTP_409_CONFLICT)
                return Response({
                    "error": result.get('description', 'Failed to get updates')
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Extract unique chats from updates
            chats = {}
            updates = result.get('result', [])
            
            for update in updates:
                # Check various update types for chat info
                message = (
                    update.get('message') or 
                    update.get('edited_message') or 
                    update.get('channel_post') or 
                    update.get('edited_channel_post') or
                    update.get('my_chat_member', {}).get('chat')
                )
                
                if message:
                    chat = message.get('chat') if isinstance(message, dict) and 'chat' in message else message
                    if chat and 'id' in chat:
                        chat_id = str(chat['id'])
                        if chat_id not in chats:
                            chats[chat_id] = {
                                "chat_id": chat_id,
                                "type": chat.get('type', 'unknown'),
                                "title": chat.get('title') or chat.get('first_name') or chat.get('username') or 'Unknown',
                                "username": chat.get('username'),
                            }
                
                # Also check my_chat_member updates (when bot is added to group/channel)
                my_chat_member = update.get('my_chat_member')
                if my_chat_member:
                    chat = my_chat_member.get('chat', {})
                    chat_id = str(chat.get('id', ''))
                    if chat_id and chat_id not in chats:
                        chats[chat_id] = {
                            "chat_id": chat_id,
                            "type": chat.get('type', 'unknown'),
                            "title": chat.get('title') or chat.get('first_name') or 'Unknown',
                            "username": chat.get('username'),
                        }
            
            return Response({
                "bot_name": bot.name,
                "chats_found": len(chats),
                "chats": list(chats.values()),
                "hint": "Use the chat_id value to configure notifications"
            })
            
        except requests.RequestException as e:
            logger.error(f"Failed to discover chats: {e}")
            return Response({
                "error": f"Connection error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='lookup-chat')
    def lookup_chat(self, request, pk=None):
        """
        Lookup chat_id by username or get chat info by chat_id.
        Works for channels and groups with public usernames.
        
        POST /api/telegram-bots/{id}/lookup-chat/
        Body: {
            "username": "@mychannel"  // or "mychannel" without @
        }
        OR
        Body: {
            "chat_id": "-1001234567890"
        }
        
        Returns chat info including the numeric chat_id.
        """
        bot = self.get_object()
        
        username = request.data.get('username', '').strip()
        chat_id = request.data.get('chat_id', '').strip()
        
        if not username and not chat_id:
            return Response({
                "error": "Provide either 'username' (e.g., @mychannel) or 'chat_id'"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Use username or chat_id as the identifier
        identifier = chat_id if chat_id else username
        
        # Ensure username has @ prefix if it's a username
        if not chat_id and not identifier.startswith('@') and not identifier.startswith('-'):
            identifier = f"@{identifier}"
        
        try:
            response = requests.get(
                f"https://api.telegram.org/bot{bot.token}/getChat",
                params={"chat_id": identifier},
                timeout=10
            )
            result = response.json()
            
            if result.get('ok'):
                chat = result.get('result', {})
                return Response({
                    "success": True,
                    "chat": {
                        "chat_id": str(chat.get('id')),
                        "type": chat.get('type'),
                        "title": chat.get('title') or chat.get('first_name'),
                        "username": chat.get('username'),
                        "description": chat.get('description'),
                        "member_count": chat.get('member_count'),  # Only for groups/channels where bot is admin
                        "invite_link": chat.get('invite_link'),
                    },
                    "hint": f"Use chat_id: {chat.get('id')} in your configuration"
                })
            else:
                error_desc = result.get('description', 'Unknown error')
                hint = None
                if 'not found' in error_desc.lower():
                    hint = "Make sure the bot is a member of the group/channel, or the username is correct"
                elif 'bot was kicked' in error_desc.lower():
                    hint = "The bot was removed from this chat. Add the bot back first."
                    
                return Response({
                    "success": False,
                    "error": error_desc,
                    "hint": hint
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except requests.RequestException as e:
            logger.error(f"Failed to lookup chat: {e}")
            return Response({
                "success": False,
                "error": f"Connection error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='get-me')
    def get_me(self, request, pk=None):
        """
        Get bot info and generate start link for users to initiate chat.
        
        GET /api/telegram-bots/{id}/get-me/
        
        Returns bot info and a link users can click to start chatting with the bot.
        """
        bot = self.get_object()
        
        try:
            response = requests.get(
                f"https://api.telegram.org/bot{bot.token}/getMe",
                timeout=10
            )
            result = response.json()
            
            if result.get('ok'):
                bot_info = result.get('result', {})
                username = bot_info.get('username', '')
                
                return Response({
                    "success": True,
                    "bot": {
                        "id": bot_info.get('id'),
                        "username": username,
                        "first_name": bot_info.get('first_name'),
                        "can_join_groups": bot_info.get('can_join_groups'),
                        "can_read_all_group_messages": bot_info.get('can_read_all_group_messages'),
                    },
                    "links": {
                        "start_chat": f"https://t.me/{username}" if username else None,
                        "add_to_group": f"https://t.me/{username}?startgroup=true" if username else None,
                        "add_to_channel": f"https://t.me/{username}?startchannel=true" if username else None,
                    },
                    "instructions": {
                        "personal": f"1. Click https://t.me/{username}\n2. Click 'Start'\n3. Use /discover-chats to get your chat_id",
                        "group": f"1. Add @{username} to your group\n2. Use /discover-chats or /lookup-chat to get the chat_id",
                        "channel": f"1. Add @{username} as admin to your channel\n2. Use /lookup-chat with @channel_username to get chat_id",
                    }
                })
            else:
                return Response({
                    "success": False,
                    "error": result.get('description', 'Failed to get bot info')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except requests.RequestException as e:
            logger.error(f"Failed to get bot info: {e}")
            return Response({
                "success": False,
                "error": f"Connection error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Standalone function to validate token before creating a bot
from rest_framework.decorators import api_view

@api_view(['POST'])
def validate_telegram_token(request):
    """
    Validate a Telegram bot token without saving.
    Use this before creating a bot to verify the token is valid.
    
    POST /api/telegram/validate-token/
    Body: {
        "token": "123456789:ABCdefGHI..."
    }
    
    Returns bot info if valid.
    """
    token = request.data.get('token', '').strip()
    
    if not token:
        return Response({
            "error": "Token is required"
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Basic format validation
    if ':' not in token:
        return Response({
            "valid": False,
            "error": "Invalid token format. Token should be in format: 123456789:ABCdefGHI..."
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{token}/getMe",
            timeout=10
        )
        result = response.json()
        
        if result.get('ok'):
            bot_info = result.get('result', {})
            username = bot_info.get('username', '')
            
            return Response({
                "valid": True,
                "bot": {
                    "id": bot_info.get('id'),
                    "username": username,
                    "first_name": bot_info.get('first_name'),
                    "can_join_groups": bot_info.get('can_join_groups'),
                    "can_read_all_group_messages": bot_info.get('can_read_all_group_messages'),
                },
                "links": {
                    "start_chat": f"https://t.me/{username}" if username else None,
                    "add_to_group": f"https://t.me/{username}?startgroup=true" if username else None,
                },
                "next_steps": [
                    "1. Save this bot using POST /api/telegram-bots/",
                    "2. Add the bot to your group/channel",
                    "3. Use /discover-chats or /lookup-chat to get chat_id",
                    "4. Update the bot with the chat_id"
                ]
            })
        else:
            return Response({
                "valid": False,
                "error": result.get('description', 'Invalid token')
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except requests.RequestException as e:
        logger.error(f"Failed to validate token: {e}")
        return Response({
            "valid": False,
            "error": f"Connection error: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def discover_chats_by_token(request):
    """
    Discover chats using just a token (without saving bot first).
    Useful for initial setup.
    
    POST /api/telegram/discover-chats/
    Body: {
        "token": "123456789:ABCdefGHI..."
    }
    """
    token = request.data.get('token', '').strip()
    
    if not token:
        return Response({
            "error": "Token is required"
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{token}/getUpdates",
            params={"limit": 100, "timeout": 1},
            timeout=15
        )
        result = response.json()
        
        if not result.get('ok'):
            if 'conflict' in result.get('description', '').lower():
                return Response({
                    "error": "Webhook is active. Delete webhook first or use lookup endpoint.",
                    "hint": f"Call: https://api.telegram.org/bot{token[:20]}***/deleteWebhook"
                }, status=status.HTTP_409_CONFLICT)
            return Response({
                "error": result.get('description', 'Failed to get updates')
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract unique chats
        chats = {}
        for update in result.get('result', []):
            for key in ['message', 'edited_message', 'channel_post', 'edited_channel_post']:
                msg = update.get(key)
                if msg and 'chat' in msg:
                    chat = msg['chat']
                    chat_id = str(chat['id'])
                    if chat_id not in chats:
                        chats[chat_id] = {
                            "chat_id": chat_id,
                            "type": chat.get('type', 'unknown'),
                            "title": chat.get('title') or chat.get('first_name') or 'Unknown',
                            "username": chat.get('username'),
                        }
            
            # my_chat_member updates
            mcm = update.get('my_chat_member')
            if mcm and 'chat' in mcm:
                chat = mcm['chat']
                chat_id = str(chat['id'])
                if chat_id not in chats:
                    chats[chat_id] = {
                        "chat_id": chat_id,
                        "type": chat.get('type', 'unknown'),
                        "title": chat.get('title') or chat.get('first_name') or 'Unknown',
                        "username": chat.get('username'),
                    }
        
        return Response({
            "chats_found": len(chats),
            "chats": list(chats.values()),
            "hint": "Copy the chat_id and use it when creating/updating your bot"
        })
        
    except requests.RequestException as e:
        logger.error(f"Failed to discover chats: {e}")
        return Response({
            "error": f"Connection error: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def lookup_chat_by_token(request):
    """
    Lookup chat info using token + username/chat_id.
    Useful for getting chat_id from @username.
    
    POST /api/telegram/lookup-chat/
    Body: {
        "token": "123456789:ABCdefGHI...",
        "username": "@mychannel"  // or chat_id
    }
    """
    token = request.data.get('token', '').strip()
    username = request.data.get('username', '').strip()
    chat_id = request.data.get('chat_id', '').strip()
    
    if not token:
        return Response({"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    if not username and not chat_id:
        return Response({"error": "Provide 'username' or 'chat_id'"}, status=status.HTTP_400_BAD_REQUEST)
    
    identifier = chat_id if chat_id else username
    if not chat_id and not identifier.startswith('@') and not identifier.startswith('-'):
        identifier = f"@{identifier}"
    
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{token}/getChat",
            params={"chat_id": identifier},
            timeout=10
        )
        result = response.json()
        
        if result.get('ok'):
            chat = result.get('result', {})
            return Response({
                "success": True,
                "chat": {
                    "chat_id": str(chat.get('id')),
                    "type": chat.get('type'),
                    "title": chat.get('title') or chat.get('first_name'),
                    "username": chat.get('username'),
                    "description": chat.get('description'),
                },
                "hint": f"Use chat_id: {chat.get('id')}"
            })
        else:
            return Response({
                "success": False,
                "error": result.get('description', 'Chat not found'),
                "hint": "Make sure bot is member of the group/channel"
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except requests.RequestException as e:
        return Response({
            "error": f"Connection error: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


__all__ = [
    'TelegramBotViewSet',
    'validate_telegram_token',
    'discover_chats_by_token',
    'lookup_chat_by_token',
]

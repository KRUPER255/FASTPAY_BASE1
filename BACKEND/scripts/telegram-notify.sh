#!/bin/bash
#
# Telegram notification wrapper script
# Calls the Python telegram module for sending notifications from shell scripts
#
# Usage:
#   ./telegram-notify.sh "Your message here"
#   ./telegram-notify.sh --alert "Alert message" --throttle 300
#   ./telegram-notify.sh --photo /path/to/image.jpg --caption "Caption"
#   ./telegram-notify.sh --document /path/to/file.txt
#
# Environment Variables:
#   TELEGRAM_BOT_TOKEN - Bot token (required)
#   TELEGRAM_CHAT_IDS  - Comma-separated chat IDs (required)
#   TELEGRAM_BOT_NAME  - Named bot config to use (optional)
#   DJANGO_SETTINGS_MODULE - Django settings (default: fastpay_be.settings)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Default settings
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-fastpay_be.settings}"

# Parse arguments
MESSAGE=""
ALERT_MODE=false
THROTTLE_SECONDS=""
THROTTLE_KEY=""
PHOTO_PATH=""
DOCUMENT_PATH=""
CAPTION=""
PARSE_MODE=""
BOT_NAME=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --alert)
            ALERT_MODE=true
            shift
            ;;
        --throttle)
            THROTTLE_SECONDS="$2"
            shift 2
            ;;
        --throttle-key)
            THROTTLE_KEY="$2"
            shift 2
            ;;
        --photo)
            PHOTO_PATH="$2"
            shift 2
            ;;
        --document)
            DOCUMENT_PATH="$2"
            shift 2
            ;;
        --caption)
            CAPTION="$2"
            shift 2
            ;;
        --parse-mode)
            PARSE_MODE="$2"
            shift 2
            ;;
        --bot)
            BOT_NAME="$2"
            shift 2
            ;;
        --html)
            PARSE_MODE="HTML"
            shift
            ;;
        --markdown)
            PARSE_MODE="Markdown"
            shift
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
        *)
            MESSAGE="$1"
            shift
            ;;
    esac
done

# Validate inputs
if [[ -z "$MESSAGE" && -z "$PHOTO_PATH" && -z "$DOCUMENT_PATH" ]]; then
    echo "Usage: $0 [options] \"message\"" >&2
    echo "  --alert              Send as throttled alert" >&2
    echo "  --throttle SECONDS   Throttle period (default: 60)" >&2
    echo "  --throttle-key KEY   Custom throttle key" >&2
    echo "  --photo PATH         Send photo" >&2
    echo "  --document PATH      Send document" >&2
    echo "  --caption TEXT       Caption for photo/document" >&2
    echo "  --parse-mode MODE    HTML or Markdown" >&2
    echo "  --html               Use HTML parse mode" >&2
    echo "  --markdown           Use Markdown parse mode" >&2
    echo "  --bot NAME           Use named bot config" >&2
    exit 1
fi

# Build Python command
cd "$BACKEND_DIR"

PYTHON_CMD="
import sys
import os
sys.path.insert(0, '${BACKEND_DIR}')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${DJANGO_SETTINGS_MODULE}')

# Initialize Django if needed
try:
    import django
    django.setup()
except:
    pass

from api.utils.telegram import send_message, send_alert, send_photo, send_document

kwargs = {}
"

# Add bot_name if specified
if [[ -n "$BOT_NAME" ]]; then
    PYTHON_CMD+="kwargs['bot_name'] = '${BOT_NAME}'
"
fi

# Add parse_mode if specified
if [[ -n "$PARSE_MODE" ]]; then
    PYTHON_CMD+="kwargs['parse_mode'] = '${PARSE_MODE}'
"
fi

# Determine action
if [[ -n "$PHOTO_PATH" ]]; then
    PYTHON_CMD+="
result = send_photo(
    '''${PHOTO_PATH}''',
    caption='''${CAPTION}''' if '''${CAPTION}''' else None,
    **kwargs
)
"
elif [[ -n "$DOCUMENT_PATH" ]]; then
    PYTHON_CMD+="
result = send_document(
    '''${DOCUMENT_PATH}''',
    caption='''${CAPTION}''' if '''${CAPTION}''' else None,
    **kwargs
)
"
elif [[ "$ALERT_MODE" == "true" ]]; then
    if [[ -n "$THROTTLE_SECONDS" ]]; then
        PYTHON_CMD+="kwargs['throttle_seconds'] = ${THROTTLE_SECONDS}
"
    fi
    if [[ -n "$THROTTLE_KEY" ]]; then
        PYTHON_CMD+="kwargs['throttle_key'] = '''${THROTTLE_KEY}'''
"
    fi
    PYTHON_CMD+="
result = send_alert('''${MESSAGE}''', **kwargs)
"
else
    PYTHON_CMD+="
result = send_message('''${MESSAGE}''', **kwargs)
"
fi

PYTHON_CMD+="
sys.exit(0 if result else 1)
"

# Execute
python3 -c "$PYTHON_CMD"

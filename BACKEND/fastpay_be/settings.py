"""
Django settings for fastpay_be project.
"""

from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Security settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-this-in-production-!@#$%^&*()')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '*').split(',')] if os.environ.get('ALLOWED_HOSTS') else ['*', 'localhost', '127.0.0.1', '72.60.202.91']

# Trust HTTPS behind reverse proxy (nginx)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Support mounting the app under a path prefix (e.g., /test for staging)
FORCE_SCRIPT_NAME = os.environ.get('FORCE_SCRIPT_NAME') or None

# CSRF trusted origins (required when using HTTPS with reverse proxy)
csrf_origins = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = [o.strip() for o in csrf_origins.split(',') if o.strip()]

# Production security settings (skip SSL redirect during tests so test client gets 200, not 301)
import sys
TESTING = 'test' in sys.argv
if not DEBUG and not TESTING:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000 if os.environ.get('USE_HTTPS', 'False') == 'True' else 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = os.environ.get('USE_HTTPS', 'False') == 'True'
    # Exempt /health/ so Docker/load balancer healthchecks get 200 over HTTP
    SECURE_REDIRECT_EXEMPT = [r'^health/']  # path matched without leading slash
    SESSION_COOKIE_SECURE = os.environ.get('USE_HTTPS', 'False') == 'True'
    CSRF_COOKIE_SECURE = os.environ.get('USE_HTTPS', 'False') == 'True'

# Application definition
INSTALLED_APPS = [
    'django_admin_kubi',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_celery_beat',
    'django_celery_results',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'api.middleware.ApiRequestLogMiddleware',  # API history / request logging
]

ROOT_URLCONF = 'fastpay_be.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'api' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'fastpay_be.wsgi.application'

# Database
# Support both SQLite (default) and PostgreSQL (production)
if os.environ.get('DB_ENGINE') == 'django.db.backends.postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'fastpay_db'),
            'USER': os.environ.get('DB_USER', 'fastpay_user'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    # Default to SQLite for development
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Media files (user uploads)
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Storage directory for file system operations
STORAGE_ROOT = BASE_DIR / 'storage'
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

# Webhook configuration
# If set, incoming webhooks must include X-Webhook-Secret header
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Change to IsAuthenticated for production
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    # Disable CSRF for API endpoints (use token/auth instead)
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'EXCEPTION_HANDLER': 'api.exceptions.custom_exception_handler',
}

# CORS settings (production)
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'False') == 'True'
CORS_ALLOW_CREDENTIALS = True

# If not allowing all origins, specify allowed origins
if not CORS_ALLOW_ALL_ORIGINS:
    env_origins = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
    default_origins = [
        'https://fastpaygaming.com',
        'https://www.fastpaygaming.com',
        'https://api.fastpaygaming.com',
        'https://owner.fastpaygaming.com',
        'https://staging.fastpaygaming.com',
        'https://sapi.fastpaygaming.com',
        'https://sadmin.fastpaygaming.com',
        'https://sredpay.fastpaygaming.com',
    ]
    CORS_ALLOWED_ORIGINS = env_origins if env_origins else default_origins

# CSRF trusted origins (fallback for production and staging domains)
if not CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = [
        'https://fastpaygaming.com',
        'https://www.fastpaygaming.com',
        'https://api.fastpaygaming.com',
        'https://owner.fastpaygaming.com',
        'https://staging.fastpaygaming.com',
        'https://sapi.fastpaygaming.com',
        'https://sadmin.fastpaygaming.com',
        'https://sredpay.fastpaygaming.com',
    ]

# Email Configuration
# Supports SMTP (production) and console backend (development)
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend'
)

# SMTP Settings (for production)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

# Default from email
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@fastpay.com')
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# Site URL for email links
SITE_URL = os.environ.get('SITE_URL', 'http://localhost:8000' if DEBUG else 'https://fastpay.com')

# Telegram webhook: optional secret token. If set, incoming webhook POSTs must send
# the same value in X-Telegram-Bot-Api-Secret-Token (set in setWebhook).
TELEGRAM_WEBHOOK_SECRET = os.environ.get('TELEGRAM_WEBHOOK_SECRET', '')
# Base URL for the API (used by register_telegram_webhook command). Staging: https://sapi.<domain>; production: https://api.<domain>.
TELEGRAM_WEBHOOK_BASE_URL = os.environ.get('TELEGRAM_WEBHOOK_BASE_URL', SITE_URL.rstrip('/'))

# =============================================================================
# Celery Configuration
# =============================================================================
CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'default'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max per task
CELERY_RESULT_EXPIRES = 60 * 60 * 24 * 7  # 7 days
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Task-specific settings
CELERY_TASK_ROUTES = {
    'api.tasks.send_telegram_*': {'queue': 'telegram'},
    'api.tasks.sync_*': {'queue': 'sync'},
    'api.tasks.cleanup_*': {'queue': 'maintenance'},
}

# Task retry settings
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

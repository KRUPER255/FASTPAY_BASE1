import logging
from django.apps import AppConfig


logger = logging.getLogger(__name__)


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        from django.conf import settings
        if not getattr(settings, 'DEBUG', True):
            try:
                from api.startup_checks import validate_env
                errors = validate_env('production')
                if errors:
                    for msg in errors:
                        logger.warning("Startup env check: %s", msg)
            except Exception as e:
                logger.warning("Startup env check failed: %s", e)

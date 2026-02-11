"""
Validate required environment variables.
Usage: python manage.py validate_env [--context=production]
Exit 0 if valid, 1 and stderr messages if invalid.
"""
import sys
from django.core.management.base import BaseCommand
from api.startup_checks import validate_env as do_validate


class Command(BaseCommand):
    help = "Validate required environment variables for the given context (production|staging|development)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--context",
            type=str,
            default="production",
            choices=["production", "staging", "development"],
            help="Context for validation (default: production).",
        )

    def handle(self, *args, **options):
        context = options["context"]
        errors = do_validate(context)
        if not errors:
            self.stdout.write(self.style.SUCCESS("Environment validation passed."))
            return
        for msg in errors:
            self.stderr.write(self.style.ERROR(msg))
        sys.exit(1)

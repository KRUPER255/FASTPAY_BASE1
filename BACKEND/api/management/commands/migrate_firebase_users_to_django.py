"""
Migrate dashboard users from Firebase Realtime Database to Django DashUser.

Reads users/ in Firebase. Each key is email with dots replaced by 'dot'
(e.g. admin'dot'fastpay'dot'com). Creates or updates DashUser for each.

Expected Firebase user node shape (any can be missing; defaults applied):
- password (str)
- access or access_level (0, 1, or 2)
- full_name (str)
- theme or theme_mode ('white' or 'dark')
- status ('active', 'inactive', 'suspended')

Usage:
    python manage.py migrate_firebase_users_to_django
    python manage.py migrate_firebase_users_to_django --dry-run
"""
import logging
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, db
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


def firebase_email_key_to_email(key: str) -> str:
    """Convert Firebase user key to email (e.g. admin'dot'fastpay'dot'com -> admin@fastpay.com)."""
    return key.replace("'dot'", ".")


class Command(BaseCommand):
    help = "Migrate Firebase users/ to Django DashUser (create or update by email)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without creating/updating users",
        )

    def handle(self, *args, **options):
        if not FIREBASE_AVAILABLE:
            raise CommandError("Firebase Admin SDK not installed. pip install firebase-admin")

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - no changes will be made\n"))

        self._initialize_firebase()

        from api.models import DashUser

        ref = db.reference("users")
        data = ref.get()
        if not data or not isinstance(data, dict):
            self.stdout.write(self.style.WARNING("No data under Firebase path 'users/'"))
            return

        # Skip nested 'device' children; we only want top-level user keys (email paths)
        user_keys = [k for k in data.keys() if isinstance(data.get(k), (dict, str, type(None))) and k != "device"]
        # If structure is users/{emailPath}/device/..., then data[k] might be full user node
        # So each key in data is emailPath, value can be dict with password, access, device, etc.
        created = 0
        updated = 0
        skipped = 0
        errors = []

        for email_path in user_keys:
            node = data[email_path]
            if not isinstance(node, dict):
                # Could be a scalar; skip or treat as no profile
                node = {}
            # Skip if this key is only 'device' (assignments handled by other command)
            if set(node.keys()) == {"device"} or (len(node) == 1 and "device" in node):
                skipped += 1
                continue

            email = firebase_email_key_to_email(email_path)
            if "@" not in email or "." not in email:
                errors.append(f"Invalid email from key '{email_path}' -> '{email}'")
                continue

            access = node.get("access") if node.get("access") is not None else node.get("access_level")
            if access is not None:
                try:
                    access = int(access)
                except (TypeError, ValueError):
                    access = 1
            else:
                access = 1
            if access not in (0, 1, 2):
                access = 1

            status = (node.get("status") or "active").strip().lower()
            if status not in ("active", "inactive", "suspended"):
                status = "active"

            theme = (node.get("theme") or node.get("theme_mode") or "white").strip().lower()
            if theme not in ("white", "dark"):
                theme = "white"

            full_name = (node.get("full_name") or "").strip() or None
            raw_password = (node.get("password") or "").strip()

            if dry_run:
                try:
                    exists = DashUser.objects.filter(email=email).exists()
                    if exists:
                        self.stdout.write(f"  Would update: {email} (access={access}, status={status})")
                        updated += 1
                    else:
                        self.stdout.write(f"  Would create: {email} (access={access}, password={'***' if raw_password else '(empty)'})")
                        created += 1
                except Exception as e:
                    errors.append(f"{email}: {e}")
                continue

            try:
                with transaction.atomic():
                    user, was_created = DashUser.objects.get_or_create(
                        email=email,
                        defaults={
                            "password": "",  # set below if provided
                            "access_level": access,
                            "status": status,
                            "theme_mode": theme,
                            "full_name": full_name,
                        },
                    )
                    if was_created:
                        if raw_password:
                            user.set_password(raw_password)
                        else:
                            user.set_password(email[:8] + "!")  # placeholder if no password in Firebase
                        user.save(update_fields=["password"])
                        created += 1
                        self.stdout.write(self.style.SUCCESS(f"  Created: {email}"))
                    else:
                        updated_any = False
                        if user.access_level != access:
                            user.access_level = access
                            updated_any = True
                        if user.status != status:
                            user.status = status
                            updated_any = True
                        if user.theme_mode != theme:
                            user.theme_mode = theme
                            updated_any = True
                        if full_name is not None and user.full_name != full_name:
                            user.full_name = full_name
                            updated_any = True
                        if raw_password:
                            user.set_password(raw_password)
                            updated_any = True
                        if updated_any:
                            user.save()
                            updated += 1
                            self.stdout.write(f"  Updated: {email}")
                        else:
                            skipped += 1
            except Exception as e:
                errors.append(f"{email}: {e}")
                logger.exception("Migrate user %s", email)

        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("Summary:"))
        self.stdout.write(f"  Created: {created}, Updated: {updated}, Skipped: {skipped}")
        if errors:
            self.stdout.write(self.style.ERROR(f"  Errors: {len(errors)}"))
            for err in errors[:10]:
                self.stdout.write(self.style.ERROR(f"    {err}"))
            if len(errors) > 10:
                self.stdout.write(self.style.ERROR(f"    ... and {len(errors) - 10} more"))
        if dry_run:
            self.stdout.write(self.style.WARNING("\nDRY RUN - no changes were made"))

    def _initialize_firebase(self) -> None:
        try:
            firebase_admin.get_app()
            return
        except ValueError:
            pass
        url = os.environ.get("FIREBASE_DATABASE_URL")
        if not url:
            raise CommandError("FIREBASE_DATABASE_URL environment variable is required")
        import json
        cred = None
        json_str = os.environ.get("FIREBASE_CREDENTIALS_JSON")
        if json_str:
            try:
                cred = credentials.Certificate(json.loads(json_str))
            except Exception as e:
                raise CommandError(f"Invalid FIREBASE_CREDENTIALS_JSON: {e}") from e
        path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
        if cred is None and path and os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
            except PermissionError:
                with open(path) as f:
                    cred = credentials.Certificate(json.load(f))
        if cred is not None:
            firebase_admin.initialize_app(cred, {"databaseURL": url})
        else:
            try:
                firebase_admin.initialize_app(options={"databaseURL": url})
            except Exception as e:
                raise CommandError(f"Firebase init failed: {e}") from e

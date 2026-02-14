"""
Migrate user–device assignments from Firebase to Django Device.assigned_to.

Reads users/{emailPath}/device in Firebase. For each user and each device ID
under that path, adds the corresponding DashUser to Device.assigned_to.

Email path uses 'dot' for dots (e.g. admin'dot'fastpay'dot'com).
DashUser must already exist for each email (create with migrate_firebase_users_to_django first, or in Django admin).

Usage:
    python manage.py migrate_firebase_user_devices_to_django
    python manage.py migrate_firebase_user_devices_to_django --dry-run
    python manage.py migrate_firebase_user_devices_to_django --create-users  # create DashUser if missing
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
    help = "Migrate Firebase users/{email}/device to Django Device.assigned_to"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without changing assignments",
        )
        parser.add_argument(
            "--create-users",
            action="store_true",
            help="Create DashUser for email if not found (minimal: email + default password)",
        )

    def handle(self, *args, **options):
        if not FIREBASE_AVAILABLE:
            raise CommandError("Firebase Admin SDK not installed. pip install firebase-admin")

        dry_run = options["dry_run"]
        create_users = options["create_users"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - no changes will be made\n"))

        self._initialize_firebase()

        from api.models import DashUser, Device

        ref = db.reference("users")
        data = ref.get()
        if not data or not isinstance(data, dict):
            self.stdout.write(self.style.WARNING("No data under Firebase path 'users/'"))
            return

        assignments_added = 0
        users_created = 0
        skipped_no_user = 0
        skipped_no_device = 0
        errors = []

        for email_path in data.keys():
            if email_path == "device":
                continue
            user_node = data[email_path]
            if not isinstance(user_node, dict):
                continue
            device_node = user_node.get("device")
            if not device_node or not isinstance(device_node, dict):
                continue

            email = firebase_email_key_to_email(email_path)
            if "@" not in email or "." not in email:
                errors.append(f"Invalid email from key '{email_path}'")
                continue

            try:
                user = DashUser.objects.get(email=email)
            except DashUser.DoesNotExist:
                if create_users and not dry_run:
                    with transaction.atomic():
                        user = DashUser.objects.create(
                            email=email,
                            password="",  # must reset or set later
                        )
                        user.set_password(email[:8] + "!")
                        user.save(update_fields=["password"])
                    users_created += 1
                    self.stdout.write(f"  Created user: {email}")
                else:
                    skipped_no_user += 1
                    if not dry_run:
                        logger.debug("Skip assignments for %s: DashUser not found", email)
                    continue

            for device_id in device_node.keys():
                try:
                    device = Device.objects.get(device_id=device_id)
                except Device.DoesNotExist:
                    skipped_no_device += 1
                    continue
                except Exception as e:
                    errors.append(f"{email} / {device_id}: {e}")
                    logger.exception("Assign %s -> %s", email, device_id)
                    continue

                if dry_run:
                    if not device.assigned_to.filter(email=email).exists():
                        self.stdout.write(f"  Would assign: {email} -> {device_id}")
                        assignments_added += 1
                    continue

                try:
                    if not device.assigned_to.filter(pk=user.pk).exists():
                        with transaction.atomic():
                            device.assigned_to.add(user)
                        assignments_added += 1
                        self.stdout.write(f"  Assigned: {email} -> {device_id}")
                except Exception as e:
                    errors.append(f"{email} / {device_id}: {e}")
                    logger.exception("Assign %s -> %s", email, device_id)

        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("Summary:"))
        self.stdout.write(f"  Assignments added: {assignments_added}")
        if create_users:
            self.stdout.write(f"  Users created: {users_created}")
        self.stdout.write(f"  Skipped (no DashUser): {skipped_no_user}")
        self.stdout.write(f"  Skipped (no Device): {skipped_no_device}")
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

"""
Environment variable validation for FastPay Backend.
Used at startup (optional log) and by manage.py validate_env + CI.
"""
import os


def get_required_env_for_context(context: str):
    """
    Return list of (var_name, required, validator_callable or None).
    context: "production" | "staging" | "development"
    """
    base = [
        ("SECRET_KEY", True, None),
        ("ALLOWED_HOSTS", context != "development", None),
    ]
    db_engine = os.environ.get("DB_ENGINE", "")
    if "postgresql" in db_engine:
        base.extend([
            ("DB_NAME", True, None),
            ("DB_USER", True, None),
            ("DB_PASSWORD", True, None),
            ("DB_HOST", True, None),
            ("DB_PORT", True, None),
        ])
    # Firebase used by sync and health
    base.append(("FIREBASE_DATABASE_URL", context != "development", None))
    # Celery/Redis
    base.append(("CELERY_BROKER_URL", False, None))  # optional; REDIS_URL often set instead
    return base


def validate_env(context: str = "production") -> list:
    """
    Validate required environment variables for the given context.
    Returns list of error messages (empty if valid).
    """
    errors = []
    for var_name, required, validator in get_required_env_for_context(context):
        if not required:
            continue
        value = os.environ.get(var_name, "").strip()
        if not value:
            errors.append(f"Missing required env: {var_name}")
            continue
        if validator and not validator(value):
            errors.append(f"Invalid value for env: {var_name}")
    return errors

"""
API health check endpoint.
GET /api/health/ -> {"status": "ok"}
GET /api/health/?detailed=1 -> {"status": "ok", "database": {...}, "firebase": {...}, "redis": {...}}
Reuses logic from api.tasks.health_check_task (DB, Firebase). Redis optional if no cache configured.
"""
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET


def _check_database():
    """Same pattern as health_check_task: SELECT 1."""
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return {"status": "healthy"}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)[:200]}


def _check_firebase():
    """Same pattern as health_check_task: check if initialized, do not init on every request."""
    try:
        import firebase_admin
        if getattr(firebase_admin, "_apps", None):
            return {"status": "healthy"}
        return {"status": "not_initialized"}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)[:200]}


def _check_redis():
    """If Django cache backend is Redis, ping it. Otherwise not_configured."""
    try:
        from django.core.cache import cache
        # Only report healthy if we can set/get (works for Redis and LocMem)
        cache.set("health_ping", 1, 5)
        if cache.get("health_ping") == 1:
            return {"status": "healthy"}
        return {"status": "unhealthy", "error": "cache get/set failed"}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)[:200]}


@require_GET
@csrf_exempt
def api_health(request):
    """
    Health check for load balancers and scripts.
    - No query: 200 + {"status": "ok"}
    - ?detailed=1: 200 + database, firebase, redis (always 200 so LB does not kill the process).
    """
    detailed = request.GET.get("detailed", "").lower() in ("1", "true", "yes")
    if not detailed:
        return JsonResponse({"status": "ok"})

    database = _check_database()
    firebase = _check_firebase()
    # Redis: try cache (may be LocMem in dev); if no CACHES configured Django uses default LocMem
    redis = _check_redis()

    payload = {
        "status": "ok",
        "database": database,
        "firebase": firebase,
        "redis": redis,
    }
    # Optional: overall degraded if any critical component unhealthy
    unhealthy = [name for name, comp in [("database", database), ("firebase", firebase), ("redis", redis)] if comp.get("status") == "unhealthy"]
    if unhealthy:
        payload["overall"] = "degraded"
    return JsonResponse(payload)

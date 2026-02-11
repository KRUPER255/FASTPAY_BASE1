"""
URL configuration for fastpay_be project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from api.views import root
from api.views.core import health

urlpatterns = [
    path('admin/', include("django_admin_kubi.urls")),
    path('admin/', admin.site.urls),
    path('health/', health, name='health'),  # Health check (no redirect; for Docker/load balancers)
    path('', root, name='root'),  # Root endpoint at /
    path('api/', include('api.urls')),  # API endpoints at /api/
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

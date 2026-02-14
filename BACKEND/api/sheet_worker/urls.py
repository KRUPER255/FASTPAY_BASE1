"""
URL routing for sheet worker API. Paths are under /api/sheet-worker/ (included from api/urls).
"""
from django.urls import path

from . import views

app_name = 'sheet_worker'

urlpatterns = [
    path('processes/', views.sheet_worker_process_list, name='sheet-worker-process-list'),
    path('run/', views.sheet_worker_run, name='sheet-worker-run'),
]

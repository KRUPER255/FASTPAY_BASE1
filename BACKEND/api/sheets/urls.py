"""
URL routing for Google Sheets API. All paths are under /api/sheets/ (included from api/urls).
"""
from django.urls import path
from . import views

app_name = 'sheets'

urlpatterns = [
    path('spreadsheets/', views.sheets_list_or_create, name='sheets-list-or-create'),
    path('spreadsheets/<str:spreadsheet_id>/', views.sheets_spreadsheet_metadata, name='sheets-metadata'),
    path('spreadsheets/<str:spreadsheet_id>/values/', views.sheets_read_values, name='sheets-read-values'),
    path('spreadsheets/<str:spreadsheet_id>/values/update/', views.sheets_update_values, name='sheets-update-values'),
    path('spreadsheets/<str:spreadsheet_id>/values/append/', views.sheets_append_values, name='sheets-append-values'),
]

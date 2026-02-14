"""
Request/response serializers for Google Sheets API endpoints.
"""
from rest_framework import serializers


class CreateSpreadsheetSerializer(serializers.Serializer):
    """Request body for creating a spreadsheet."""
    title = serializers.CharField(max_length=255, help_text='Spreadsheet title')
    sheets = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        help_text='Optional list of sheet definitions, e.g. [{"properties": {"title": "Sheet1"}}]',
    )


class UpdateValuesSerializer(serializers.Serializer):
    """Request body for updating a range."""
    values = serializers.ListField(
        child=serializers.ListField(child=serializers.JSONField()),
        help_text='2D array of values, e.g. [["A1", "B1"], ["A2", "B2"]]',
    )


class AppendValuesSerializer(serializers.Serializer):
    """Request body for appending rows."""
    values = serializers.ListField(
        child=serializers.ListField(child=serializers.JSONField()),
        help_text='2D array of rows to append, e.g. [["a", "b"], ["c", "d"]]',
    )

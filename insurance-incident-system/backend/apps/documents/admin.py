from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['id', 'ticket', 'file_type', 'original_filename', 'file_size', 'uploaded_at']
    list_filter = ['file_type', 'uploaded_at']
    search_fields = ['ticket__ticket_id', 'original_filename']
    readonly_fields = ['uploaded_at']

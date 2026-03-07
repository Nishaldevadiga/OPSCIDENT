from django.contrib import admin
from .models import EmailNotification


@admin.register(EmailNotification)
class EmailNotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'ticket', 'notification_type', 'status', 'sent_at', 'created_at']
    list_filter = ['notification_type', 'status', 'created_at']
    search_fields = ['user__email', 'ticket__ticket_id', 'subject']
    readonly_fields = ['created_at', 'sent_at']

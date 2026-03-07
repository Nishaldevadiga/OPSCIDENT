from django.contrib import admin
from .models import Ticket, TicketNote, StatusHistory


class TicketNoteInline(admin.TabularInline):
    model = TicketNote
    extra = 0
    readonly_fields = ['created_at']


class StatusHistoryInline(admin.TabularInline):
    model = StatusHistory
    extra = 0
    readonly_fields = ['changed_at']


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_id', 'title', 'customer', 'status', 'incident_type', 'claim_amount', 'created_at']
    list_filter = ['status', 'incident_type', 'created_at']
    search_fields = ['ticket_id', 'title', 'description', 'customer__email']
    readonly_fields = ['ticket_id', 'created_at', 'updated_at']
    inlines = [TicketNoteInline, StatusHistoryInline]


@admin.register(TicketNote)
class TicketNoteAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'author', 'is_internal', 'created_at']
    list_filter = ['is_internal', 'created_at']


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'old_status', 'new_status', 'changed_by', 'changed_at']
    list_filter = ['new_status', 'changed_at']

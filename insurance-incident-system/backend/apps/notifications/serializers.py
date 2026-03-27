from rest_framework import serializers
from .models import InAppNotification


class InAppNotificationSerializer(serializers.ModelSerializer):
    ticket_id = serializers.CharField(source='ticket.ticket_id', read_only=True, default=None)

    class Meta:
        model = InAppNotification
        fields = ['id', 'ticket', 'ticket_id', 'title', 'message', 'notification_type', 'is_read', 'created_at']
        read_only_fields = fields

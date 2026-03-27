from django.db import models
from django.conf import settings
from apps.tickets.models import Ticket


class EmailNotification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('ticket_submitted', 'Ticket Submitted'),
        ('status_changed', 'Status Changed'),
        ('info_requested', 'Information Requested'),
        ('ticket_approved', 'Ticket Approved'),
        ('ticket_rejected', 'Ticket Rejected'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_notifications'
    )
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='email_notifications',
        null=True,
        blank=True
    )
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.notification_type} to {self.user.email}"


class InAppNotification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('claim_submitted', 'Claim Submitted'),
        ('claim_approved', 'Claim Approved'),
        ('claim_rejected', 'Claim Rejected'),
        ('info_requested', 'Information Requested'),
        ('appeal_received', 'Appeal Received'),
        ('appeal_decided', 'Appeal Decided'),
        ('status_changed', 'Status Changed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='in_app_notifications'
    )
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='in_app_notifications',
        null=True,
        blank=True
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.notification_type} for {self.user.email}"

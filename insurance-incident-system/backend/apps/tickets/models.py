import uuid
from django.db import models
from django.conf import settings


class Ticket(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('processing', 'Processing'),
        ('pending_info', 'Pending Information'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('appealed', 'Appealed'),
    ]

    INCIDENT_TYPE_CHOICES = [
        ('vehicle_collision', 'Vehicle Collision'),
        ('vehicle_theft', 'Vehicle Theft'),
        ('property_damage', 'Property Damage'),
        ('natural_disaster', 'Natural Disaster'),
        ('personal_injury', 'Personal Injury'),
        ('other', 'Other'),
    ]

    ticket_id = models.CharField(max_length=20, unique=True, editable=False)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tickets'
    )
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    incident_type = models.CharField(max_length=30, choices=INCIDENT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    incident_date = models.DateField()
    incident_location = models.CharField(max_length=300, blank=True)
    claim_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket_id} - {self.title}"

    def save(self, *args, **kwargs):
        if not self.ticket_id:
            self.ticket_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class TicketNote(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ticket_notes'
    )
    content = models.TextField()
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note on {self.ticket.ticket_id} by {self.author}"


class StatusHistory(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='status_changes'
    )
    reason = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']
        verbose_name_plural = 'Status histories'

    def __str__(self):
        return f"{self.ticket.ticket_id}: {self.old_status} -> {self.new_status}"

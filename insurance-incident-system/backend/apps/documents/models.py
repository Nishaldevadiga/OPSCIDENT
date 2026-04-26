import uuid
from django.db import models
from apps.tickets.models import Ticket


def document_upload_path(instance, filename):
    ext = filename.split('.')[-1]
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    return f"tickets/{instance.ticket.ticket_id}/{unique_name}"


class Document(models.Model):
    FILE_TYPE_CHOICES = [
        ('pdf', 'PDF'),
        ('image', 'Image'),
        ('video', 'Video'),
    ]

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='documents')
    file = models.FileField(upload_to=document_upload_path)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_filename} ({self.ticket.ticket_id})"

    @property
    def s3_key(self):
        return self.file.name if self.file else None

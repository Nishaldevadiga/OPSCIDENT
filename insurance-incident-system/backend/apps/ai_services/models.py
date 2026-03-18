from django.db import models
from apps.tickets.models import Ticket


class AIAnalysis(models.Model):
    RECOMMENDATION_CHOICES = [
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('review', 'Manual Review Required'),
        ('need_info', 'Additional Information Required'),
    ]

    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name='ai_analysis'
    )
    extracted_data = models.JSONField(default=dict)
    damage_score = models.FloatField(null=True, blank=True)
    fraud_indicators = models.JSONField(default=list)
    recommendation = models.CharField(
        max_length=20,
        choices=RECOMMENDATION_CHOICES,
        default='review'
    )
    confidence_score = models.FloatField(default=0.0)
    analysis_summary = models.TextField(blank=True)
    claim_amount_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    claim_amount_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    pdf_analysis_complete = models.BooleanField(default=False)
    image_analysis_complete = models.BooleanField(default=False)
    analyzed_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'AI Analysis'
        verbose_name_plural = 'AI Analyses'

    def __str__(self):
        return f"Analysis for {self.ticket.ticket_id}"

    @property
    def is_complete(self):
        return self.pdf_analysis_complete and self.image_analysis_complete

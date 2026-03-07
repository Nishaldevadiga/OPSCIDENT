from django.contrib import admin
from .models import AIAnalysis


@admin.register(AIAnalysis)
class AIAnalysisAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'recommendation', 'damage_score', 'confidence_score', 'is_complete', 'analyzed_at']
    list_filter = ['recommendation', 'pdf_analysis_complete', 'image_analysis_complete']
    search_fields = ['ticket__ticket_id']
    readonly_fields = ['created_at', 'analyzed_at']

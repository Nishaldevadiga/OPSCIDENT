from rest_framework import serializers
from .models import Ticket, TicketNote, StatusHistory
from apps.documents.models import Document
from apps.ai_services.models import AIAnalysis
from apps.accounts.serializers import UserSerializer


class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)

    class Meta:
        model = StatusHistory
        fields = ['id', 'old_status', 'new_status', 'changed_by', 'changed_by_name', 'reason', 'changed_at']
        read_only_fields = ['id', 'changed_at']


class TicketNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)

    class Meta:
        model = TicketNote
        fields = ['id', 'ticket', 'author', 'author_name', 'content', 'is_internal', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ['id', 'ticket', 'file', 'file_type', 'original_filename', 'file_size', 'file_url', 'uploaded_at']
        read_only_fields = ['id', 'file_type', 'file_size', 'uploaded_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class AIAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAnalysis
        fields = [
            'id', 'extracted_data', 'damage_score', 'fraud_indicators',
            'recommendation', 'confidence_score', 'analysis_summary',
            'claim_amount_min', 'claim_amount_max',
            'pdf_analysis_complete', 'image_analysis_complete', 'is_complete', 'analyzed_at'
        ]
        read_only_fields = fields


class TicketListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    documents_count = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'customer', 'customer_name', 'status',
            'incident_type', 'title', 'incident_date', 'claim_amount',
            'documents_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ticket_id', 'customer', 'created_at', 'updated_at']

    def get_documents_count(self, obj):
        return obj.documents.count()


class TicketDetailSerializer(serializers.ModelSerializer):
    customer = UserSerializer(read_only=True)
    assigned_agent = UserSerializer(read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    notes = serializers.SerializerMethodField()
    status_history = StatusHistorySerializer(many=True, read_only=True)
    ai_analysis = AIAnalysisSerializer(read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'customer', 'assigned_agent', 'status',
            'incident_type', 'title', 'description', 'incident_date',
            'incident_location', 'claim_amount', 'approved_amount', 'documents', 'notes',
            'status_history', 'ai_analysis', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ticket_id', 'customer', 'created_at', 'updated_at']

    def get_notes(self, obj):
        request = self.context.get('request')
        notes = obj.notes.all()
        if request and request.user.role == 'customer':
            notes = notes.filter(is_internal=False)
        return TicketNoteSerializer(notes, many=True).data


class TicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'incident_type', 'title', 'description', 'incident_date',
            'incident_location', 'claim_amount'
        ]
        read_only_fields = ['id', 'ticket_id']

    def create(self, validated_data):
        validated_data['customer'] = self.context['request'].user
        return super().create(validated_data)


class TicketStatusUpdateSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
    approved_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)


class TicketInfoRequestSerializer(serializers.Serializer):
    message = serializers.CharField()


class CustomerResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class AppealSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=20, max_length=2000)

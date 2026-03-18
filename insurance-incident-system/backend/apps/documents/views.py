import logging

from rest_framework import viewsets, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Document
from .serializers import DocumentUploadSerializer, DocumentListSerializer
from apps.tickets.models import Ticket
from apps.accounts.permissions import IsOwnerOrAgent

logger = logging.getLogger(__name__)


class ExtractFieldsView(generics.GenericAPIView):
    """Accept a file upload, run OCR/LLM, return pre-fillable claim fields."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        allowed = {'application/pdf', 'image/jpeg', 'image/png', 'image/webp'}
        if file.content_type not in allowed:
            return Response({'error': f'Unsupported file type: {file.content_type}'}, status=status.HTTP_400_BAD_REQUEST)

        file_content = file.read()

        from apps.ai_services.services import AIAnalysisService
        try:
            result = AIAnalysisService().extract_claim_fields(file_content, file.content_type)
            return Response(result)
        except Exception as e:
            logger.error(f"extract_claim_fields error: {e}")
            return Response({'error': 'Extraction failed', 'confidence': 0}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrAgent]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'agent':
            return Document.objects.all()
        return Document.objects.filter(ticket__customer=user)

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return DocumentUploadSerializer
        return DocumentListSerializer

    def create(self, request, *args, **kwargs):
        ticket_id = request.data.get('ticket')

        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response(
                {"error": "Ticket not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.user.role == 'customer' and ticket.customer != request.user:
            return Response(
                {"error": "You do not have permission to upload to this ticket"},
                status=status.HTTP_403_FORBIDDEN
            )

        if ticket.status in ['approved', 'rejected']:
            return Response(
                {"error": "Cannot upload documents to a closed ticket"},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()

        from apps.ai_services.tasks import process_document
        try:
            process_document.delay(document.id)
        except Exception as e:
            logger.error(f"Failed to queue AI processing for document {document.id}: {e}")

        return Response(
            DocumentListSerializer(document, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class TicketDocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        ticket_id = self.kwargs.get('ticket_pk')
        user = self.request.user

        if user.role == 'agent':
            return Document.objects.filter(ticket_id=ticket_id)
        return Document.objects.filter(ticket_id=ticket_id, ticket__customer=user)

    def get_serializer_class(self):
        if self.action == 'create':
            return DocumentUploadSerializer
        return DocumentListSerializer

    def create(self, request, *args, **kwargs):
        ticket_id = self.kwargs.get('ticket_pk')

        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response(
                {"error": "Ticket not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.user.role == 'customer' and ticket.customer != request.user:
            return Response(
                {"error": "You do not have permission to upload to this ticket"},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        data['ticket'] = ticket_id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save()

        from apps.ai_services.tasks import process_document
        try:
            process_document.delay(document.id)
        except Exception as e:
            logger.error(f"Failed to queue AI processing for document {document.id}: {e}")

        return Response(
            DocumentListSerializer(document, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

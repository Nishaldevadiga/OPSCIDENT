from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Ticket, TicketNote, StatusHistory
from .serializers import (
    TicketListSerializer, TicketDetailSerializer, TicketCreateSerializer,
    TicketNoteSerializer, CustomerResponseSerializer
)
from apps.accounts.permissions import IsCustomer, IsOwnerOrAgent


class CustomerTicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCustomer]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'incident_type']
    search_fields = ['ticket_id', 'title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'incident_date']
    ordering = ['-created_at']

    def get_queryset(self):
        return Ticket.objects.filter(customer=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return TicketListSerializer
        if self.action == 'create':
            return TicketCreateSerializer
        return TicketDetailSerializer

    def perform_create(self, serializer):
        ticket = serializer.save()
        StatusHistory.objects.create(
            ticket=ticket,
            new_status='submitted',
            changed_by=self.request.user,
            reason='Ticket created'
        )
        from apps.notifications.services import NotificationService
        NotificationService.send_ticket_submitted_notification(ticket)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status != 'pending_info':
            return Response(
                {"error": "Ticket is not pending information"},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CustomerResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        TicketNote.objects.create(
            ticket=ticket,
            author=request.user,
            content=serializer.validated_data['message'],
            is_internal=False
        )

        old_status = ticket.status
        ticket.status = 'processing'
        ticket.save()

        StatusHistory.objects.create(
            ticket=ticket,
            old_status=old_status,
            new_status='processing',
            changed_by=request.user,
            reason='Customer responded to information request'
        )

        # Re-run AI decision on existing evidence after customer response
        from apps.ai_services.tasks import make_ai_decision
        make_ai_decision.delay(ticket.id)

        return Response({"message": "Response submitted successfully"})

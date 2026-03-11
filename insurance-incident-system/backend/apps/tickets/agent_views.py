from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Ticket, TicketNote, StatusHistory
from .serializers import (
    TicketListSerializer, TicketDetailSerializer, TicketNoteSerializer,
    TicketStatusUpdateSerializer, TicketInfoRequestSerializer
)
from apps.accounts.permissions import IsAgent
from apps.notifications.services import NotificationService


class AgentTicketViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Agent viewset - by default shows only tickets requiring attention.
    AI handles most decisions; agents only see escalated cases.
    """
    permission_classes = [IsAuthenticated, IsAgent]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'incident_type', 'assigned_agent']
    search_fields = ['ticket_id', 'title', 'description', 'customer__email']
    ordering_fields = ['created_at', 'updated_at', 'incident_date', 'claim_amount']
    ordering = ['-created_at']

    def get_queryset(self):
        """
        By default, show tickets needing attention (pending_info) and AI processed (approved, rejected).
        Use ?show_all=true to include in-progress tickets (submitted, processing).
        """
        queryset = Ticket.objects.all()
        show_all = self.request.query_params.get('show_all', 'false').lower() == 'true'
        
        if not show_all and self.action == 'list':
            # Show tickets needing review + AI processed; exclude in-progress
            queryset = queryset.filter(status__in=['pending_info', 'approved', 'rejected'])
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return TicketListSerializer
        return TicketDetailSerializer

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        ticket.assigned_agent = request.user
        ticket.save()
        return Response({"message": f"Ticket assigned to {request.user.full_name}"})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = ticket.status
        ticket.status = 'approved'
        ticket.assigned_agent = request.user
        ticket.save()

        StatusHistory.objects.create(
            ticket=ticket,
            old_status=old_status,
            new_status='approved',
            changed_by=request.user,
            reason=serializer.validated_data.get('reason', 'Claim approved by agent')
        )

        NotificationService.send_status_change_notification(ticket)

        return Response({"message": "Ticket approved successfully"})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        if not reason:
            return Response(
                {"error": "Rejection reason is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = ticket.status
        ticket.status = 'rejected'
        ticket.assigned_agent = request.user
        ticket.save()

        StatusHistory.objects.create(
            ticket=ticket,
            old_status=old_status,
            new_status='rejected',
            changed_by=request.user,
            reason=reason
        )

        NotificationService.send_status_change_notification(ticket)

        return Response({"message": "Ticket rejected"})

    @action(detail=True, methods=['post'], url_path='request-info')
    def request_info(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketInfoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = ticket.status
        ticket.status = 'pending_info'
        ticket.assigned_agent = request.user
        ticket.save()

        TicketNote.objects.create(
            ticket=ticket,
            author=request.user,
            content=serializer.validated_data['message'],
            is_internal=False
        )

        StatusHistory.objects.create(
            ticket=ticket,
            old_status=old_status,
            new_status='pending_info',
            changed_by=request.user,
            reason='Additional information requested'
        )

        NotificationService.send_info_request_notification(ticket, serializer.validated_data['message'])

        return Response({"message": "Information request sent to customer"})

    @action(detail=True, methods=['post'])
    def notes(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        note = TicketNote.objects.create(
            ticket=ticket,
            author=request.user,
            content=serializer.validated_data['content'],
            is_internal=serializer.validated_data.get('is_internal', True)
        )

        return Response(TicketNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.db.models import Count, Sum

        stats = {
            'total': Ticket.objects.count(),
            'by_status': dict(
                Ticket.objects.values('status').annotate(count=Count('id')).values_list('status', 'count')
            ),
            'needs_attention': Ticket.objects.filter(status='pending_info').count(),
            'ai_processing': Ticket.objects.filter(status__in=['submitted', 'processing']).count(),
            'auto_approved': Ticket.objects.filter(status='approved').count(),
            'auto_rejected': Ticket.objects.filter(status='rejected').count(),
            'total_claim_amount': Ticket.objects.filter(status='approved').aggregate(
                total=Sum('claim_amount')
            )['total'] or 0,
        }
        return Response(stats)

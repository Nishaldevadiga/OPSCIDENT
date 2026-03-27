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
            # Show tickets needing review + AI processed + appeals; exclude in-progress
            queryset = queryset.filter(status__in=['pending_info', 'approved', 'rejected', 'appealed'])
        
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

        approved_amount = serializer.validated_data.get('approved_amount')
        if approved_amount is not None:
            ticket.approved_amount = approved_amount

        ticket.save()

        reason = serializer.validated_data.get('reason', '') or 'Claim approved by agent'
        if approved_amount is not None:
            reason = f"{reason} — Approved payout: ${approved_amount:,.2f}".strip(' —')

        StatusHistory.objects.create(
            ticket=ticket,
            old_status=old_status,
            new_status='approved',
            changed_by=request.user,
            reason=reason
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
            'appeals_pending': Ticket.objects.filter(status='appealed').count(),
            'total_claim_amount': Ticket.objects.filter(status='approved').aggregate(
                total=Sum('claim_amount')
            )['total'] or 0,
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        from django.db.models import Count, Sum, Q
        from django.db.models.functions import TruncDay, TruncWeek
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()

        # --- Daily submissions: last 30 days ---
        thirty_days_ago = now - timedelta(days=29)
        daily_qs = (
            Ticket.objects
            .filter(created_at__gte=thirty_days_ago)
            .annotate(day=TruncDay('created_at'))
            .values('day')
            .annotate(
                total=Count('id'),
                approved=Count('id', filter=Q(status='approved')),
                rejected=Count('id', filter=Q(status='rejected')),
            )
            .order_by('day')
        )
        daily_map = {str(d['day'].date()): d for d in daily_qs}
        daily = []
        for i in range(29, -1, -1):
            day = (now - timedelta(days=i)).date()
            key = str(day)
            entry = daily_map.get(key, {})
            daily.append({
                'date': key,
                'total': entry.get('total', 0),
                'approved': entry.get('approved', 0),
                'rejected': entry.get('rejected', 0),
            })

        # --- Weekly approvals vs rejections + payout: last 12 weeks ---
        twelve_weeks_ago = now - timedelta(weeks=12)
        weekly_qs = (
            Ticket.objects
            .filter(created_at__gte=twelve_weeks_ago)
            .annotate(week=TruncWeek('created_at'))
            .values('week')
            .annotate(
                approved=Count('id', filter=Q(status='approved')),
                rejected=Count('id', filter=Q(status='rejected')),
                payout=Sum('approved_amount', filter=Q(status='approved')),
            )
            .order_by('week')
        )
        weekly = [
            {
                'week': str(w['week'].date()),
                'approved': w['approved'],
                'rejected': w['rejected'],
                'payout': float(w['payout'] or 0),
            }
            for w in weekly_qs
        ]

        # --- By incident type ---
        by_type = list(
            Ticket.objects
            .values('incident_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # --- Avg processing time (hours) for closed tickets ---
        closed = Ticket.objects.filter(status__in=['approved', 'rejected'])
        avg_hours = 0.0
        if closed.exists():
            durations = [
                (t.updated_at - t.created_at).total_seconds() / 3600
                for t in closed.only('created_at', 'updated_at')
            ]
            avg_hours = round(sum(durations) / len(durations), 1)

        # --- Overall KPIs ---
        total = Ticket.objects.count()
        total_decided = closed.count()
        total_approved = Ticket.objects.filter(status='approved').count()
        approval_rate = round(total_approved / total_decided * 100, 1) if total_decided else 0
        total_payout = float(
            Ticket.objects.filter(status='approved').aggregate(s=Sum('approved_amount'))['s'] or 0
        )

        return Response({
            'kpis': {
                'total_claims': total,
                'approval_rate': approval_rate,
                'avg_processing_hours': avg_hours,
                'total_payout': total_payout,
            },
            'daily': daily,
            'weekly': weekly,
            'by_incident_type': by_type,
        })

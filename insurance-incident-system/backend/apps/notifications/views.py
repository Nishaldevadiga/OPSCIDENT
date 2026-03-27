from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import InAppNotification
from .serializers import InAppNotificationSerializer


class InAppNotificationViewSet(viewsets.mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = InAppNotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # return full list; client handles display limit

    def get_queryset(self):
        qs = InAppNotification.objects.filter(user=self.request.user)
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            qs = qs.filter(is_read=is_read.lower() == 'true')
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()[:50]  # cap list response at 50
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = InAppNotification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        InAppNotification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})

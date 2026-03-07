from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .agent_views import AgentTicketViewSet

router = DefaultRouter()
router.register(r'tickets', AgentTicketViewSet, basename='agent-ticket')

urlpatterns = [
    path('', include(router.urls)),
]

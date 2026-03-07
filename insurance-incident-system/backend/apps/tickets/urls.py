from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerTicketViewSet

router = DefaultRouter()
router.register(r'', CustomerTicketViewSet, basename='ticket')

urlpatterns = [
    path('', include(router.urls)),
]

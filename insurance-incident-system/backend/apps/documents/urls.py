from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, ExtractFieldsView

router = DefaultRouter()
router.register(r'', DocumentViewSet, basename='document')

urlpatterns = [
    path('extract-fields/', ExtractFieldsView.as_view(), name='extract-fields'),
    path('', include(router.urls)),
]

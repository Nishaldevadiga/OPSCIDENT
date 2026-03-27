from django.urls import path
from .views import TranscribeVoiceView

urlpatterns = [
    path('transcribe/', TranscribeVoiceView.as_view(), name='transcribe-voice'),
]

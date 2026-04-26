from django.urls import path
from .views import TranscribeVoiceView, ChatView

urlpatterns = [
    path('transcribe/', TranscribeVoiceView.as_view(), name='transcribe-voice'),
    path('chat/', ChatView.as_view(), name='ai-chat'),
]

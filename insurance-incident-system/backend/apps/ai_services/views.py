import json
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

logger = logging.getLogger(__name__)

FIELD_EXTRACTION_PROMPT = """You are an insurance claims assistant. A customer has just spoken to describe their incident.
Analyze this voice transcript and extract claim fields.
Return ONLY valid JSON with exactly these keys:
{
  "incident_type": one of ["vehicle_collision","vehicle_theft","property_damage","natural_disaster","personal_injury","other"] or "",
  "title": "short claim title (max 80 chars)" or "",
  "description": "detailed description of the incident" or "",
  "incident_date": "YYYY-MM-DD format" or "",
  "incident_location": "address or location" or "",
  "claim_amount": numeric value as number or null,
  "confidence": 0.0-1.0 how confident you are in these extractions,
  "notes": "anything important not captured above" or ""
}
Only populate fields you are confident about. Leave as empty string or null if not found.
For incident_date: today is 2026-03-27. Resolve relative dates like "yesterday", "last Tuesday", etc."""


class TranscribeVoiceView(APIView):
    """
    Accept a voice recording, transcribe it via Groq Whisper,
    then extract insurance claim fields from the transcript.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)

        audio_bytes = audio_file.read()
        if len(audio_bytes) < 1000:
            return Response({'error': 'Audio file is too short or empty'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from groq import Groq
            from django.conf import settings

            client = Groq(api_key=settings.GROQ_API_KEY)

            # Detect MIME type and pick correct file extension for Groq
            content_type = audio_file.content_type or ''
            if 'mp4' in content_type or 'm4a' in content_type:
                filename = 'recording.mp4'
            elif 'ogg' in content_type:
                filename = 'recording.ogg'
            elif 'wav' in content_type:
                filename = 'recording.wav'
            else:
                filename = 'recording.webm'

            # Step 1: Transcribe audio with Whisper
            transcription = client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3-turbo",
                response_format="text",
                language="en",
            )

            transcript_text = transcription if isinstance(transcription, str) else str(transcription)
            transcript_text = transcript_text.strip()

            if not transcript_text:
                return Response({
                    'transcript': '',
                    'confidence': 0,
                    'error': 'No speech detected in the recording.',
                })

            logger.info(f"Transcribed voice claim: {transcript_text[:120]}...")

            # Step 2: Extract claim fields from transcript using LLM
            from apps.ai_services.services import GroqClient
            groq_client = GroqClient()
            extracted = groq_client.analyze_text(transcript_text, FIELD_EXTRACTION_PROMPT)

            if not extracted:
                extracted = {'confidence': 0}

            # Normalize claim_amount
            amount = extracted.get('claim_amount')
            if amount is not None:
                try:
                    extracted['claim_amount'] = float(amount)
                except (ValueError, TypeError):
                    extracted['claim_amount'] = None

            return Response({
                'transcript': transcript_text,
                **extracted,
            })

        except Exception as e:
            logger.error(f"Voice transcription failed: {e}")
            return Response(
                {'error': str(e), 'confidence': 0},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

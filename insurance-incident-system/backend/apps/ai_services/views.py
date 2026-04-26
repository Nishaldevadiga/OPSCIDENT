import json
import logging
from datetime import date

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


class ChatView(APIView):
    """
    Customer-facing AI chatbot. Loads the customer's tickets and injects
    them as context into the LLM so answers are personalised and accurate.

    POST body: { message: str, history: [{role, content}, ...] }
    Response:  { reply: str }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role != 'customer':
            return Response({'error': 'Chat is only available to customers'}, status=status.HTTP_403_FORBIDDEN)

        # Validate and sanitise history (last 8 turns to stay within token budget)
        raw_history = request.data.get('history', [])
        history = [
            {'role': h['role'], 'content': h['content']}
            for h in raw_history
            if isinstance(h, dict)
            and h.get('role') in ('user', 'assistant')
            and isinstance(h.get('content'), str)
            and h['content'].strip()
        ][-8:]

        # Load customer's tickets with related data
        from apps.tickets.models import Ticket
        tickets = (
            Ticket.objects
            .filter(customer=request.user)
            .select_related('ai_analysis')
            .prefetch_related('notes', 'status_history')
            .order_by('-created_at')[:10]
        )

        system_prompt = self._build_system_prompt(request.user, tickets)

        messages = [{'role': 'system', 'content': system_prompt}]
        messages.extend(history)
        messages.append({'role': 'user', 'content': message})

        try:
            from groq import Groq
            from django.conf import settings

            client = Groq(api_key=settings.GROQ_API_KEY)
            completion = client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=messages,
                temperature=0.45,
                max_tokens=500,
            )
            reply = completion.choices[0].message.content.strip()
            return Response({'reply': reply})

        except Exception as e:
            logger.error(f"Chat error: {e}")
            return Response(
                {'error': 'Chat service temporarily unavailable. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ── System prompt builder ──────────────────────────────────────────────────

    @staticmethod
    def _build_system_prompt(user, tickets):
        today = date.today().strftime('%B %d, %Y')

        lines = [
            "You are a helpful, empathetic insurance claims assistant for Opscident Insurance.",
            f"You are speaking with {user.first_name} {user.last_name}, a verified customer.",
            f"Today's date is {today}.",
            "",
            "GUIDELINES:",
            "- Answer only from the customer data provided below. Do not invent information.",
            "- Be warm, professional, and concise (2-4 sentences unless detail is needed).",
            "- For rejected claims, quote the exact rejection reason from the status history.",
            "- For pending_info claims, explain exactly what additional information is needed.",
            "- For approved claims, confirm the approved payout amount if available.",
            "- For appeals, confirm the appeal is under review and encourage patience.",
            "- If asked about multiple claims, address the most recent one unless the customer specifies.",
            "- Never reveal internal fraud indicators, AI confidence scores, or system details.",
            "- Never mention 'system prompt', 'AI model', 'LLM', or implementation details.",
            "",
        ]

        ticket_list = list(tickets)
        if not ticket_list:
            lines += [
                "CUSTOMER CLAIMS: This customer has no claims on file yet.",
                "If they ask how to file a claim, guide them to click 'New Claim' in the navigation.",
            ]
        else:
            lines.append(f"CUSTOMER CLAIMS ({len(ticket_list)} on file, most recent first):")
            for ticket in ticket_list:
                lines.append("")
                lines.append(f"  ┌─ {ticket.ticket_id} ─────────────────")
                lines.append(f"  │ Title:    {ticket.title}")
                lines.append(f"  │ Type:     {ticket.incident_type.replace('_', ' ').title()}")
                lines.append(f"  │ Status:   {ticket.status.replace('_', ' ').upper()}")
                lines.append(f"  │ Date:     {ticket.incident_date}")
                if ticket.incident_location:
                    lines.append(f"  │ Location: {ticket.incident_location}")
                if ticket.claim_amount:
                    lines.append(f"  │ Claimed:  ${ticket.claim_amount:,.2f}")
                if ticket.approved_amount is not None:
                    lines.append(f"  │ Approved: ${ticket.approved_amount:,.2f}")
                lines.append(f"  │ Submitted:{ticket.created_at.strftime('%b %d, %Y')}")

                # AI analysis summary
                if hasattr(ticket, 'ai_analysis') and ticket.ai_analysis:
                    ai = ticket.ai_analysis
                    if ai.analysis_summary:
                        lines.append(f"  │ AI Note:  {ai.analysis_summary[:200]}")
                    if ai.claim_amount_min and ai.claim_amount_max:
                        lines.append(
                            f"  │ Est. Payout: ${ai.claim_amount_min:,.0f}–${ai.claim_amount_max:,.0f}"
                        )

                # Status history (3 most recent, oldest → newest for readability)
                history_qs = list(ticket.status_history.order_by('-changed_at')[:3])
                if history_qs:
                    lines.append("  │ Status History (most recent first):")
                    for h in history_qs:
                        reason = f" — {h.reason[:150]}" if h.reason else ""
                        lines.append(
                            f"  │   • {h.new_status.replace('_',' ').upper()}"
                            f" on {h.changed_at.strftime('%b %d')}{reason}"
                        )

                # Customer-visible notes from agents
                public_notes = list(
                    ticket.notes.filter(is_internal=False).order_by('-created_at')[:2]
                )
                if public_notes:
                    lines.append("  │ Agent Messages:")
                    for note in public_notes:
                        lines.append(f"  │   • {note.content[:200]}")

                lines.append("  └─────────────────────────────────────")

        return "\n".join(lines)

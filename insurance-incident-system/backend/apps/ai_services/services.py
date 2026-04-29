import json
import base64
import logging
from typing import Optional, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)


class GroqClient:
    """Client for interacting with Groq API."""

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.base_url = "https://api.groq.com/openai/v1"

    def _get_client(self):
        if not self.api_key:
            raise ValueError("Groq API key not configured. Set GROQ_API_KEY in environment variables.")
        
        try:
            from groq import Groq
            return Groq(api_key=self.api_key)
        except ImportError:
            raise ImportError("Groq library not installed. Run: pip install groq")

    def analyze_text(self, text: str, prompt: str) -> Optional[dict]:
        """Analyze text using Groq LLM."""
        client = self._get_client()

        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an insurance document analyzer. Extract structured information from insurance claims documents.
                        Always respond with valid JSON containing the following fields:
                        - incident_summary: Brief summary of the incident
                        - parties_involved: List of parties mentioned
                        - damages_claimed: List of damages with descriptions and amounts if mentioned
                        - date_mentioned: Any dates found in the document
                        - location_mentioned: Any locations found
                        - policy_numbers: Any policy or reference numbers
                        - key_facts: List of important facts from the document
                        """
                    },
                    {
                        "role": "user",
                        "content": f"{prompt}\n\nDocument content:\n{text[:8000]}"
                    }
                ],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )

            result = response.choices[0].message.content
            return json.loads(result)

        except Exception as e:
            logger.error(f"Error calling Groq API: {e}")
            raise

    def analyze_image(self, image_base64: str, prompt: str) -> Optional[dict]:
        """Analyze image using Groq Vision model."""
        client = self._get_client()

        try:
            response = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"You are an insurance damage assessor analyzing an insurance claim.\n\n{prompt}"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.1,
                max_tokens=1500,
            )

            result = response.choices[0].message.content
            try:
                # Strip markdown code blocks if present (vision model often wraps JSON in ```json...```)
                cleaned = result.strip()
                if cleaned.startswith('```'):
                    lines = cleaned.split('\n')
                    # Remove opening ``` line and closing ``` line
                    inner = lines[1:] if lines[0].startswith('```') else lines
                    if inner and inner[-1].strip() == '```':
                        inner = inner[:-1]
                    cleaned = '\n'.join(inner).strip()
                data = json.loads(cleaned)
                if 'matches_claim_description' not in data:
                    data['matches_claim_description'] = True
                if 'consistency_notes' not in data:
                    data['consistency_notes'] = ''
                return data
            except json.JSONDecodeError:
                logger.error(f"Vision model returned non-JSON response: {result[:200]}")
                return {
                    "damage_description": result,
                    "damage_severity": 0,
                    "damage_areas": [],
                    "estimated_repair_type": "none",
                    "fraud_indicators": ["unable_to_parse_image_analysis"],
                    "matches_claim_description": False,
                    "consistency_notes": "Image analysis could not be parsed",
                    "confidence": 0.0
                }

        except Exception as e:
            logger.error(f"Error calling Groq Vision API: {e}")
            raise

    def verify_claim_image_consistency(self, claim_title: str, claim_description: str, image_analyses: list) -> dict:
        """Use text LLM to verify if image analyses match the claim (e.g. bike vs car)."""
        if not image_analyses:
            return {"matches": True, "reason": "No images to verify"}
        image_summaries = "\n".join(
            f"- Image {i+1}: {a.get('damage_description', '')} | Areas: {a.get('damage_areas', [])}"
            for i, a in enumerate(image_analyses) if isinstance(a, dict)
        )
        prompt = f"""You are a strict insurance claims verifier. Compare the CLAIM with what the IMAGES show.

CLAIM:
Title: {claim_title}
Description: {claim_description}

WHAT THE IMAGES SHOW (from AI analysis):
{image_summaries}

CRITICAL: Check for vehicle/object type mismatch:
- If claim says "bike", "motorcycle", "bicycle", "two-wheeler" but images show a CAR = MISMATCH
- If claim says "car", "automobile", "vehicle" but images show a BIKE = MISMATCH
- If claim says "house", "property" but images show a car = MISMATCH
- Any mismatch in what type of item is damaged = MISMATCH

Respond with JSON only:
{{"matches": true or false, "reason": "brief explanation"}}

Only set matches: true if the claim and images clearly refer to the SAME type of item and damage."""
        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You verify if insurance claim text matches image descriptions. Reply ONLY with JSON: {\"matches\": true/false, \"reason\": \"string\"}."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=300,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return {"matches": result.get("matches", True), "reason": result.get("reason", "")}
        except Exception as e:
            logger.warning(f"Consistency verification failed: {e}")
        return {"matches": True, "reason": "Verification skipped"}

    @staticmethod
    def _keyword_vehicle_mismatch(claim_text: str, image_descriptions: list) -> Tuple[bool, str]:
        """Deterministic check: bike/motorcycle in claim must have bike in images; car in claim must have car in images."""
        claim_lower = (claim_text or "").lower()
        parts = []
        for d in image_descriptions:
            if not isinstance(d, dict):
                continue
            parts.append(str(d.get("damage_description", "")))
            areas = d.get("damage_areas", [])
            if isinstance(areas, str):
                parts.append(areas)
            elif isinstance(areas, (list, tuple)):
                parts.extend(str(a) for a in areas)
        image_text = " ".join(parts).lower()
        bike_words = ["bike", "bicycle", "motorcycle", "scooter", "two-wheeler", "motorbike"]
        car_words = [
            "car", "automobile", "vehicle", "sedan", "suv", "bumper", "fender", "hood", "trunk",
            "windshield", "automotive", "frontal", "front-end", "rear-end", "grille", "headlight",
            "taillight", "quarter panel", "four-door", "passenger vehicle"
        ]
        claim_has_bike = any(w in claim_lower for w in bike_words)
        claim_has_car = any(w in claim_lower for w in car_words)
        image_has_bike = any(w in image_text for w in bike_words)
        image_has_car = any(w in image_text for w in car_words)
        # Claim says bike: image MUST mention bike. If image shows car or doesn't confirm bike = mismatch.
        if claim_has_bike:
            if image_has_car and not image_has_bike:
                return True, "Claim describes bike/motorcycle but images show a car"
            if not image_has_bike:
                return True, "Claim describes bike but images do not show a bike"
        # Claim says car: image MUST mention car. If image shows bike = mismatch.
        if claim_has_car and not claim_has_bike:
            if image_has_bike and not image_has_car:
                return True, "Claim describes car but images show bike/motorcycle"
        return False, ""


class AIAnalysisService:
    """Service for analyzing insurance documents and images."""

    def __init__(self):
        self.groq_client = GroqClient()

    @staticmethod
    def _estimate_payout_range(damage_score: float, repair_type: str) -> Tuple[float, float]:
        """Return (min, max) estimated payout rounded to nearest $100."""
        t = max(0.0, min(100.0, damage_score)) / 100.0
        if repair_type == 'minor_repair':
            low  = 200  + t * 1300   # $200–$1,500
            high = 500  + t * 2000   # $500–$2,500
        elif repair_type == 'major_repair':
            low  = 1500 + t * 8500   # $1,500–$10,000
            high = 3000 + t * 15000  # $3,000–$18,000
        elif repair_type == 'replacement':
            low  = 8000  + t * 22000  # $8,000–$30,000
            high = 15000 + t * 40000  # $15,000–$55,000
        else:
            low  = 100 + t * 1900    # $100–$2,000
            high = 300 + t * 3700    # $300–$4,000
        return round(low / 100) * 100, round(high / 100) * 100

    def extract_claim_fields(self, file_content: bytes, content_type: str) -> dict:
        """OCR + LLM extraction of claim fields from an uploaded document or image.

        Returns a dict with keys: incident_type, title, description,
        incident_date, incident_location, claim_amount, confidence, notes.
        All values are best-effort — empty string means not found.
        """
        prompt = """You are an insurance claims assistant. Analyze this document and extract the following fields.
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
Only populate fields you are confident about. Leave as empty string or null if not found."""

        try:
            if content_type == 'application/pdf':
                import PyPDF2, io
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                text = ''.join(page.extract_text() or '' for page in pdf_reader.pages)
                if not text.strip():
                    return {'error': 'No text could be extracted from PDF', 'confidence': 0}
                result = self.groq_client.analyze_text(text, prompt)
            else:
                # Image: use vision model
                image_b64 = base64.b64encode(file_content).decode('utf-8')
                result = self.groq_client.analyze_image(image_b64, prompt)

            if not result:
                return {'confidence': 0}

            # Normalise claim_amount to float or None
            amount = result.get('claim_amount')
            if amount is not None:
                try:
                    result['claim_amount'] = float(amount)
                except (ValueError, TypeError):
                    result['claim_amount'] = None

            return result
        except Exception as e:
            logger.error(f"extract_claim_fields failed: {e}")
            return {'error': str(e), 'confidence': 0}

    def analyze_pdf(self, document):
        """Extract and analyze text from a PDF document."""
        from apps.ai_services.models import AIAnalysis
        import PyPDF2
        import io

        try:
            file_content = document.file.read()
            document.file.seek(0)

            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() or ""

            if not text.strip():
                logger.warning(f"No text extracted from PDF {document.id}")
                extracted_data = {"error": "No text could be extracted from PDF"}
            else:
                prompt = "Analyze this insurance claim document and extract all relevant information."
                extracted_data = self.groq_client.analyze_text(text, prompt)

            analysis, created = AIAnalysis.objects.get_or_create(
                ticket=document.ticket,
                defaults={'extracted_data': {}}
            )

            current_data = analysis.extracted_data or {}
            current_data[f'pdf_{document.id}'] = extracted_data
            analysis.extracted_data = current_data
            analysis.pdf_analysis_complete = True
            analysis.save()

            logger.info(f"PDF analysis complete for document {document.id}")

        except Exception as e:
            logger.error(f"Error analyzing PDF {document.id}: {e}")
            raise

    def analyze_image(self, document):
        """Analyze an image for damage assessment and verify it matches the claim description."""
        from apps.ai_services.models import AIAnalysis
        from PIL import Image
        import io

        try:
            file_content = document.file.read()
            document.file.seek(0)

            image = Image.open(io.BytesIO(file_content))
            if image.mode != 'RGB':
                image = image.convert('RGB')

            max_size = (1024, 1024)
            image.thumbnail(max_size, Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            ticket = document.ticket
            claim_context = f"Claim title: {ticket.title}\nClaim description: {ticket.description}"

            prompt = f"""Analyze this image for insurance damage assessment.

IMPORTANT: The customer has submitted this claim:
{claim_context}

STEP 1 — DETECT AI-GENERATED / SYNTHETIC IMAGE (highest priority):
Look carefully for signs that this image was created by an AI image generator (DALL-E, Midjourney, Stable Diffusion, ChatGPT image, etc.) rather than taken by a real camera. Key indicators:
- Unnaturally perfect or studio-like lighting with no realistic shadows
- Skin, metal, or paint textures that look rendered rather than photographed
- Background objects that are blurry, distorted, or physically impossible
- Text, logos, or license plates that are garbled, misspelled, or illegible
- Damage that looks "painted on" — too clean, too symmetric, or geometrically perfect
- Missing authentic environmental context (no reflections, no road grime, no surroundings)
- Edges between objects that look blended or dreamlike rather than sharp
- Repeating patterns or hallucinated objects that don't belong
- The scene looks more like a 3D render or concept art than a real photo
- File lacks photographic noise/grain typical of a phone camera
If you detect 2 or more of these signals, add "ai_generated_image" to fraud_indicators.

STEP 2 — VERIFY OBJECT TYPE (strict):
- If the claim mentions "bike", "bicycle", "motorcycle", "scooter", or "two-wheeler" but the image shows a CAR → MISMATCH.
- If the claim mentions "car", "automobile", or four-wheeled vehicle but the image shows a BIKE → MISMATCH.
- If the claim mentions "house" or "property" but the image shows a vehicle → MISMATCH.
- If the object type clearly matches (car claim → car in photo), set matches_claim_description to true.

STEP 3 — ASSESS DAMAGE (be decisive, not conservative):
- If there is ANY visible physical damage, score it using these MINIMUM values:
  - Any scratch, scuff, or paint transfer: at least 20
  - Small dent, crack, or broken plastic: at least 35
  - Cracked or dented bumper, broken lights, panel deformation: at least 45
  - Major structural damage, crumpling, deployed airbags: at least 70
  - Total loss: 90+
- Do NOT score lower than these minimums if the damage is visible.
- For vehicle collision claims: any visible collision damage on the correct vehicle = matches_claim_description true.
  You do NOT need to verify which specific panel was mentioned — any collision damage on the vehicle counts.

STEP 4 — OTHER FRAUD CHECKS:
- Flag stock_photo if the image is clearly a stock/marketing photo with no real incident context.
- Flag digitally_manipulated if damage appears to be edited/composited onto an otherwise undamaged vehicle.
- Do NOT flag fraud just because a specific body panel isn't labeled identically to the claim text.

Provide your analysis as JSON with these fields:
- damage_description: Detailed description of visible damage
- damage_severity: Score from 0-100 (0=no damage, 100=total loss). Be accurate — visible damage must score ≥ 30.
- damage_areas: List of affected areas
- estimated_repair_type: minor_repair, major_repair, or replacement
- fraud_indicators: List genuine fraud signals detected. Use exact strings: "ai_generated_image", "stock_photo", "digitally_manipulated". Empty list if none.
- matches_claim_description: true or false — only false if object TYPE is wrong or image is completely unrelated
- consistency_notes: Brief explanation
- confidence: Your confidence score 0-1

Respond ONLY with valid JSON, no other text."""

            image_analysis = self.groq_client.analyze_image(image_base64, prompt)

            analysis, created = AIAnalysis.objects.get_or_create(
                ticket=document.ticket,
                defaults={'extracted_data': {}}
            )

            current_data = analysis.extracted_data or {}
            current_data[f'image_{document.id}'] = image_analysis

            if 'damage_severity' in image_analysis:
                current_score = analysis.damage_score or 0
                new_score = image_analysis['damage_severity']
                analysis.damage_score = max(current_score, new_score)

            if image_analysis.get('fraud_indicators'):
                current_indicators = analysis.fraud_indicators or []
                current_indicators.extend(image_analysis['fraud_indicators'])
                analysis.fraud_indicators = list(set(current_indicators))

            analysis.extracted_data = current_data
            analysis.image_analysis_complete = True
            analysis.save()

            logger.info(f"Image analysis complete for document {document.id}")

        except Exception as e:
            from PIL import UnidentifiedImageError
            if isinstance(e, (UnidentifiedImageError, OSError)) and 'cannot identify' in str(e).lower():
                # File is not a readable image (e.g. AVIF, HEIC). Save a fallback
                # analysis requesting a new photo rather than retrying endlessly.
                logger.warning(f"Unreadable image format for document {document.id}: {e}")
                analysis, _ = AIAnalysis.objects.get_or_create(
                    ticket=document.ticket,
                    defaults={'extracted_data': {}}
                )
                current_data = analysis.extracted_data or {}
                current_data[f'image_{document.id}'] = {
                    "damage_description": "Image could not be read — unsupported format",
                    "damage_severity": 0,
                    "damage_areas": [],
                    "estimated_repair_type": "unknown",
                    "fraud_indicators": ["unreadable_image_format"],
                    "matches_claim_description": True,
                    "consistency_notes": "File format not supported. Customer must upload JPEG or PNG.",
                    "confidence": 0.0,
                }
                analysis.extracted_data = current_data
                analysis.image_analysis_complete = True
                analysis.save()
                return  # Don't raise — let make_ai_decision handle it
            logger.error(f"Error analyzing image {document.id}: {e}")
            raise

    def analyze_video(self, document):
        """Extract key frames + audio from a video, run vision analysis on each frame,
        transcribe the audio with Whisper, then store aggregated results."""
        import cv2
        import io
        import os
        import subprocess
        import tempfile
        from PIL import Image
        from apps.ai_services.models import AIAnalysis

        try:
            file_content = document.file.read()
            document.file.seek(0)

            # Write video to a temp file (cv2 requires a file path)
            suffix = os.path.splitext(document.original_filename or '.mp4')[1] or '.mp4'
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name

            # ── Frame extraction ──────────────────────────────────────────────
            cap = cv2.VideoCapture(tmp_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 25
            duration_s = total_frames / fps

            # Sample up to 6 evenly-spaced frames, avoiding the first/last 5%
            n_samples = min(6, max(1, int(duration_s // 3)))
            positions = [
                int(total_frames * (0.05 + 0.9 * i / max(n_samples - 1, 1)))
                for i in range(n_samples)
            ]

            frames_b64 = []
            for pos in positions:
                cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
                ret, frame = cap.read()
                if not ret:
                    continue
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(rgb)
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format='JPEG', quality=85)
                frames_b64.append(base64.b64encode(buf.getvalue()).decode('utf-8'))
            cap.release()

            # ── Audio transcription (best-effort via ffmpeg + Whisper) ────────
            transcript = ''
            try:
                with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp_audio:
                    tmp_audio_path = tmp_audio.name
                subprocess.run(
                    ['ffmpeg', '-y', '-i', tmp_path, '-vn', '-ar', '16000',
                     '-ac', '1', '-ab', '64k', tmp_audio_path],
                    capture_output=True, timeout=60,
                )
                with open(tmp_audio_path, 'rb') as af:
                    audio_bytes = af.read()
                os.unlink(tmp_audio_path)
                if audio_bytes:
                    client = self.groq_client._get_client()
                    resp = client.audio.transcriptions.create(
                        model='whisper-large-v3-turbo',
                        file=('audio.mp3', io.BytesIO(audio_bytes)),
                    )
                    transcript = (resp.text or '').strip()
            except Exception as ae:
                logger.warning(f"Video audio transcription skipped for doc {document.id}: {ae}")

            os.unlink(tmp_path)

            # ── Per-frame vision analysis ─────────────────────────────────────
            ticket = document.ticket
            claim_context = f"Claim title: {ticket.title}\nClaim description: {ticket.description}"
            if transcript:
                claim_context += f"\nCustomer narration from video: {transcript}"

            frame_analyses = []
            for i, frame_b64 in enumerate(frames_b64):
                prompt = f"""Analyze this insurance claim video frame ({i + 1} of {len(frames_b64)}).

{claim_context}

Assess visible damage and return JSON with exactly these fields:
- damage_description: what damage is visible
- damage_severity: 0-100
- damage_areas: list of affected areas
- estimated_repair_type: minor_repair | major_repair | replacement | none
- fraud_indicators: list of suspicious elements (empty list if none)
- matches_claim_description: true or false
- consistency_notes: brief explanation
- confidence: 0-1

Respond ONLY with valid JSON, no other text."""
                try:
                    result = self.groq_client.analyze_image(frame_b64, prompt)
                    if result:
                        frame_analyses.append(result)
                except Exception as fe:
                    logger.warning(f"Frame {i + 1} analysis failed for doc {document.id}: {fe}")

            # ── Aggregate ─────────────────────────────────────────────────────
            max_severity = max(
                (a.get('damage_severity', 0) for a in frame_analyses if isinstance(a, dict)),
                default=0,
            )
            all_fraud: list = []
            for a in frame_analyses:
                if isinstance(a, dict) and a.get('fraud_indicators'):
                    all_fraud.extend(a['fraud_indicators'])

            matches = not any(
                (a.get('matches_claim_description') is False
                 or str(a.get('matches_claim_description', '')).lower() == 'false')
                for a in frame_analyses if isinstance(a, dict)
            )

            video_result = {
                'transcript': transcript,
                'frames_analyzed': len(frame_analyses),
                'max_damage_severity': max_severity,
                'all_fraud_indicators': list(set(all_fraud)),
                'matches_claim_description': matches,
                'frame_analyses': frame_analyses,
            }

            # ── Persist ───────────────────────────────────────────────────────
            analysis, _ = AIAnalysis.objects.get_or_create(
                ticket=ticket, defaults={'extracted_data': {}}
            )
            current_data = analysis.extracted_data or {}
            current_data[f'video_{document.id}'] = video_result

            if max_severity > (analysis.damage_score or 0):
                analysis.damage_score = max_severity

            if all_fraud:
                existing = analysis.fraud_indicators or []
                analysis.fraud_indicators = list(set(existing + all_fraud))

            analysis.extracted_data = current_data
            analysis.image_analysis_complete = True  # videos feed the same decision pipeline
            analysis.save()

            logger.info(
                f"Video analysis complete for document {document.id}: "
                f"{len(frame_analyses)} frames, severity={max_severity}, "
                f"fraud={len(all_fraud)}, transcript={'yes' if transcript else 'no'}"
            )

        except Exception as e:
            logger.error(f"Error analyzing video {document.id}: {e}")
            raise

    def generate_recommendation_and_decide(self, ticket):
        """Generate recommendation and automatically decide on the claim."""
        from apps.ai_services.models import AIAnalysis
        from apps.tickets.models import StatusHistory
        from apps.notifications.services import NotificationService

        try:
            analysis = AIAnalysis.objects.get(ticket=ticket)
        except AIAnalysis.DoesNotExist:
            logger.warning(f"No analysis found for ticket {ticket.ticket_id}")
            return

        damage_score = analysis.damage_score or 0
        fraud_indicators = analysis.fraud_indicators or []
        fraud_count = len(fraud_indicators)
        extracted_data = analysis.extracted_data or {}
        
        old_status = ticket.status
        new_status = None
        confidence = 0.0
        recommendation = 'review'
        reason = ''

        # Check if we have enough documents analyzed
        has_images = any(k.startswith('image_') or k.startswith('video_') for k in extracted_data.keys())
        has_pdfs = any(k.startswith('pdf_') for k in extracted_data.keys())

        # Check if images/video frames match the claim description
        description_mismatch = False
        mismatch_notes = []
        claim_text = f"{ticket.title} {ticket.description}"

        # Collect per-frame analyses from videos alongside standalone images
        image_analyses = [v for k, v in extracted_data.items() if k.startswith('image_') and isinstance(v, dict)]
        for k, v in extracted_data.items():
            if k.startswith('video_') and isinstance(v, dict):
                image_analyses.extend(fa for fa in v.get('frame_analyses', []) if isinstance(fa, dict))
        
        # Only check for clear object-type fraud (bike vs car) — deterministic, no LLM needed.
        # We intentionally skip the vision model's matches_claim_description and the
        # verify_claim_image_consistency LLM call because they are too strict for
        # generic descriptions (e.g. "car accident" doesn't mention which panel).
        kw_mismatch, kw_reason = GroqClient._keyword_vehicle_mismatch(claim_text, image_analyses)
        if kw_mismatch:
            description_mismatch = True
            mismatch_notes.append(kw_reason)
        
        # Special case: all uploaded images are unreadable (wrong format)
        all_unreadable = (
            has_images and
            all('unreadable_image_format' in (d.get('fraud_indicators') or []) for d in image_analyses)
        )
        if all_unreadable:
            recommendation = 'need_info'
            new_status = 'pending_info'
            confidence = 0.8
            reason = (
                "We were unable to process your uploaded image(s) due to an incompatible file format. "
                "Please re-upload your damage photos as JPEG or PNG files. "
                "If you're using an iPhone, open the photo in the Photos app, tap Share, then Save Image before uploading."
            )
            analysis.analysis_summary = "Image format not supported (e.g. AVIF/HEIC). Customer must re-upload as JPEG or PNG."
            analysis.recommendation = recommendation
            analysis.confidence_score = confidence
            analysis.save()
            if new_status != old_status:
                ticket.status = new_status
                ticket.save()
                StatusHistory.objects.create(
                    ticket=ticket,
                    old_status=old_status,
                    new_status=new_status,
                    reason=reason
                )
                NotificationService.send_info_request_notification(ticket, reason)
            logger.info(f"AI Decision for {ticket.ticket_id}: unreadable images → {new_status}")
            return {'recommendation': recommendation, 'status': new_status, 'confidence': confidence, 'reason': reason}

        # Compute payout range early so it's available when setting approved_amount
        best_repair_type = 'unknown'
        amt_min, amt_max = 0.0, 0.0
        if image_analyses:
            best = max(image_analyses, key=lambda d: d.get('damage_severity', 0) if isinstance(d, dict) else 0)
            best_repair_type = best.get('estimated_repair_type', 'unknown') or 'unknown'
        if damage_score > 0:
            amt_min, amt_max = self._estimate_payout_range(damage_score, best_repair_type)
            analysis.claim_amount_min = amt_min
            analysis.claim_amount_max = amt_max

        # Auto-reject AI-generated images regardless of fraud_count
        ai_generated = 'ai_generated_image' in fraud_indicators

        # Decision Logic
        if ai_generated or fraud_count >= 2:
            # HIGH FRAUD RISK - Auto reject
            recommendation = 'reject'
            new_status = 'rejected'
            confidence = 0.95
            if ai_generated:
                reason = (
                    "Our system has determined that one or more of the submitted images appear to be "
                    "AI-generated or synthetically created rather than authentic photographs of real damage. "
                    "We require original, unedited photographs taken at the time of the incident. "
                    "If you believe this is an error, please contact our support team with the original image files."
                )
                analysis.analysis_summary = "Auto-rejected: submitted image detected as AI-generated/synthetic."
            else:
                reason = (
                    "After carefully reviewing your claim and the submitted documentation, "
                    "our assessment was unable to verify the incident or damage as described. "
                    "If you believe this outcome is incorrect, please contact our support team "
                    "with any additional evidence or documentation."
                )
                analysis.analysis_summary = (
                    f"Auto-rejected: {fraud_count} fraud indicator(s) detected — "
                    + ', '.join(fraud_indicators[:3])
                )

        elif not has_images and ticket.incident_type in ['vehicle_collision', 'property_damage', 'vehicle_theft']:
            # NEED MORE INFO - No damage photos for damage-related claims
            recommendation = 'need_info'
            new_status = 'pending_info'
            confidence = 0.8
            reason = (
                "To continue processing your claim, please upload clear photographs or a video showing the damage. "
                "Visual evidence (photo or video) is required for claims of this type."
            )
            analysis.analysis_summary = "No visual evidence submitted. A photo or video is required for this incident type."

        elif description_mismatch:
            # IMAGE DOESN'T MATCH CLAIM - Auto reject
            recommendation = 'reject'
            new_status = 'rejected'
            confidence = 0.9
            reason = (
                "After reviewing your claim, we found that the submitted photos do not appear to correspond "
                "to the incident described. Please contact our support team if you believe this is an error "
                "or if you have additional documentation to support your claim."
            )
            analysis.analysis_summary = (
                "Rejected — description/image mismatch: "
                + ("; ".join(mismatch_notes[:2]) if mismatch_notes else "Evidence does not match claim description.")
            )

        elif has_images and fraud_count == 0:
            # APPROVE — Image present, matches claim type, zero fraud signals
            recommendation = 'approve'
            new_status = 'approved'
            confidence = min(0.78 + damage_score * 0.002, 0.98)
            reason = (
                "Your claim has been approved following our review of the submitted documents. "
                "A representative will be in touch with next steps regarding your payout."
            )
            # Set approved amount: use claimed amount if provided, else AI estimated minimum
            approved = ticket.claim_amount or amt_min or None
            if approved:
                ticket.approved_amount = approved
            analysis.analysis_summary = (
                f"Approved. Damage score: {damage_score}/100. "
                f"Approved amount: ${approved:,.2f}." if approved else
                f"Approved. Damage score: {damage_score}/100."
            )

        elif damage_score >= 20 and fraud_count == 1:
            # ONE CONCERN — Escalate for agent review
            recommendation = 'review'
            new_status = 'pending_info'
            confidence = 0.6
            reason = (
                "Your claim is currently under review by one of our team members. "
                "We will notify you as soon as a decision has been made."
            )
            analysis.analysis_summary = (
                f"Escalated for agent review. Damage score: {damage_score}/100, 1 concern flagged."
            )

        elif damage_score < 20 and fraud_count == 0:
            # LOW DAMAGE — no image or undetectable damage
            if damage_score < 10:
                recommendation = 'reject'
                new_status = 'rejected'
                confidence = 0.75
                reason = (
                    "Based on our assessment of the submitted documentation, the evidence provided "
                    "does not demonstrate sufficient damage to support this claim. "
                    "If you have additional evidence such as repair estimates or inspection reports, "
                    "please contact our support team."
                )
                analysis.analysis_summary = f"Rejected. Damage score {damage_score}/100 — no visible damage found."
            else:
                recommendation = 'need_info'
                new_status = 'pending_info'
                confidence = 0.65
                reason = (
                    "To help us better assess your claim, please provide clearer photographs "
                    "showing the full extent of the damage from multiple angles, along with any "
                    "supporting documents such as repair estimates or receipts."
                )
                analysis.analysis_summary = f"Damage score {damage_score}/100 — insufficient evidence. Additional photos requested."
        else:
            # DEFAULT - Agent review
            recommendation = 'review'
            new_status = 'pending_info'
            confidence = 0.5
            reason = (
                "Your claim has been received and is currently being reviewed by our team. "
                "We will be in touch shortly."
            )
            analysis.analysis_summary = "Escalated for manual agent review."

        # Save analysis
        analysis.recommendation = recommendation
        analysis.confidence_score = confidence
        analysis.save()

        # Update ticket status
        if new_status and new_status != old_status:
            ticket.status = new_status
            ticket.save(update_fields=['status', 'approved_amount', 'updated_at'])

            StatusHistory.objects.create(
                ticket=ticket,
                old_status=old_status,
                new_status=new_status,
                reason=reason
            )

            # Send notification to customer
            if new_status in ['approved', 'rejected']:
                NotificationService.send_status_change_notification(ticket)
            elif new_status == 'pending_info':
                NotificationService.send_info_request_notification(ticket, reason)

        logger.info(f"AI Decision for {ticket.ticket_id}: {recommendation} -> {new_status} (confidence: {confidence})")
        
        return {
            'recommendation': recommendation,
            'status': new_status,
            'confidence': confidence,
            'reason': reason
        }

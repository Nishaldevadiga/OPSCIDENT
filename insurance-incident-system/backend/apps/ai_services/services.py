import json
import base64
import logging
from typing import Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class GroqClient:
    """Client for interacting with Groq API."""

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.base_url = "https://api.groq.com/openai/v1"

    def _get_client(self):
        try:
            from groq import Groq
            return Groq(api_key=self.api_key)
        except ImportError:
            logger.error("Groq library not installed")
            return None

    def analyze_text(self, text: str, prompt: str) -> Optional[dict]:
        """Analyze text using Groq LLM."""
        if not self.api_key:
            logger.warning("Groq API key not configured, using mock response")
            return self._mock_text_analysis()

        client = self._get_client()
        if not client:
            return self._mock_text_analysis()

        try:
            response = client.chat.completions.create(
                model="llama-3.1-70b-versatile",
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
            return self._mock_text_analysis()

    def analyze_image(self, image_base64: str, prompt: str) -> Optional[dict]:
        """Analyze image using Groq Vision model."""
        if not self.api_key:
            logger.warning("Groq API key not configured, using mock response")
            return self._mock_image_analysis()

        client = self._get_client()
        if not client:
            return self._mock_image_analysis()

        try:
            response = client.chat.completions.create(
                model="llama-3.2-90b-vision-preview",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an insurance damage assessor. Analyze images of vehicle or property damage.
                        Provide your analysis as JSON with these fields:
                        - damage_description: Detailed description of visible damage
                        - damage_severity: Score from 0-100 (0=no damage, 100=total loss)
                        - damage_areas: List of affected areas
                        - estimated_repair_type: minor_repair, major_repair, or replacement
                        - fraud_indicators: List any suspicious elements (stock photos, inconsistencies)
                        - confidence: Your confidence score 0-1
                        """
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
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
                return json.loads(result)
            except json.JSONDecodeError:
                return {
                    "damage_description": result,
                    "damage_severity": 50,
                    "damage_areas": [],
                    "estimated_repair_type": "major_repair",
                    "fraud_indicators": [],
                    "confidence": 0.7
                }

        except Exception as e:
            logger.error(f"Error calling Groq Vision API: {e}")
            return self._mock_image_analysis()

    def _mock_text_analysis(self) -> dict:
        """Return mock analysis for testing without API key."""
        return {
            "incident_summary": "Mock analysis - API key not configured",
            "parties_involved": ["Party A", "Party B"],
            "damages_claimed": [{"description": "Vehicle damage", "amount": "Unknown"}],
            "date_mentioned": [],
            "location_mentioned": [],
            "policy_numbers": [],
            "key_facts": ["This is a mock analysis for development purposes"]
        }

    def _mock_image_analysis(self) -> dict:
        """Return mock image analysis for testing without API key."""
        return {
            "damage_description": "Mock analysis - API key not configured",
            "damage_severity": 50,
            "damage_areas": ["Front bumper", "Hood"],
            "estimated_repair_type": "major_repair",
            "fraud_indicators": [],
            "confidence": 0.5
        }


class AIAnalysisService:
    """Service for analyzing insurance documents and images."""

    def __init__(self):
        self.groq_client = GroqClient()

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
        """Analyze an image for damage assessment."""
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

            prompt = "Analyze this image for insurance damage assessment. Identify any visible damage, estimate severity, and note any suspicious elements."
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
            logger.error(f"Error analyzing image {document.id}: {e}")
            raise

    def generate_recommendation(self, ticket):
        """Generate final recommendation based on all analyses."""
        from apps.ai_services.models import AIAnalysis

        try:
            analysis = AIAnalysis.objects.get(ticket=ticket)
        except AIAnalysis.DoesNotExist:
            logger.warning(f"No analysis found for ticket {ticket.ticket_id}")
            return

        damage_score = analysis.damage_score or 0
        confidence = 0.0
        recommendation = 'review'

        fraud_count = len(analysis.fraud_indicators or [])
        if fraud_count > 2:
            recommendation = 'reject'
            confidence = 0.9
            analysis.analysis_summary = f"Multiple fraud indicators detected ({fraud_count}). Manual review strongly recommended before rejection."
        elif damage_score >= 70 and fraud_count == 0:
            recommendation = 'approve'
            confidence = min(0.8 + (damage_score - 70) * 0.005, 0.95)
            analysis.analysis_summary = f"High damage score ({damage_score}) with no fraud indicators. Recommended for approval."
        elif damage_score < 30:
            recommendation = 'review'
            confidence = 0.6
            analysis.analysis_summary = f"Low damage score ({damage_score}). Manual review recommended to verify claim validity."
        else:
            recommendation = 'review'
            confidence = 0.5
            analysis.analysis_summary = f"Moderate damage score ({damage_score}). Manual review required for final decision."

        analysis.recommendation = recommendation
        analysis.confidence_score = confidence
        analysis.save()

        logger.info(f"Recommendation for {ticket.ticket_id}: {recommendation} (confidence: {confidence})")

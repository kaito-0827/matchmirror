import google.generativeai as genai
from app.config import settings
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_model = None


def get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        if not settings.google_gemini_api_key:
            raise RuntimeError("GOOGLE_GEMINI_API_KEY is not set")
        genai.configure(api_key=settings.google_gemini_api_key)
        _model = genai.GenerativeModel(settings.gemini_model)
    return _model


async def call_gemini(prompt: str, expect_json: bool = False) -> str:
    """Call Gemini API. Raises if no API key so agents use their mock fallbacks."""
    if not settings.google_gemini_api_key:
        logger.warning("No Gemini API key — agent will use mock fallback")
        raise RuntimeError("GOOGLE_GEMINI_API_KEY not configured")
    try:
        model = get_model()
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise


def parse_json_response(text: str) -> Any:
    """Extract and parse JSON from a Gemini response that may include markdown."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    return json.loads(text)

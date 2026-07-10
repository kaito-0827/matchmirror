import google.generativeai as genai
from app.config import settings
import asyncio
import json
import logging
import re
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
        # expect_json時はGeminiのJSONモードを使い、不正なJSON応答を根本から減らす
        generation_config = (
            genai.GenerationConfig(response_mime_type="application/json")
            if expect_json else None
        )
        # generate_content は同期blockingのため、スレッドプールに逃がして
        # FastAPIのイベントループを塞がないようにする。
        response = await asyncio.to_thread(
            model.generate_content, prompt, generation_config=generation_config
        )
        return response.text
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise


def parse_json_response(text: str) -> Any:
    """Extract and parse JSON from a Gemini response that may include markdown."""
    text = text.strip()
    if text.startswith("```"):
        # ```json ... ``` フェンスの中身だけを取り出す（閉じフェンス後の余談も捨てる）
        m = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
        else:
            text = "\n".join(text.split("\n")[1:-1])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 前後の余計なテキストを除き、最初のJSON値（{...} / [...]）だけを取り出して再試行
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    if start == -1:
        raise json.JSONDecodeError("No JSON value found in response", text, 0)
    end = max(text.rfind("}"), text.rfind("]"))
    candidate = text[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # 末尾カンマ（LLM出力に頻出）を除去して最後の再試行
        cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
        return json.loads(cleaned)

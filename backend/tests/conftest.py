"""
共通フィクスチャ。ENVIRONMENT=development で in-memory Firestore、モックエージェント動作。
"""
import os
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("GOOGLE_GEMINI_API_KEY", "")

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

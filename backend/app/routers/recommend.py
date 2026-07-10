from __future__ import annotations
"""診断結果（シグナル）から合う企業を推薦するルーター。"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.db import firestore
from app.agents import recommend_agent
from app.utils.company_lookup import batch_get_companies, dedupe_latest_by_job_id
from app.utils.rate_limit import rate_limiter

router = APIRouter(prefix="/api", tags=["recommend"])


class RecommendationRequest(BaseModel):
    session_id: Optional[str] = None
    signals: Optional[List[str]] = None
    priority_axes: Optional[List[str]] = None
    limit: int = 10


@router.post(
    "/recommendations",
    dependencies=[Depends(rate_limiter(max_requests=10, window_seconds=60))],
)
async def recommend_companies(body: RecommendationRequest):
    """候補者の診断シグナル（or 希望軸）から、合う企業をランキングして返す。"""
    signals: List[str] = list(body.signals or [])
    if body.session_id:
        session = await firestore.get("diagnosisSessions", body.session_id)
        if session:
            signals.extend(session.get("extracted_signals", []) or [])
    # 重複除去（順序維持）
    signals = list(dict.fromkeys(signals))
    priority_axes = body.priority_axes or []

    companies = dedupe_latest_by_job_id(await firestore.list_all("companyRealityProfiles"))
    companies_by_id = await batch_get_companies([c.get("company_id") for c in companies])
    ranked = recommend_agent.score_companies(signals, priority_axes, companies, companies_by_id)
    limit = max(1, min(body.limit, 50))
    top = ranked[:limit]

    # 上位5社のみAIで自然文理由を付与（best-effort）
    ai_reasons = await recommend_agent.explain_top(signals, top[:5])
    for it in top:
        reason = ai_reasons.get(it["job_id"])
        if reason:
            it["reasons"] = [reason] + [r for r in it["reasons"] if r != reason][:2]

    return {
        "items": top,
        "based_on": {"signals": signals, "priority_axes": priority_axes},
        "total_candidates": len(ranked),
    }

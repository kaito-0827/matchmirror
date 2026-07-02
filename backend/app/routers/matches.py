from __future__ import annotations
"""マッチング（就活者→企業）と、双方向け面談メモ・企業通知のルーター。"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime

from app.auth import Principal, get_principal
from app.db import firestore
from app.agents import interview_agent
from app.routers.reports import _raw_company_profile
from app.utils import audit

router = APIRouter(prefix="/api", tags=["matches"])


class MatchRequest(BaseModel):
    report_id: str


@router.post("/matches")
async def create_match(body: MatchRequest, principal: Principal = Depends(get_principal)):
    """就活者が自分の診断レポートから企業にマッチングする。双方の面談メモを生成・保存。"""
    report = await firestore.get("mismatchReports", body.report_id)
    if not report:
        raise HTTPException(status_code=404, detail="レポートが見つかりません")
    if report.get("user_id") != principal.uid:
        raise HTTPException(status_code=403, detail="自分の診断結果のみマッチングできます")

    job_id = report.get("job_id")

    # 候補者表示名
    user = await firestore.get("users", principal.uid)
    candidate_name = (user or {}).get("display_name") or "候補者"

    # 企業プロファイル
    profiles = await firestore.query("companyRealityProfiles", {"job_id": job_id})
    cp_doc = profiles[0] if profiles else {}
    md = cp_doc.get("metadata", {}) or {}
    company_profile = cp_doc.get("structured_data") or _raw_company_profile(cp_doc) if cp_doc else {}
    company_id = cp_doc.get("company_id")

    # 会社名: seedはmetadata.name、会社アカウント作成のプロファイルはcompaniesコレクションから引く
    company_name = md.get("name")
    if not company_name and company_id:
        company_account = await firestore.get("companies", company_id)
        company_name = (company_account or {}).get("name")
    company_name = company_name or "企業"

    prep = await interview_agent.generate_interview_prep(report, company_profile, candidate_name)
    main_concerns = [g.get("axis") for g in report.get("gaps", [])[:3] if g.get("axis")]

    # 冪等: 同じ候補者×求人の既存マッチは更新
    existing = await firestore.query("matches", {"user_id": principal.uid, "job_id": job_id})
    match_id = existing[0]["id"] if existing else firestore.new_id()

    match = {
        "id": match_id,
        "user_id": principal.uid,
        "candidate_name": candidate_name,
        "job_id": job_id,
        "company_id": company_id,
        "company_name": company_name,
        "report_id": body.report_id,
        "overall_score": report.get("overall_score", 60),
        "main_concerns": main_concerns,
        "candidate_prep": prep["candidate_prep"],
        "company_prep": prep["company_prep"],
        "notification": prep["notification"],
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    await firestore.save("matches", match_id, match)
    await audit.log(principal.uid, "match_created", match_id, {"job_id": job_id})
    return match


@router.get("/my/matches")
async def my_matches(principal: Principal = Depends(get_principal)):
    """就活者のマッチング一覧（candidate_prep含む）。"""
    matches = await firestore.query("matches", {"user_id": principal.uid})
    matches.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return {"items": matches, "total": len(matches)}


def _match_item(m: dict) -> dict:
    return {
        "id": m.get("id"),
        "candidate_name": m.get("candidate_name"),
        "job_id": m.get("job_id"),
        "overall_score": m.get("overall_score"),
        "main_concerns": m.get("main_concerns", []),
        "notification": m.get("notification"),
        "company_prep": m.get("company_prep", []),
        "read": m.get("read", False),
        "created_at": m.get("created_at"),
    }


@router.get("/company-matches/mine")
async def my_company_matches(principal: Principal = Depends(get_principal)):
    """
    企業側：ログイン中の会社アカウントに届いた全マッチ一覧。
    会社ID直付けのマッチに加え、自社求人(job_id)経由のマッチも合算する
    （company_id未設定で保存された過去データの救済）。
    """
    account = await firestore.get("accounts", principal.uid)
    company_id = (account or {}).get("company_id")
    if not company_id:
        return {"items": [], "total": 0, "unread": 0}

    matches = await firestore.query("matches", {"company_id": company_id})
    seen = {m.get("id") for m in matches}

    profiles = await firestore.query("companyRealityProfiles", {"company_id": company_id})
    for p in profiles:
        job_id = p.get("job_id")
        if not job_id:
            continue
        for m in await firestore.query("matches", {"job_id": job_id}):
            if m.get("id") not in seen:
                matches.append(m)
                seen.add(m.get("id"))

    matches.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    items = [_match_item(m) for m in matches]
    unread = sum(1 for it in items if not it["read"])
    return {"items": items, "total": len(items), "unread": unread}


@router.get("/company-matches/jobs/{job_id}")
async def company_matches(job_id: str):
    """企業側：当該求人へのマッチ一覧（通知文＋company_prep＋候補者名）。"""
    matches = await firestore.query("matches", {"job_id": job_id})
    matches.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    items = [_match_item(m) for m in matches]
    unread = sum(1 for it in items if not it["read"])
    return {"items": items, "total": len(items), "unread": unread}


@router.post("/company-matches/{match_id}/read")
async def mark_read(match_id: str):
    """マッチ通知を既読にする。"""
    m = await firestore.get("matches", match_id)
    if not m:
        raise HTTPException(status_code=404, detail="マッチが見つかりません")
    await firestore.update("matches", match_id, {"read": True})
    return {"id": match_id, "read": True}

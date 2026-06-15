from __future__ import annotations
"""
アカウント登録・認証情報取得のルーター。

Firebase Auth で認証済みの principal(uid) を前提に、
candidate / company のアカウントを Firestore に作成し、ロールを解決する。
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from app.auth import Principal, get_principal
from app.db import firestore
from app.utils import audit
from app.models.account import (
    Account,
    AccountRole,
    UserRegisterInput,
    UserProfile,
    CompanyRegisterInput,
    CompanyAccount,
    MeResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _get_account(uid: str) -> dict | None:
    return await firestore.get("accounts", uid)


@router.post("/register/candidate", response_model=MeResponse)
async def register_candidate(body: UserRegisterInput, principal: Principal = Depends(get_principal)):
    """候補者アカウントを作成（既存なら冪等に返す）。"""
    existing = await _get_account(principal.uid)
    if existing and existing.get("role") != AccountRole.candidate:
        raise HTTPException(status_code=409, detail="このアカウントは別ロールで登録済みです")

    now = datetime.utcnow().isoformat()
    account = {
        "uid": principal.uid,
        "email": principal.email,
        "role": AccountRole.candidate.value,
        "user_id": principal.uid,
        "company_id": None,
        "created_at": (existing or {}).get("created_at", now),
    }
    await firestore.save("accounts", principal.uid, account)

    user = await firestore.get("users", principal.uid)
    if not user:
        user = {
            "uid": principal.uid,
            "email": principal.email,
            "display_name": body.display_name,
            "career_stage": body.career_stage.value,
            "priorities": [],
            "anxieties": [],
            "deal_breakers": [],
            "career_goals": None,
            "created_at": now,
            "updated_at": now,
        }
        await firestore.save("users", principal.uid, user)
        await audit.log(principal.uid, "candidate_registered", principal.uid)

    return MeResponse(account=Account(**account), user=UserProfile(**user))


@router.post("/register/company", response_model=MeResponse)
async def register_company(body: CompanyRegisterInput, principal: Principal = Depends(get_principal)):
    """会社アカウントを作成し、principal をオーナーに紐づける。"""
    existing = await _get_account(principal.uid)
    if existing and existing.get("role") != AccountRole.company:
        raise HTTPException(status_code=409, detail="このアカウントは別ロールで登録済みです")

    now = datetime.utcnow().isoformat()

    # 既にオーナーの会社があれば再利用、なければ新規採番
    company_id = existing.get("company_id") if existing else None
    if company_id:
        company = await firestore.get("companies", company_id)
    else:
        company = None

    if not company:
        company_id = firestore.new_id()
        company = {
            "id": company_id,
            "name": body.name,
            "industry": body.industry,
            "size_band": body.size_band,
            "region": body.region,
            "contact_email": body.contact_email or principal.email,
            "owner_uid": principal.uid,
            "member_uids": [principal.uid],
            "created_at": now,
            "updated_at": now,
        }
        await firestore.save("companies", company_id, company)
        await audit.log(principal.uid, "company_registered", company_id)

    account = {
        "uid": principal.uid,
        "email": principal.email,
        "role": AccountRole.company.value,
        "user_id": None,
        "company_id": company_id,
        "created_at": (existing or {}).get("created_at", now),
    }
    await firestore.save("accounts", principal.uid, account)

    return MeResponse(account=Account(**account), company=CompanyAccount(**company))


@router.get("/me", response_model=MeResponse)
async def get_me(principal: Principal = Depends(get_principal)):
    """現在の認証主体のアカウント・プロフィールを返す。"""
    account = await _get_account(principal.uid)
    if not account:
        raise HTTPException(status_code=404, detail="アカウントが未登録です")

    user = None
    company = None
    if account.get("role") == AccountRole.candidate:
        u = await firestore.get("users", account.get("user_id") or principal.uid)
        user = UserProfile(**u) if u else None
    elif account.get("role") == AccountRole.company and account.get("company_id"):
        c = await firestore.get("companies", account["company_id"])
        company = CompanyAccount(**c) if c else None

    return MeResponse(account=Account(**account), user=user, company=company)

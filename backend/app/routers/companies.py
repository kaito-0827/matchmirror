from __future__ import annotations
"""会社アカウントのCRUD。メンバーのみ自社情報を更新できる。"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from app.auth import Principal, get_principal
from app.db import firestore
from app.models.account import CompanyAccount, CompanyUpdateInput

router = APIRouter(prefix="/api/companies", tags=["companies"])


def _is_member(company: dict, uid: str) -> bool:
    return uid == company.get("owner_uid") or uid in company.get("member_uids", [])


@router.get("", response_model=list[CompanyAccount])
async def list_companies(principal: Principal = Depends(get_principal)):
    """会社アカウント一覧を返す。"""
    companies = await firestore.list_all("companies")
    return [CompanyAccount(**c) for c in companies]


@router.get("/{company_id}", response_model=CompanyAccount)
async def get_company(company_id: str, principal: Principal = Depends(get_principal)):
    company = await firestore.get("companies", company_id)
    if not company:
        raise HTTPException(status_code=404, detail="会社が見つかりません")
    return CompanyAccount(**company)


@router.patch("/{company_id}", response_model=CompanyAccount)
async def update_company(company_id: str, body: CompanyUpdateInput, principal: Principal = Depends(get_principal)):
    company = await firestore.get("companies", company_id)
    if not company:
        raise HTTPException(status_code=404, detail="会社が見つかりません")
    if not _is_member(company, principal.uid):
        raise HTTPException(status_code=403, detail="自社の情報のみ更新できます")

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["updated_at"] = datetime.utcnow().isoformat()
    await firestore.update("companies", company_id, patch)

    updated = await firestore.get("companies", company_id)
    return CompanyAccount(**updated)


@router.post("/{company_id}/members/{uid}", response_model=CompanyAccount)
async def add_member(company_id: str, uid: str, principal: Principal = Depends(get_principal)):
    """会社にメンバー(HR担当)を追加する。オーナーのみ可。"""
    company = await firestore.get("companies", company_id)
    if not company:
        raise HTTPException(status_code=404, detail="会社が見つかりません")
    if principal.uid != company.get("owner_uid"):
        raise HTTPException(status_code=403, detail="オーナーのみメンバーを追加できます")

    members = company.get("member_uids", [])
    if uid not in members:
        members.append(uid)
        await firestore.update("companies", company_id, {"member_uids": members})

    updated = await firestore.get("companies", company_id)
    return CompanyAccount(**updated)

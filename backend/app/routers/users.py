from __future__ import annotations
"""候補者ユーザーのCRUD。本人のみ自分のプロフィールを更新できる。"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from app.auth import Principal, get_principal
from app.db import firestore
from app.models.account import UserProfile, UserUpdateInput

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{uid}", response_model=UserProfile)
async def get_user(uid: str, principal: Principal = Depends(get_principal)):
    user = await firestore.get("users", uid)
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    return UserProfile(**user)


@router.patch("/{uid}", response_model=UserProfile)
async def update_user(uid: str, body: UserUpdateInput, principal: Principal = Depends(get_principal)):
    if principal.uid != uid:
        raise HTTPException(status_code=403, detail="自分のプロフィールのみ更新できます")
    user = await firestore.get("users", uid)
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["updated_at"] = datetime.utcnow().isoformat()
    await firestore.update("users", uid, patch)

    updated = await firestore.get("users", uid)
    return UserProfile(**updated)

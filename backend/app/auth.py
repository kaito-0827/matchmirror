from __future__ import annotations
"""
Firebase Authentication によるトークン検証。

フロントは Firebase Auth でサインインして取得した ID トークンを
`Authorization: Bearer <idToken>` で送る。バックエンドは firebase-admin で
検証し、principal(uid/email) を取り出す。

ローカル開発（Firebase未設定）では従来どおり動かせるよう、devフォールバックを用意:
- ヘッダ `X-Dev-Uid` / `X-Dev-Email` / `X-Dev-Role` があればそれを principal とする。
- 何もなければ匿名の dev principal（uid="demo-user"）を返す。
本番（GOOGLE_CLOUD_PROJECT設定あり）では dev フォールバックは無効で、
有効なトークンが無ければ 401 を返す。
"""
from dataclasses import dataclass
from typing import Optional
from fastapi import Depends, Header, HTTPException
import logging

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class Principal:
    uid: str
    email: Optional[str] = None
    role: Optional[str] = None
    is_dev: bool = False


def _verify_firebase_token(token: str) -> Optional[Principal]:
    """firebase-admin で ID トークンを検証する。失敗時 None。"""
    try:
        # firestore.get_db() が firebase_admin アプリを初期化済みにする
        from app.db.firestore import get_db
        get_db()
        from firebase_admin import auth as fb_auth
        decoded = fb_auth.verify_id_token(token)
        return Principal(
            uid=decoded["uid"],
            email=decoded.get("email"),
            role=decoded.get("role"),  # custom claim があれば
        )
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        return None


async def get_principal(
    authorization: Optional[str] = Header(default=None),
    x_dev_uid: Optional[str] = Header(default=None),
    x_dev_email: Optional[str] = Header(default=None),
    x_dev_role: Optional[str] = Header(default=None),
) -> Principal:
    """現在のリクエストの認証主体を返す。未認証は 401。"""
    # 1) Bearer トークンがあれば Firebase で検証
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        principal = _verify_firebase_token(token)
        if principal:
            return principal
        # 本番でトークンが無効なら拒否
        if not settings.is_development:
            raise HTTPException(status_code=401, detail="無効な認証トークンです")

    # 2) 本番でトークンが無い/無効 → 401
    if not settings.is_development:
        raise HTTPException(status_code=401, detail="認証が必要です")

    # 3) 開発モードのフォールバック
    return Principal(
        uid=x_dev_uid or "demo-user",
        email=x_dev_email,
        role=x_dev_role,
        is_dev=True,
    )


async def get_optional_principal(
    authorization: Optional[str] = Header(default=None),
    x_dev_uid: Optional[str] = Header(default=None),
    x_dev_email: Optional[str] = Header(default=None),
    x_dev_role: Optional[str] = Header(default=None),
) -> Optional[Principal]:
    """認証任意のエンドポイント用。失敗時は None を返す。"""
    try:
        return await get_principal(authorization, x_dev_uid, x_dev_email, x_dev_role)
    except HTTPException:
        return None

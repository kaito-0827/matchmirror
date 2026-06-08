from __future__ import annotations
"""
Firestore DB レイヤー。
開発環境ではインメモリストアにフォールバックする。
"""
import os
import uuid
from datetime import datetime
from typing import Optional, Any
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# インメモリストア（開発・テスト用）
_store: dict[str, dict[str, Any]] = {}

_db = None


def get_db():
    global _db
    if _db is not None:
        return _db

    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host

    if settings.firebase_service_account_path and os.path.exists(settings.firebase_service_account_path):
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            if not firebase_admin._apps:
                cred = credentials.Certificate(settings.firebase_service_account_path)
                firebase_admin.initialize_app(cred)
            _db = firestore.client()
            logger.info("Connected to Firestore")
            return _db
        except Exception as e:
            logger.warning(f"Firestore connection failed, using in-memory store: {e}")

    logger.info("Using in-memory store (development mode)")
    return None


async def save(collection: str, doc_id: str, data: dict) -> str:
    db = get_db()
    data["id"] = doc_id
    if db:
        db.collection(collection).document(doc_id).set(data)
    else:
        if collection not in _store:
            _store[collection] = {}
        _store[collection][doc_id] = {**data, "id": doc_id}
    return doc_id


async def get(collection: str, doc_id: str) -> Optional[dict]:
    db = get_db()
    if db:
        doc = db.collection(collection).document(doc_id).get()
        return doc.to_dict() if doc.exists else None
    return _store.get(collection, {}).get(doc_id)


async def update(collection: str, doc_id: str, data: dict) -> None:
    db = get_db()
    data["updated_at"] = datetime.utcnow().isoformat()
    if db:
        db.collection(collection).document(doc_id).update(data)
    else:
        existing = _store.get(collection, {}).get(doc_id, {})
        existing.update(data)
        if collection not in _store:
            _store[collection] = {}
        _store[collection][doc_id] = existing


async def query(collection: str, filters: dict) -> list[dict]:
    db = get_db()
    if db:
        ref = db.collection(collection)
        for field, value in filters.items():
            ref = ref.where(field, "==", value)
        return [doc.to_dict() for doc in ref.stream()]
    # インメモリフィルタ
    docs = list(_store.get(collection, {}).values())
    for field, value in filters.items():
        docs = [d for d in docs if d.get(field) == value]
    return docs


def new_id() -> str:
    return str(uuid.uuid4())

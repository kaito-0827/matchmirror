"""監査ログの記録。"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from app.db import firestore
import logging

logger = logging.getLogger(__name__)


async def log(
    actor_id: str,
    action: str,
    target: str,
    metadata: Optional[dict] = None,
) -> None:
    try:
        log_id = firestore.new_id()
        await firestore.save("auditLogs", log_id, {
            "actor_id": actor_id,
            "action": action,
            "target": target,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
        })
    except Exception as e:
        logger.error(f"Audit log failed: {e}")

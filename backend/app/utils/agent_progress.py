from __future__ import annotations
"""
Agent Console 用の進捗トラッキング。

レポート生成(POST /api/diagnosis/sessions/{session_id}/report)やAutopilot
(POST /api/reports/{report_id}/autopilot)は数十秒かかる同期処理だが、
Cloud Runの制約（リクエスト処理外のCPUはスロットリングされる）により
バックグラウンドタスク方式にはできない。そのため、POSTハンドラ内で
処理段階ごとに本モジュールを使って進捗ドキュメントを書き込み、
フロントはPOSTを投げたまま並行して進捗GETをポーリングする。

ドキュメントは `agentProgress` コレクションに
`report:{session_id}` / `autopilot:{report_id}` のIDで保存する。
既存の firestore.save/get/update を使うため、in-memory/Firestoreの
どちらでも自動的に動作する。

進捗の記録はあくまで表示用の副次的な処理であり、書き込みに失敗しても
レポート生成本体には影響させない（呼び出し側で例外を握りつぶす）。
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from app.db import firestore

logger = logging.getLogger(__name__)

COLLECTION = "agentProgress"


def _doc_id(kind: str, key: str) -> str:
    return f"{kind}:{key}"


def _now() -> str:
    # timezone-aware UTC (with '+00:00' offset) — a naive isoformat() string
    # (no offset/Z suffix) gets parsed as LOCAL time by the frontend's
    # `new Date(startedAt)`, which on non-UTC machines (e.g. JST) produces
    # a bogus elapsed-time delta when diffed against Date.now().
    return datetime.now(timezone.utc).isoformat()


async def start(kind: str, key: str, steps: list[dict]) -> None:
    """全stepをwaitingで初期化し、statusをrunningにする。"""
    try:
        doc_steps = [
            {
                "id": s["id"],
                "agent": s["agent"],
                "label": s["label"],
                "status": "waiting",
                "started_at": None,
                "finished_at": None,
            }
            for s in steps
        ]
        await firestore.save(COLLECTION, _doc_id(kind, key), {
            "kind": kind,
            "status": "running",
            "steps": doc_steps,
            "updated_at": _now(),
        })
    except Exception as e:
        logger.warning(f"agent_progress.start failed ({kind}:{key}): {e}")


async def _update_step(kind: str, key: str, step_id: Optional[str], **fields) -> None:
    try:
        doc = await firestore.get(COLLECTION, _doc_id(kind, key))
        if not doc:
            return
        steps = doc.get("steps", [])
        changed = False
        for s in steps:
            if step_id is None or s.get("id") == step_id:
                s.update(fields)
                changed = True
        if not changed:
            return
        await firestore.save(COLLECTION, _doc_id(kind, key), {
            **doc,
            "steps": steps,
            "updated_at": _now(),
        })
    except Exception as e:
        logger.warning(f"agent_progress step update failed ({kind}:{key}, step={step_id}): {e}")


async def step_running(kind: str, key: str, step_id: str) -> None:
    """指定stepをrunningにする（複数呼べば同時に複数stepをrunning化できる=並列実行の表現）。"""
    await _update_step(kind, key, step_id, status="running", started_at=_now())


async def step_done(kind: str, key: str, step_id: str) -> None:
    await _update_step(kind, key, step_id, status="done", finished_at=_now())


async def finish(kind: str, key: str) -> None:
    """全処理完了。ドキュメント全体のstatusをdoneにする。"""
    try:
        doc = await firestore.get(COLLECTION, _doc_id(kind, key))
        if not doc:
            return
        await firestore.save(COLLECTION, _doc_id(kind, key), {
            **doc,
            "status": "done",
            "updated_at": _now(),
        })
    except Exception as e:
        logger.warning(f"agent_progress.finish failed ({kind}:{key}): {e}")


async def fail(kind: str, key: str, step_id: Optional[str] = None) -> None:
    """処理失敗。該当step（分からなければ現在runningのstep全て）をfailedにし、全体もfailedにする。"""
    try:
        doc = await firestore.get(COLLECTION, _doc_id(kind, key))
        if not doc:
            return
        steps = doc.get("steps", [])
        for s in steps:
            if step_id is not None:
                if s.get("id") == step_id:
                    s["status"] = "failed"
                    s["finished_at"] = _now()
            else:
                if s.get("status") == "running":
                    s["status"] = "failed"
                    s["finished_at"] = _now()
        await firestore.save(COLLECTION, _doc_id(kind, key), {
            **doc,
            "status": "failed",
            "steps": steps,
            "updated_at": _now(),
        })
    except Exception as e:
        logger.warning(f"agent_progress.fail failed ({kind}:{key}): {e}")


async def get(kind: str, key: str) -> Optional[dict]:
    try:
        return await firestore.get(COLLECTION, _doc_id(kind, key))
    except Exception as e:
        logger.warning(f"agent_progress.get failed ({kind}:{key}): {e}")
        return None

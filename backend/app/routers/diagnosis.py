from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.diagnosis import (
    DiagnosisSessionCreate,
    SessionCreateResponse,
    MessageRequest,
    MessageResponse,
    SessionStatus,
    ChatMessage,
    MessageRole,
)
from app.agents import candidate_agent
from app.db import firestore
from app.utils import audit
from datetime import datetime

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])

TOTAL_QUESTIONS = 5


@router.post("/sessions", response_model=SessionCreateResponse)
async def create_session(body: DiagnosisSessionCreate):
    """
    候補者診断セッションを開始する。
    CandidateAgentが最初の質問を返す。
    """
    session_id = firestore.new_id()
    first_question = candidate_agent.get_next_question(0)

    initial_message = {
        "role": "ai",
        "text": "こんにちは！MatchMirrorの相性診断を始めます。いくつか質問に答えていただくことで、あなたの希望と企業実態のズレを可視化します。",
        "timestamp": datetime.utcnow().isoformat(),
        "extracted_signals": [],
    }
    first_q_message = {
        "role": "ai",
        "text": first_question,
        "timestamp": datetime.utcnow().isoformat(),
        "extracted_signals": [],
    }

    await firestore.save("diagnosisSessions", session_id, {
        "user_id": body.user_id,
        "job_id": body.job_id,
        "status": SessionStatus.active,
        "messages": [initial_message, first_q_message],
        "extracted_signals": [],
        "question_index": 0,
        "deep_dive_count": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    })

    await audit.log(body.user_id, "session_created", session_id)
    return SessionCreateResponse(session_id=session_id, first_question=first_question)


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse)
async def add_message(session_id: str, body: MessageRequest):
    """
    候補者回答を保存し、次の質問を返す。
    CandidateAgentがシグナルを抽出する。
    """
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    if session["status"] != SessionStatus.active:
        raise HTTPException(status_code=400, detail="このセッションは終了しています")

    messages = session.get("messages", [])
    question_index = session.get("question_index", 0)

    user_msg = {
        "role": "user",
        "text": body.text,
        "timestamp": datetime.utcnow().isoformat(),
        "extracted_signals": [],
    }
    messages.append(user_msg)

    signals = await candidate_agent.extract_signals(messages, body.text)
    all_signals = list(set(session.get("extracted_signals", []) + signals))
    user_msg["extracted_signals"] = signals

    next_index = question_index + 1
    is_complete = next_index >= TOTAL_QUESTIONS
    next_question = (
        "ありがとうございました。診断レポートを生成できます。"
        if is_complete
        else candidate_agent.get_next_question(next_index)
    )

    ai_msg = {
        "role": "ai",
        "text": next_question,
        "timestamp": datetime.utcnow().isoformat(),
        "extracted_signals": [],
    }
    messages.append(ai_msg)

    new_status = SessionStatus.completed if is_complete else SessionStatus.active
    await firestore.update("diagnosisSessions", session_id, {
        "messages": messages,
        "extracted_signals": all_signals,
        "question_index": next_index,
        "status": new_status,
    })

    quick_replies = _get_quick_replies(next_index) if not is_complete else []
    return MessageResponse(
        next_question=next_question,
        extracted_signals=all_signals,
        progress=min(int((next_index / TOTAL_QUESTIONS) * 100), 100),
        is_complete=is_complete,
        quick_replies=quick_replies,
    )


@router.post("/sessions/{session_id}/deep-dive")
async def deep_dive(session_id: str):
    """
    追加の深掘り質問を生成する。既存のシグナルを元に動的な質問を返す。
    question_index は進めない（is_complete に影響しない）。
    """
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")

    deep_dive_count = session.get("deep_dive_count", 0)
    if deep_dive_count >= 3:
        raise HTTPException(status_code=400, detail="深掘り質問は最大3回までです")

    messages = session.get("messages", [])
    signals = session.get("extracted_signals", [])

    # 最も懸念が高い軸を推定（シグナルから簡易判定）
    priority_axis = _infer_priority_axis(signals)

    question = await candidate_agent.generate_deep_dive_question(
        conversation_history=messages,
        priority_axis=priority_axis,
        extracted_signals=signals,
    )

    ai_msg = {
        "role": "ai",
        "text": question,
        "timestamp": datetime.utcnow().isoformat(),
        "extracted_signals": [],
        "is_deep_dive": True,
    }
    messages.append(ai_msg)

    # セッションをアクティブに戻す（completed でも追質問できる）
    await firestore.update("diagnosisSessions", session_id, {
        "messages": messages,
        "deep_dive_count": deep_dive_count + 1,
        "status": SessionStatus.active,
    })

    return {
        "question": question,
        "priority_axis": priority_axis,
        "deep_dive_count": deep_dive_count + 1,
        "remaining": 3 - (deep_dive_count + 1),
    }


@router.post("/sessions/{session_id}/reopen")
async def reopen_session(session_id: str):
    """
    診断セッションをリセットし、最初からやり直す。
    シグナル・履歴をクリアして初期状態に戻す。
    """
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")

    first_question = candidate_agent.get_next_question(0)
    initial_messages = [
        {
            "role": "ai",
            "text": "診断をリセットしました。最初からお答えください。",
            "timestamp": datetime.utcnow().isoformat(),
            "extracted_signals": [],
        },
        {
            "role": "ai",
            "text": first_question,
            "timestamp": datetime.utcnow().isoformat(),
            "extracted_signals": [],
        },
    ]

    await firestore.update("diagnosisSessions", session_id, {
        "messages": initial_messages,
        "extracted_signals": [],
        "question_index": 0,
        "deep_dive_count": 0,
        "status": SessionStatus.active,
    })

    return {
        "session_id": session_id,
        "first_question": first_question,
        "message": "診断をリセットしました",
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """診断セッションを取得する。"""
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    return session


def _get_quick_replies(question_index: int) -> list[str]:
    replies_by_q = [
        ["有休を取りやすいか", "OJT体制が充実しているか", "残業が少ないか", "企画業務の比率"],
        ["成長できる環境", "安定した仕事", "裁量を持って働きたい", "チームワーク重視"],
        ["週2〜3リモート希望", "フルリモート希望", "出社中心でいい", "残業は月20時間以内希望"],
        ["指示待ちの文化は避けたい", "体育会系は避けたい", "個人プレー重視は避けたい"],
        ["専門性を高めたい", "マネジメントに挑戦したい", "新規事業に携わりたい", "安定したキャリアを積みたい"],
    ]
    if question_index < len(replies_by_q):
        return replies_by_q[question_index]
    return []


def _infer_priority_axis(signals: list[str]) -> str:
    """シグナルから最も懸念の高い軸を簡易推定する。"""
    axis_keywords = {
        "文化・価値観": ["OJT", "育成", "文化", "自走", "体育会", "心理的安全"],
        "働き方": ["残業", "リモート", "テレワーク", "出社", "フレックス"],
        "条件・制度": ["有休", "休暇", "給与", "評価", "ボーナス"],
        "仕事内容": ["企画", "運用", "業務", "タスク", "業界"],
        "成長・キャリア": ["成長", "キャリア", "スキル", "昇格", "異動"],
        "不安・未確認点": ["不安", "確認", "わからない", "懸念"],
    }
    counts = {axis: 0 for axis in axis_keywords}
    for signal in signals:
        for axis, keywords in axis_keywords.items():
            if any(kw in signal for kw in keywords):
                counts[axis] += 1
    return max(counts, key=counts.get) if any(counts.values()) else "不安・未確認点"

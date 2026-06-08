"""
CandidateAgent: 候補者の希望・不安・価値観を対話で抽出する。
チャット回答から CandidatePreferenceProfile を生成する。
"""
from typing import List
from app.agents.base import call_gemini, parse_json_response
import logging

logger = logging.getLogger(__name__)

QUESTIONS = [
    "入社後に特に不安なことを3つまで教えてください。",
    "仕事で最も大切にしていることは何ですか？（例: 成長、安定、裁量、人間関係など）",
    "希望する働き方について教えてください。（残業・リモート・出社頻度など）",
    "過去の経験や今の状況から、避けたい職場環境はありますか？",
    "入社後1〜3年でどのようなキャリアを描いていますか？",
]


def get_next_question(question_index: int) -> str:
    if question_index < len(QUESTIONS):
        return QUESTIONS[question_index]
    return "ありがとうございました。診断レポートを生成できます。"


async def extract_signals(
    conversation_history: List[dict],
    latest_answer: str,
) -> List[str]:
    """
    ユーザーの回答から候補者シグナル（希望・不安の観点）を抽出する。
    """
    history_text = "\n".join(
        f"{'AI' if m['role'] == 'ai' else '候補者'}: {m['text']}"
        for m in conversation_history[-6:]
    )
    prompt = f"""
あなたはMatchMirrorのCandidateAgentです。候補者の回答から、
ミスマッチ診断に使う具体的な観点（シグナル）を抽出してください。

## 会話履歴
{history_text}

## 最新の回答
{latest_answer}

## 出力形式（JSON）
{{
  "signals": ["観点1", "観点2", "観点3"],
  "priority_axis": "最も重要な軸（仕事内容/働き方/条件・制度/文化・価値観/成長・キャリア/不安・未確認点）",
  "anxiety_level": "高/中/低",
  "key_concern": "最も重要な懸念の1行要約"
}}

シグナルは「丁寧なOJT希望」「有休取得しやすさ重視」など具体的に。最大5つ。
JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        return data.get("signals", [])
    except Exception as e:
        logger.error(f"CandidateAgent signal extraction failed: {e}")
        return _extract_mock_signals(latest_answer)


def _extract_mock_signals(text: str) -> List[str]:
    """キーワードベースのフォールバック抽出。"""
    signals = []
    keyword_map = {
        "OJT": "丁寧なOJT希望",
        "有休": "有休運用の確認が必要",
        "残業": "残業時間の確認が必要",
        "企画": "企画業務比率の確認が必要",
        "リモート": "リモートワーク可否の確認",
        "評価": "評価制度の透明性確認",
        "文化": "職場文化・チーム相性の確認",
        "育成": "育成・成長支援の確認",
    }
    for kw, signal in keyword_map.items():
        if kw in text:
            signals.append(signal)
    return signals[:5] if signals else ["希望・不安の観点を抽出中"]

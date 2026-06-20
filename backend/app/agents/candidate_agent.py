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


async def generate_deep_dive_question(
    conversation_history: List[dict],
    priority_axis: str,
    extracted_signals: List[str],
) -> str:
    """
    既存の回答を踏まえて、より深掘りする追質問を生成する。
    固定リストではなく文脈に応じた動的な質問。
    """
    history_text = "\n".join(
        f"{'AI' if m['role'] == 'ai' else '候補者'}: {m['text']}"
        for m in conversation_history[-10:]
    )
    signals_text = "\n".join(f"- {s}" for s in extracted_signals)
    prompt = f"""
あなたはMatchMirrorのCandidateAgentです。候補者がすでに5つの質問に答えた後、
より深掘りするための追加質問を1つだけ生成してください。

## 会話履歴
{history_text}

## 抽出済みシグナル
{signals_text}

## 深掘り対象の軸
{priority_axis}

ルール:
- 既に聞いたことと重複しない
- 「{priority_axis}」の軸についてより具体的な情報を引き出す
- 「はい/いいえ」で答えられない開かれた質問
- 1文・50字以内

質問文のみ返してください（JSONではない）。
"""
    try:
        text = await call_gemini(prompt)
        return text.strip()
    except Exception as e:
        logger.error(f"CandidateAgent deep dive failed: {e}")
        return _mock_deep_dive_question(priority_axis)


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


def _mock_deep_dive_question(axis: str) -> str:
    axis_questions = {
        "文化・価値観": "チームの意思決定はどのように行われていますか？トップダウンか、メンバーが提案できる文化か教えてください。",
        "働き方": "繁忙期と閑散期の差はどれくらいありますか？具体的な月や時期があれば教えてください。",
        "成長・キャリア": "入社後2〜3年で、同じポジションの方がどのようなキャリアに進むことが多いですか？",
        "条件・制度": "評価面談はどのくらいの頻度で行われますか？フィードバックの受け取り方を教えてください。",
        "仕事内容": "1週間の典型的なスケジュールを教えていただけますか？会議と実作業の割合など。",
        "不安・未確認点": "入社後に「思っていたのと違った」と感じることが多いのはどんな点ですか？",
    }
    return axis_questions.get(axis, "入社してから最初の3ヶ月で、特に大変だと感じることはどんなことですか？")

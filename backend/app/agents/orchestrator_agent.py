"""
OrchestratorAgent: 診断結果から「次に何をすべきか」を自律的に判断する。

判断ロジック自体（確認質問を優先するか／フォロー計画に直接進むか、どの軸を
重点的に確認すべきか）はスコアとギャップから決定論的に算出する。Geminiは
その判断理由を候補者に伝わる自然文に変換する役割のみを担い、失敗時は
テンプレート文にフォールバックする（API未設定でも一気通貫フローが成立する）。
"""
from typing import List
from app.agents.base import call_gemini, parse_json_response
import logging

logger = logging.getLogger(__name__)

WEAK_SCORE_THRESHOLD = 60
HIGH_SEVERITY = "high"


def _decide_focus(axis_scores: List[dict], gaps: List[dict]) -> dict:
    """スコアの低い軸・深刻なギャップから、次のアクションと重点軸を決定する。"""
    weak_axes = sorted(
        [a for a in axis_scores if a.get("score", 100) < WEAK_SCORE_THRESHOLD],
        key=lambda a: a.get("score", 100),
    )
    high_severity_axes = [g.get("axis") for g in gaps if g.get("severity") == HIGH_SEVERITY]

    focus_axes: List[str] = []
    for axis in [a["axis"] for a in weak_axes] + high_severity_axes:
        if axis and axis not in focus_axes:
            focus_axes.append(axis)
    focus_axes = focus_axes[:3]

    action = "ask_questions_first" if focus_axes else "build_plan_directly"
    return {"action": action, "focus_axes": focus_axes}


async def decide_followup_strategy(
    axis_scores: List[dict],
    gaps: List[dict],
    confidence: float,
) -> dict:
    """軸スコア・ギャップ・信頼度から、次に取るべきアクションを自律的に判断する。"""
    decision = _decide_focus(axis_scores, gaps)
    action = decision["action"]
    focus_axes = decision["focus_axes"]

    prompt = f"""
あなたはMatchMirrorのOrchestratorAgentです。診断結果から、次のアクションを
すでに以下のロジックで決定しました。この判断理由を候補者に伝わる自然な日本語1〜2文で説明してください。

## 軸スコア
{axis_scores}

## 検出されたギャップ（軸・タイトル・深刻度）
{[{"axis": g.get("axis"), "title": g.get("title"), "severity": g.get("severity")} for g in gaps]}

## 信頼度
{confidence}

## 決定済みアクション
{action}（重点軸: {", ".join(focus_axes) if focus_axes else "なし"}）

ルール:
- 断定せず「確認推奨」の立場を保つ
- 重点軸がある場合はその軸名を文中に必ず含める
- 採用合否の話はしない

## 出力形式（JSON）
{{"reasoning": "説明文"}}

JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        # Geminiが太字記号(**)を混ぜることがあり、UIはプレーンテキスト表示のため除去する
        reasoning = (data.get("reasoning") or "").replace("**", "").strip() \
            or _mock_reasoning(action, focus_axes)
    except Exception as e:
        logger.error(f"OrchestratorAgent reasoning failed: {e}")
        reasoning = _mock_reasoning(action, focus_axes)

    return {"action": action, "reasoning": reasoning, "focus_axes": focus_axes}


def _mock_reasoning(action: str, focus_axes: List[str]) -> str:
    if action == "ask_questions_first":
        axes_text = "・".join(focus_axes)
        return f"{axes_text}の軸でスコアが低く、確認すべき論点が見つかったため、面談での確認質問を優先し、その内容を踏まえたフォロー計画を提案します。"
    return "現時点で大きなズレは見つからなかったため、確認質問よりも入社前後のフォロー計画作成を優先します。"

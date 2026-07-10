"""
MismatchAgent: 企業実態と候補者希望を6軸で照合し、ズレを検出する。
スコア・懸念理由・信頼度・根拠（evidence）を算出する。
"""
from typing import List
from app.agents.base import call_gemini, parse_json_response
from app.models.report import AxisScore, GapItem, MatchItem, RiskLevel, EvidenceItem, GapResolution
import logging

logger = logging.getLogger(__name__)

AXES = ["仕事内容", "働き方", "条件・制度", "文化・価値観", "成長・キャリア", "不安・未確認点"]

COLOR_MAP = {
    "high": "#00847f",
    "medium": "#dc8a14",
    "low": "#d12e33",
}


async def run_mismatch_analysis(
    company_profile: dict,
    candidate_signals: List[str],
    conversation_messages: List[dict],
    post_interview_context: str = "",
) -> dict:
    """
    企業実態プロファイルと候補者シグナルを照合し、診断結果を返す。
    post_interview_context: 面談後フィードバックを合成した追加文脈
    """
    signal_text = "\n".join(f"- {s}" for s in candidate_signals)
    history_text = "\n".join(
        f"{'AI' if m['role'] == 'ai' else '候補者'}: {m['text']}"
        for m in conversation_messages[-8:]
    )
    post_interview_section = f"\n## 面談後フィードバック\n{post_interview_context}" if post_interview_context else ""
    prompt = f"""
あなたはMatchMirrorのMismatchAgentです。企業実態と候補者希望を6軸で照合し、
合う点・ズレる点・スコア・根拠を生成してください。

重要ルール:
- 照合の6軸は必ず「仕事内容」「働き方」「条件・制度」「文化・価値観」「成長・キャリア」「不安・未確認点」の名称をそのまま使う（独自の軸名を作らない）
- スコアは0-100の「一致度」。100に近いほど企業実態と候補者希望がよく一致し、低いほど面談で確認すべき論点が多い
- matchesに挙げた軸のスコアは高く（70以上）、severityがhighのgapがある軸のスコアは低く（50未満）なるよう、スコアとgaps/matchesを必ず整合させる
- スコアは採用合否ではない。低スコアは不合格ではなく「確認が必要な論点が多い」を意味する
- 差別的属性（年齢・性別・健康・家族構成）は一切使わない
- 断定ではなく「確認推奨」として表現する
- evidenceには企業実態からの引用と候補者発言からの引用を必ず入れる
- 面談後フィードバックが提供されている場合、確認済み論点はスコアを上げる

## 企業実態プロファイル
{company_profile}

## 候補者シグナル
{signal_text}

## 会話履歴
{history_text}{post_interview_section}

## 出力形式（JSON）
{{
  "overall_score": 0-100の整数（6軸の一致度の総合。高いほどよく一致）,
  "confidence": 0.0-1.0,
  "axis_scores": [
    {{
      "axis": "仕事内容",
      "score": 0-100（一致度。高いほど一致、低いほど要確認）,
      "summary": "一致度の理由を1文で"
    }},
    ... (全6軸)
  ],
  "gaps": [
    {{
      "axis": "軸名",
      "title": "ズレのタイトル",
      "detail": "具体的な説明（断定しない）",
      "severity": "high/medium/low",
      "recommended_question": "面談で確認すべき質問",
      "evidence": {{
        "company_quote": "企業実態の記述から引用（20字以内）",
        "candidate_quote": "候補者の発言・シグナルから引用（20字以内）"
      }}
    }}
  ],
  "matches": [
    {{
      "axis": "軸名",
      "title": "合う点のタイトル",
      "detail": "具体的な説明"
    }}
  ],
  "candidate_summary": "候補者向けサマリー（採用判断ではなく確認論点として）"
}}

JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        return _normalize_report(data)
    except Exception as e:
        logger.error(f"MismatchAgent failed: {e}")
        return _mock_report(candidate_signals)


def _normalize_report(data: dict) -> dict:
    """スコアに応じてカラーを付与し、型を正規化する。"""
    for ax in data.get("axis_scores", []):
        score = ax.get("score", 50)
        if score >= 70:
            ax["color"] = "#00847f"
        elif score >= 50:
            ax["color"] = "#dc8a14"
        else:
            ax["color"] = "#d12e33"
    return data


def _mock_report(signals: List[str]) -> dict:
    has_ojt = any("OJT" in s or "育成" in s for s in signals)
    has_leave = any("有休" in s or "休暇" in s for s in signals)

    return {
        "overall_score": 61,
        "confidence": 0.75,
        "axis_scores": [
            {"axis": "仕事内容", "score": 82, "color": "#00847f", "summary": "企画業務希望と一致度が高い"},
            {"axis": "働き方", "score": 58, "color": "#dc8a14", "summary": "残業・リモート条件の確認が必要"},
            {"axis": "条件・制度", "score": 74, "color": "#00847f", "summary": "給与水準は概ね一致"},
            {"axis": "文化・価値観", "score": 41 if has_ojt else 55, "color": "#d12e33" if has_ojt else "#dc8a14", "summary": "OJT期待と自走文化に差分あり" if has_ojt else "文化適合性の確認推奨"},
            {"axis": "成長・キャリア", "score": 65, "color": "#dc8a14", "summary": "成長機会はあるが育成体制の確認が必要"},
            {"axis": "不安・未確認点", "score": 48, "color": "#dc8a14", "summary": "複数の未確認論点が存在する"},
        ],
        "gaps": [
            {
                "axis": "文化・価値観",
                "title": "OJT期待と自走文化に差分",
                "detail": "丁寧なOJTを希望されていますが、企業は自走重視の文化です。入社後の育成体制について面談で確認することを推奨します。",
                "severity": "high" if has_ojt else "medium",
                "recommended_question": "入社後1カ月は誰にどの頻度で相談できますか？",
                "evidence": {
                    "company_quote": "入社初月から実業務アサイン",
                    "candidate_quote": "丁寧なOJT希望",
                },
            },
            *(
                [{
                    "axis": "条件・制度",
                    "title": "有休取得しやすさの確認が必要",
                    "detail": "制度は年間20日ありますが、繁忙期の取得状況については運用実態の確認が推奨されます。",
                    "severity": "medium",
                    "recommended_question": "チーム内で有休を取る時の調整方法は？",
                    "evidence": {
                        "company_quote": "繁忙期（3月・9月）",
                        "candidate_quote": "有休取得しやすさ重視",
                    },
                }] if has_leave else []
            ),
        ],
        "matches": [
            {"axis": "仕事内容", "title": "仕事内容の方向性が一致", "detail": "企画寄りの業務を希望されており、企業の業務構成（企画40%）と一致しています。"},
            {"axis": "条件・制度", "title": "給与水準の一致", "detail": "希望年収と提示レンジが近く、大きなギャップはありません。"},
        ],
        "candidate_summary": "仕事内容の方向性は合っていますが、OJT体制と有休運用について面談で確認することをお勧めします。スコアは採用の合否ではなく、確認すべき論点の目安です。",
    }

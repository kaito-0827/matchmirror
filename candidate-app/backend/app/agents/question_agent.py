"""
QuestionAgent: 面接・面談で確認すべき質問を優先度順に生成する。
risk_reason を入力として候補者向け質問・人事向けフォロー観点を生成する。
"""
import uuid
from typing import List
from app.agents.base import call_gemini, parse_json_response
from app.models.report import RecommendedQuestion, RiskLevel
import logging

logger = logging.getLogger(__name__)


async def generate_questions(
    gaps: List[dict],
    company_profile: dict,
    candidate_signals: List[str],
) -> List[RecommendedQuestion]:
    """
    ギャップ情報から面談で確認すべき質問リストを生成する。
    """
    gaps_text = "\n".join(
        f"- [{g.get('severity', 'medium')}] {g.get('axis')}: {g.get('title')}"
        for g in gaps
    )
    signals_text = "\n".join(f"- {s}" for s in candidate_signals)
    prompt = f"""
あなたはMatchMirrorのQuestionAgentです。候補者が面接・面談で確認すべき質問を生成してください。

ルール:
- 質問は候補者が聞きやすい自然な日本語で
- 採用担当者への圧迫ではなく、情報収集のトーンで
- 質問は具体的で1文で完結する
- 差別的・センシティブな属性を含まない

## 検出されたギャップ
{gaps_text}

## 候補者シグナル
{signals_text}

## 企業プロファイル（要約）
{str(company_profile)[:500]}

## 出力形式（JSON）
{{
  "questions": [
    {{
      "axis": "軸名",
      "text": "具体的な質問文",
      "priority": "high/medium/low",
      "background": "なぜこの質問が重要か（1文）"
    }}
  ]
}}

最大6件。priorityはgapのseverityに対応させる。JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        return [
            RecommendedQuestion(
                id=str(uuid.uuid4()),
                axis=q["axis"],
                text=q["text"],
                priority=RiskLevel(q.get("priority", "medium")),
                background=q.get("background"),
            )
            for q in data.get("questions", [])
        ]
    except Exception as e:
        logger.error(f"QuestionAgent failed: {e}")
        return _mock_questions(gaps)


def _mock_questions(gaps: List[dict]) -> List[RecommendedQuestion]:
    questions = [
        RecommendedQuestion(
            id=str(uuid.uuid4()),
            axis="OJT体制",
            text="入社後1カ月は誰にどの頻度で相談できますか？",
            priority=RiskLevel.high,
            background="OJT期待と自走文化のギャップを確認するため",
        ),
        RecommendedQuestion(
            id=str(uuid.uuid4()),
            axis="仕事内容比率",
            text="企画業務と運用業務の比率はどれくらいですか？",
            priority=RiskLevel.high,
            background="希望する業務比率との一致を確認するため",
        ),
        RecommendedQuestion(
            id=str(uuid.uuid4()),
            axis="有休運用",
            text="チーム内で有休を取る時の調整方法は？",
            priority=RiskLevel.medium,
            background="有休制度と運用実態のギャップを確認するため",
        ),
        RecommendedQuestion(
            id=str(uuid.uuid4()),
            axis="評価制度",
            text="入社1年目の評価基準と目標設定のプロセスを教えてください。",
            priority=RiskLevel.medium,
            background="評価の透明性・公平性を確認するため",
        ),
    ]
    return questions

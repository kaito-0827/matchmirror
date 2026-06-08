from __future__ import annotations
"""
CompanyAgent: 企業実態を構造化し、CompanyRealityProfileを生成する。
求人票・制度・現場入力から仕事の現実を整理する。
"""
import json
from typing import List
from app.agents.base import call_gemini, parse_json_response
from app.models.company import CompanyRealityInput
import logging

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ["daily_tasks", "ojt_structure", "leave_reality", "culture_values"]


async def structure_company_reality(inp: CompanyRealityInput) -> dict:
    """
    企業入力データをAIで構造化し、候補者照合用プロファイルを返す。
    """
    prompt = f"""
あなたはMatchMirrorのCompanyAgentです。企業の採用担当者・現場マネージャーが入力した情報を、
候補者との期待値照合に使える構造化データに変換してください。

## 入力情報
- 職種: {inp.job_title}
- 仕事内容の実態: {inp.daily_tasks}
- OJT/育成体制: {inp.ojt_structure}
- 有休・残業の運用実態: {inp.leave_reality}
- 文化・価値観: {inp.culture_values}
- 評価基準: {inp.evaluation_criteria or "未入力"}
- 働き方: {inp.workstyle or "未入力"}

## 出力形式（JSON）
{{
  "job_summary": "職種・役割の1行要約",
  "work_content": {{
    "planning_ratio": "企画業務の割合（例: 40%）",
    "operation_ratio": "運用業務の割合",
    "customer_facing": true/false,
    "autonomy_level": "高/中/低",
    "key_tasks": ["主要タスク1", "主要タスク2"]
  }},
  "work_style": {{
    "overtime_hours_avg": "平均残業時間/月",
    "remote_policy": "リモート可否",
    "busy_seasons": "繁忙期",
    "communication_style": "コミュニケーションスタイル"
  }},
  "leave_conditions": {{
    "leave_ease": "取得しやすさ（高/中/低）",
    "approval_process": "申請プロセス",
    "busy_period_restriction": true/false
  }},
  "culture": {{
    "onboarding_style": "OJT重視/自走重視/バランス型",
    "hierarchy": "フラット/階層的",
    "psychological_safety": "高/中/低",
    "growth_support": "研修・成長支援の内容"
  }},
  "signals": ["候補者に伝えるべき重要シグナル1", "シグナル2"]
}}

JSON のみ返してください。説明文は不要です。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        return parse_json_response(text)
    except Exception as e:
        logger.error(f"CompanyAgent structuring failed: {e}")
        return _mock_structured_data(inp)


def calculate_completeness(inp: CompanyRealityInput) -> tuple[int, List[str]]:
    """入力の充足率と不足フィールドを返す。"""
    field_map = {
        "daily_tasks": "仕事内容の実態",
        "ojt_structure": "OJT/育成体制",
        "leave_reality": "有休・残業の運用実態",
        "culture_values": "文化・価値観",
        "evaluation_criteria": "評価基準",
        "workstyle": "働き方",
    }
    filled = sum(1 for k in field_map if getattr(inp, k, None))
    total = len(field_map)
    missing = [v for k, v in field_map.items() if not getattr(inp, k, None)]
    return int(filled / total * 100), missing


def _mock_structured_data(inp: CompanyRealityInput) -> dict:
    return {
        "job_summary": f"{inp.job_title}ポジションの構造化データ（開発モック）",
        "work_content": {
            "planning_ratio": "40%",
            "operation_ratio": "30%",
            "customer_facing": True,
            "autonomy_level": "中",
            "key_tasks": ["企画立案", "顧客ヒアリング", "資料作成"],
        },
        "work_style": {
            "overtime_hours_avg": "18時間/月",
            "remote_policy": "週2リモート可",
            "busy_seasons": "期末（3月・9月）",
            "communication_style": "Slack中心・週1全体MTG",
        },
        "leave_conditions": {
            "leave_ease": "高",
            "approval_process": "前日申請可",
            "busy_period_restriction": True,
        },
        "culture": {
            "onboarding_style": "自走重視",
            "hierarchy": "フラット",
            "psychological_safety": "中",
            "growth_support": "OJT＋外部研修年2回",
        },
        "signals": [
            "入社初月から実業務アサインされる自走スタイル",
            "繁忙期（3月・9月）は有休取得が難しい場合がある",
        ],
    }

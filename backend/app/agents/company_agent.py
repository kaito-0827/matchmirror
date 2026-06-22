from __future__ import annotations
"""
CompanyAgent: 企業実態を構造化し、CompanyRealityProfileを生成する。
求人票・制度・現場入力から仕事の現実を整理する。
求人票テキストと実態プロファイルのギャップも診断する。
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


async def analyze_posting_gap(posting_text: str, reality_profile: dict) -> dict:
    """
    求人票テキストと登録済み実態プロファイルのギャップを分析する。
    誇張・曖昧・誤解を生みやすい表現を検出する。
    """
    reality_summary = json.dumps(reality_profile, ensure_ascii=False, indent=2)
    prompt = f"""
あなたはMatchMirrorのCompanyAgentです。企業が公開している求人票と、
社内で登録した「実際の職場環境データ」を比較し、候補者が誤解しやすい表現を検出してください。

## 求人票テキスト
{posting_text}

## 登録済み実態プロファイル
{reality_summary}

## 出力形式（JSON）
{{
  "warnings": [
    {{
      "phrase": "求人票の該当フレーズ（20字以内）",
      "issue": "なぜ誤解を生みやすいか（1文）",
      "risk_level": "high/medium/low",
      "suggestion": "改善案（1文）"
    }}
  ],
  "overall_risk": "high/medium/low",
  "summary": "全体的な乖離の概要（2文以内）"
}}

ルール:
- 求人票にあって実態に記述がない場合は「情報不足」として検出
- 実態より過大表現になっている場合は「誇張」として検出
- 曖昧で候補者が期待値を誤りやすいフレーズは「曖昧表現」として検出
- 最大5件のwarnings。JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        return parse_json_response(text)
    except Exception as e:
        logger.error(f"CompanyAgent posting gap analysis failed: {e}")
        return _mock_posting_warnings(posting_text)


AXIS_LABELS = {
    "job_title": "職種・ポジション",
    "daily_tasks": "仕事内容の実態",
    "ojt_structure": "OJT / 育成体制",
    "leave_reality": "有休・残業の運用実態",
    "culture_values": "文化・価値観",
    "evaluation_criteria": "評価基準",
    "workstyle": "働き方",
}


async def extract_reality_from_posting(posting_text: str) -> dict:
    """
    求人票テキストを読み取り、企業実態フォームの7項目を自動入力するための値を抽出する。
    各軸について、求人票の原文引用・記載有無・乖離リスク（誇張/曖昧/情報不足）も併せて返す。
    """
    prompt = f"""
あなたはMatchMirrorのCompanyAgentです。企業が貼り付けた求人票のテキストから、
「企業実態プロファイル」フォームの各項目を自動入力するための値を抽出してください。
同時に、求人票の表現が誇張・曖昧・情報不足になっていないかを軸ごとに診断してください。

## 求人票テキスト
{posting_text}

## フォーム項目（抽出対象）
- job_title: 職種・ポジション
- daily_tasks: 仕事内容の実態（業務構成・主要タスク）
- ojt_structure: OJT/育成体制
- leave_reality: 有休・残業の運用実態
- culture_values: 文化・価値観
- evaluation_criteria: 評価基準
- workstyle: 働き方（出社/リモート/フレックス等）

## 出力形式（JSON）
{{
  "form_fields": {{
    "job_title": "求人票から読み取った職種名",
    "daily_tasks": "読み取った仕事内容の実態（1-2文）",
    "ojt_structure": "読み取ったOJT/育成体制（1-2文）",
    "leave_reality": "読み取った有休・残業の実態（1-2文）",
    "culture_values": "読み取った文化・価値観（1-2文）",
    "evaluation_criteria": "読み取った評価基準（1-2文、記載なければ空文字）",
    "workstyle": "読み取った働き方（1-2文、記載なければ空文字）"
  }},
  "extracted_fields": [
    {{
      "field_key": "daily_tasks",
      "value": "読み取った値（form_fieldsと同じ）",
      "source_quote": "根拠となった求人票内の原文（20-40字）",
      "in_posting": true,
      "divergence_risk": "high/medium/low",
      "divergence_note": "誇張・曖昧・情報不足の注意点（1文。問題なければ空文字）"
    }}
  ],
  "missing_axes": ["求人票に記載がなかった軸のfield_keyリスト"]
}}

ルール:
- extracted_fields は7項目（job_title含む）全てを必ず含める
- 求人票に記載がない軸は in_posting=false、value は "（求人票に記載なし）"、divergence_risk は "medium" 以上
- 「アットホーム」「風通しが良い」等の曖昧語は divergence_risk を high にし、具体化が必要と note に記載
- JSON のみ返してください。説明文は不要です。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        return parse_json_response(text)
    except Exception as e:
        logger.error(f"CompanyAgent posting extraction failed: {e}")
        return _mock_extract_from_posting(posting_text)


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


def _mock_posting_warnings(posting_text: str) -> dict:
    warnings = [
        {
            "phrase": "充実した研修制度",
            "issue": "研修の具体的な内容・頻度が求人票に記載されておらず、OJT体制との乖離が生じやすい",
            "risk_level": "high",
            "suggestion": "「入社後OJT担当者がつき、外部研修は年2回」のように具体化する",
        },
        {
            "phrase": "風通しの良い職場",
            "issue": "曖昧な表現で、実態の心理的安全性レベルと候補者の期待値がずれやすい",
            "risk_level": "medium",
            "suggestion": "「週1の全体MTGで意見を発言できる」など具体的な場面を記述する",
        },
        {
            "phrase": "フレックスタイム制",
            "issue": "繁忙期の有休取得制限が求人票に記載されていないため、柔軟性を過大評価される可能性",
            "risk_level": "medium",
            "suggestion": "「繁忙期（3月・9月）は相談の上での取得になります」と注記を追加する",
        },
    ]
    has_remote = "リモート" in posting_text or "テレワーク" in posting_text
    if has_remote:
        warnings.append({
            "phrase": "リモートワーク可",
            "issue": "「週2リモート可」の実態に対し、求人票の表現が曖昧で「フルリモート可」と誤解される恐れ",
            "risk_level": "high",
            "suggestion": "「週2日までリモート勤務可（試用期間中は原則出社）」と明示する",
        })

    overall_risk = "high" if any(w["risk_level"] == "high" for w in warnings) else "medium"
    return {
        "warnings": warnings,
        "overall_risk": overall_risk,
        "summary": f"{len(warnings)}件の表現で候補者の誤解を招く可能性があります。特に研修体制とリモート勤務の記述を改善することで、入社後のミスマッチリスクを下げられます。",
    }


def _mock_extract_from_posting(posting_text: str) -> dict:
    has_remote = "リモート" in posting_text or "テレワーク" in posting_text
    has_flat = "アットホーム" in posting_text or "風通し" in posting_text
    has_training = "研修" in posting_text or "教育" in posting_text

    form_fields = {
        "job_title": "AIソリューション企画（求人票より抽出・開発モック）",
        "daily_tasks": "企画立案と顧客対応が中心。具体的な比率は求人票に記載なし。",
        "ojt_structure": "研修制度に関する記載あり" if has_training else "OJT/育成体制の記載が求人票になし",
        "leave_reality": "有休・残業時間の具体的な記載なし（求人票では言及なし）",
        "culture_values": "アットホームな職場と記載あり" if has_flat else "文化・価値観の具体的な記載なし",
        "evaluation_criteria": "",
        "workstyle": "リモートワーク可と記載あり" if has_remote else "",
    }

    extracted_fields = [
        {
            "field_key": "job_title",
            "value": form_fields["job_title"],
            "source_quote": posting_text[:30] if posting_text else "",
            "in_posting": True,
            "divergence_risk": "low",
            "divergence_note": "",
        },
        {
            "field_key": "daily_tasks",
            "value": form_fields["daily_tasks"],
            "source_quote": "成長できる環境で活躍",
            "in_posting": True,
            "divergence_risk": "medium",
            "divergence_note": "業務の比率や具体的タスクが曖昧で、入社後の期待値ズレにつながりやすい",
        },
        {
            "field_key": "ojt_structure",
            "value": form_fields["ojt_structure"],
            "source_quote": "充実した研修制度" if has_training else "",
            "in_posting": has_training,
            "divergence_risk": "high" if has_training else "medium",
            "divergence_note": "研修の頻度・期間が不明で、実態とのギャップが生まれやすい" if has_training else "OJT体制の記載がなく、入社後の不安要因になりやすい",
        },
        {
            "field_key": "leave_reality",
            "value": form_fields["leave_reality"],
            "source_quote": "残業はほぼありません" if "残業" in posting_text else "",
            "in_posting": "残業" in posting_text,
            "divergence_risk": "high" if "ほぼありません" in posting_text else "medium",
            "divergence_note": "「ほぼありません」は曖昧で、繁忙期の実態次第で誇張になる可能性がある" if "ほぼありません" in posting_text else "有休取得率や残業時間の具体的な記載がない",
        },
        {
            "field_key": "culture_values",
            "value": form_fields["culture_values"],
            "source_quote": "アットホームな職場です" if has_flat else "",
            "in_posting": has_flat,
            "divergence_risk": "high" if has_flat else "medium",
            "divergence_note": "「アットホーム」は主観的で候補者ごとに解釈が分かれやすい" if has_flat else "文化・価値観の具体的な記載がない",
        },
        {
            "field_key": "evaluation_criteria",
            "value": "（求人票に記載なし）",
            "source_quote": "",
            "in_posting": False,
            "divergence_risk": "medium",
            "divergence_note": "評価基準の記載がなく、候補者が入社後の評価軸を把握できない",
        },
        {
            "field_key": "workstyle",
            "value": form_fields["workstyle"] or "（求人票に記載なし）",
            "source_quote": "リモートワーク可" if has_remote else "",
            "in_posting": has_remote,
            "divergence_risk": "high" if has_remote else "medium",
            "divergence_note": "「リモートワーク可」は頻度が不明で、フルリモートと誤解されやすい" if has_remote else "出社/リモートの実態記載がない",
        },
    ]

    missing_axes = [f["field_key"] for f in extracted_fields if not f["in_posting"]]

    return {
        "form_fields": form_fields,
        "extracted_fields": extracted_fields,
        "missing_axes": missing_axes,
    }

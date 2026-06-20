from __future__ import annotations
"""
InterviewAgent: マッチング成立時に、診断結果から「面談での確認事項」を
双方向け（就活者向け・企業向け）に生成し、企業向け通知文も作る。
1マッチ=1回のGemini呼び出し。失敗/キー無しはルールベースのmockにフォールバック。
"""
import json
import logging
from typing import Any
from app.agents.base import call_gemini, parse_json_response

logger = logging.getLogger(__name__)


async def generate_interview_prep(report: dict, company_profile: dict, candidate_name: str) -> dict:
    """
    候補者の診断レポートと企業実態から、面談メモ（双方向け）＋企業通知文を生成する。
    返り値: {"candidate_prep": [str], "company_prep": [str], "notification": str}
    """
    gaps = report.get("gaps", [])
    matches = report.get("matches", [])
    summary = report.get("candidate_summary", "")
    company_name = company_profile.get("company_name") or "この企業"

    prompt = f"""
あなたはMatchMirrorのInterviewAgentです。就活者と企業がマッチングしました。
診断結果をもとに、面接・面談で確認すべきことを「就活者向け」と「企業向け」の双方で作成し、
さらに企業担当者への通知文を1文作ってください。

## 候補者名
{candidate_name}

## 企業
{company_name}

## 診断サマリー
{summary}

## 確認すべきズレ（gaps）
{json.dumps(gaps, ensure_ascii=False)}

## 合う点（matches）
{json.dumps(matches, ensure_ascii=False)}

## 企業実態
{json.dumps(company_profile, ensure_ascii=False)}

## 出力形式（JSON）
{{
  "candidate_prep": ["面接では〇〇について質問しよう。", ...3〜5件、就活者が面接で確認すべき質問・観点。具体的に],
  "company_prep": ["{candidate_name}さんは〇〇を重視しているので、面接で△△についてお話ししましょう。", ...3〜5件、企業が面接で触れるべき話題。候補者の重視点に寄り添う],
  "notification": "企業担当者への通知文1文（誰がどんな点を重視してマッチしたか＋面接での着目点）"
}}
JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        return _normalize(data, candidate_name, company_name)
    except Exception as e:
        logger.warning(f"InterviewAgent failed, using mock: {e}")
        return _mock_prep(gaps, candidate_name, company_name)


def _normalize(data: dict, candidate_name: str, company_name: str) -> dict:
    cp = data.get("candidate_prep") or []
    co = data.get("company_prep") or []
    note = data.get("notification") or f"{candidate_name}さんからマッチングがありました。"
    return {
        "candidate_prep": [str(x) for x in cp][:5] or _mock_prep([], candidate_name, company_name)["candidate_prep"],
        "company_prep": [str(x) for x in co][:5] or _mock_prep([], candidate_name, company_name)["company_prep"],
        "notification": str(note),
    }


def _mock_prep(gaps: list, candidate_name: str, company_name: str) -> dict:
    axes = [g.get("axis", "働き方") for g in gaps[:3]] or ["働き方", "文化・価値観", "成長・キャリア"]
    candidate_prep = [f"面接では「{ax}」について実際の運用を質問しよう。" for ax in axes]
    candidate_prep.append("入社後すぐの具体的なサポート体制を確認しよう。")
    company_prep = [f"{candidate_name}さんは「{ax}」を重視しているので、面接で実態を丁寧に説明しましょう。" for ax in axes]
    company_prep.append(f"{candidate_name}さんの不安点に先回りして、入社後の流れを共有しましょう。")
    notification = f"{candidate_name}さんが{company_name}にマッチングしました。面接では{('・'.join(axes))}について確認するのがおすすめです。"
    return {"candidate_prep": candidate_prep[:5], "company_prep": company_prep[:5], "notification": notification}

from __future__ import annotations
"""
GuardrailAgent: AI出力の差別性・断定表現・個人情報過剰露出を検査する。
不適切な場合は修正指示を生成し、公開可否を判定する。
"""
from dataclasses import dataclass
from typing import Optional
from app.agents.base import call_gemini, parse_json_response
import re
import logging

logger = logging.getLogger(__name__)

# 採用差別につながる禁止属性パターン
PROHIBITED_PATTERNS = [
    r"年齢\s*[0-9]",
    r"性別",
    r"既婚|未婚|配偶者",
    r"妊娠|出産|育児",
    r"障害|病気|健康状態",
    r"国籍|出身国",
    r"合格|不合格|採用見送り|採用決定",
    r"この候補者は採用[すべき|不適切]",
]


@dataclass
class GuardrailResult:
    passed: bool
    issues: list[str]
    safe_version: Optional[str]
    action: str


async def check_output(ai_output: str, context: str = "") -> GuardrailResult:
    """
    AI出力を検査し、問題があれば安全な表現に修正する。
    """
    issues = _rule_based_check(ai_output)
    if not issues:
        return GuardrailResult(passed=True, issues=[], safe_version=None, action="pass")

    safe_version = await _generate_safe_version(ai_output, issues)
    return GuardrailResult(
        passed=False,
        issues=issues,
        safe_version=safe_version,
        action="rewrite",
    )


async def check_gaps(gaps: list[dict]) -> list[str]:
    """
    GapItem リストのテキスト（title/detail/evidence）をルールベースで一括検査する。
    問題が見つかったギャップの index と検出パターンを返す。
    """
    all_issues = []
    for i, gap in enumerate(gaps):
        combined = " ".join(filter(None, [
            gap.get("title", ""),
            gap.get("detail", ""),
            gap.get("recommended_question", ""),
            (gap.get("evidence") or {}).get("company_quote", ""),
            (gap.get("evidence") or {}).get("candidate_quote", ""),
        ]))
        issues = _rule_based_check(combined)
        for issue in issues:
            all_issues.append(f"gap[{i}] {gap.get('title', '')}: {issue}")
    return all_issues


def _rule_based_check(text: str) -> list[str]:
    issues = []
    for pattern in PROHIBITED_PATTERNS:
        if re.search(pattern, text):
            issues.append(f"禁止パターン検出: {pattern}")
    if len(text) > 500 and "個人情報" in text:
        issues.append("個人情報の過剰露出の可能性")
    return issues


async def _generate_safe_version(original: str, issues: list[str]) -> str:
    issues_text = "\n".join(f"- {i}" for i in issues)
    prompt = f"""
あなたはMatchMirrorのGuardrailAgentです。以下のAI出力に問題が検出されました。
職務関連要件と本人回答のみに基づいた安全な表現に修正してください。

## 検出された問題
{issues_text}

## 元の出力
{original}

## ルール
- 採用の合否・推薦・排除の表現を削除する
- 差別的属性（年齢・性別・家族・健康）を削除する
- 「確認推奨」「面談で確認してください」などの確認論点として表現する
- 元の情報の本質（どの軸に差分があるか）は保持する

修正後のテキストのみ返してください。
"""
    try:
        return await call_gemini(prompt)
    except Exception:
        return "採用判断ではなく、面談で確認してください。"

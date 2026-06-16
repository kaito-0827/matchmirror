from __future__ import annotations
"""
RecommendAgent: 候補者の診断シグナルから「合う企業」をランキングする。

100社へのGemini呼び出しは行わず、会社metadataとのルールベース照合で高速に
スコアリングする。上位N社のみ、1回のGemini呼び出しで自然文の理由を生成する
（失敗・APIキー無しはルール理由にフォールバック）。
"""
import json
import logging
from typing import List, Optional
from app.agents.base import call_gemini, parse_json_response

logger = logging.getLogger(__name__)

# 希望次元（candidate signal / priority axis から検出する）
# dim: (シグナル検出キーワード, 理由テンプレ)
DIMENSIONS = [
    "low_overtime", "easy_leave", "remote", "onsite", "ojt", "autonomy",
    "stable", "growth", "flat", "teamwork", "global",
]

SIGNAL_KEYWORDS = {
    "low_overtime": ["残業", "ワークライフ", "定時", "長時間"],
    "easy_leave": ["有休", "有給", "休暇", "休み"],
    "remote": ["リモート", "在宅", "テレワーク"],
    "onsite": ["出社", "通勤", "対面", "オフィスで"],
    "ojt": ["OJT", "育成", "研修", "手厚", "メンター", "サポート", "教育"],
    "autonomy": ["裁量", "自走", "挑戦", "主体"],
    "stable": ["安定", "堅実", "長く", "腰を据え"],
    "growth": ["成長", "スキル", "キャリア", "専門", "学び"],
    "flat": ["フラット", "風通し", "オープン", "相談しやすい", "意見"],
    "teamwork": ["チーム", "協力", "人間関係", "仲間", "助け合"],
    "global": ["グローバル", "英語", "海外", "多様"],
}

# priority_axis → 関連次元（弱めに活性化。診断未実施でも軸選択でランキング可能に）
AXIS_DIMS = {
    "働き方": ["low_overtime", "remote", "easy_leave"],
    "条件・制度": ["easy_leave", "stable"],
    "文化・価値観": ["flat", "teamwork", "autonomy", "stable", "global"],
    "成長・キャリア": ["growth", "ojt"],
    "仕事内容": ["autonomy"],
}

REASON_TEMPLATES = {
    "low_overtime": "残業が少なめ（{overtime}）で、働き方の希望に合致",
    "easy_leave": "有休を取得しやすい（取得しやすさ:{leave}）",
    "remote": "{remote}で柔軟に働ける",
    "onsite": "{remote}で対面コミュニケーションが取りやすい",
    "ojt": "OJT・育成体制が手厚い",
    "autonomy": "裁量・自走を重んじる文化",
    "stable": "安定・堅実な基盤で長く働ける",
    "growth": "専門性・挑戦を後押しする成長環境",
    "flat": "フラットで風通しの良い文化",
    "teamwork": "チームワーク重視の風土",
    "global": "グローバル・多様性に寛容",
}


def _detect_desired(signals: List[str], priority_axes: List[str]) -> dict:
    """希望次元 → 重み を返す。signal=1.0、axis=0.6（重複は加算）。"""
    desired: dict[str, float] = {}
    joined = " ".join(signals or [])
    for dim, kws in SIGNAL_KEYWORDS.items():
        if any(kw in joined for kw in kws):
            desired[dim] = desired.get(dim, 0.0) + 1.0
    for axis in priority_axes or []:
        for dim in AXIS_DIMS.get(axis, []):
            desired[dim] = desired.get(dim, 0.0) + 0.6
    return desired


def _match(dim: str, md: dict, cp: dict) -> float:
    """会社が次元をどれだけ満たすか [-1, +1]。"""
    overtime = md.get("overtime_band", "")
    leave = md.get("leave_ease", "")
    remote = md.get("remote_policy", "")
    tags = md.get("culture_tags", []) or []
    size = md.get("size_band", "")
    ojt = cp.get("ojt_structure", "") or ""
    daily = cp.get("daily_tasks", "") or ""

    if dim == "low_overtime":
        return {"ほぼなし": 1.0, "少なめ": 0.6, "標準": 0.0, "やや多め": -0.6, "繁忙期集中": -0.4}.get(overtime, 0.0)
    if dim == "easy_leave":
        return {"高": 1.0, "中": 0.0, "低": -1.0}.get(leave, 0.0)
    if dim == "remote":
        return {
            "フルリモート": 1.0, "ハイブリッド(週2出社)": 0.7, "ハイブリッド(週3出社)": 0.4,
            "原則出社": -0.4, "シフト・現場勤務": -0.7,
        }.get(remote, 0.0)
    if dim == "onsite":
        return {
            "原則出社": 1.0, "シフト・現場勤務": 0.6, "ハイブリッド(週3出社)": 0.3,
            "ハイブリッド(週2出社)": -0.3, "フルリモート": -1.0,
        }.get(remote, 0.0)
    if dim == "ojt":
        if any(k in ojt for k in ["メンター", "集合研修", "資格", "ペア", "ドキュメント", "チェックリスト", "ブラザー"]):
            return 1.0
        if any(k in ojt for k in ["放任", "自走"]):
            return -0.6
        return 0.0
    if dim == "autonomy":
        v = 0.0
        if "自走・裁量重視" in tags or "挑戦・変化志向" in tags:
            v += 1.0
        if "裁量は大きい" in daily:
            v += 0.5
        return min(v, 1.0)
    if dim == "stable":
        v = 0.0
        if "安定・堅実" in tags or "アットホーム・定着率高" in tags:
            v += 1.0
        if size in ("大企業", "超大手"):
            v += 0.4
        return min(v, 1.0)
    if dim == "growth":
        return 1.0 if ("専門性・職人気質" in tags or "挑戦・変化志向" in tags) else 0.0
    if dim == "flat":
        return 1.0 if "フラット・オープン" in tags else 0.0
    if dim == "teamwork":
        return 1.0 if ("チームワーク重視" in tags or "アットホーム・定着率高" in tags) else 0.0
    if dim == "global":
        return 1.0 if "グローバル・多様性" in tags else 0.0
    return 0.0


def _reason(dim: str, md: dict) -> str:
    return REASON_TEMPLATES[dim].format(
        overtime=md.get("overtime_band", ""),
        leave=md.get("leave_ease", ""),
        remote=md.get("remote_policy", ""),
    )


def score_companies(signals: List[str], priority_axes: List[str], companies: List[dict]) -> List[dict]:
    """会社をスコアリングして降順に並べた一覧を返す。"""
    desired = _detect_desired(signals, priority_axes)
    ranked = []
    for cp in companies:
        md = cp.get("metadata", {}) or {}
        score = 50.0
        reasons: list[str] = []
        if desired:
            for dim, weight in desired.items():
                m = _match(dim, md, cp)
                score += weight * m * 12.0
                if m >= 0.6:
                    reasons.append(_reason(dim, md))
        score = max(5, min(99, round(score)))
        ranked.append({
            "job_id": cp.get("job_id"),
            "company_id": cp.get("company_id"),
            "name": md.get("name"),
            "industry": md.get("industry"),
            "region": md.get("region"),
            "size_band": md.get("size_band"),
            "job_title": cp.get("job_title"),
            "score": score,
            "reasons": reasons[:3] or ["希望条件と大きな相違はありません"],
        })
    ranked.sort(key=lambda x: (x["score"], x["company_id"] or ""), reverse=True)
    return ranked


async def explain_top(signals: List[str], top_items: List[dict]) -> dict:
    """上位N社の自然文理由を1回のGeminiで生成。失敗時は空dict（ルール理由を使う）。"""
    if not signals or not top_items:
        return {}
    compact = [
        {"job_id": it["job_id"], "name": it["name"], "industry": it["industry"], "job_title": it["job_title"]}
        for it in top_items
    ]
    prompt = f"""
候補者の希望（シグナル）と、合致度上位の企業リストを渡します。
各企業について「なぜこの候補者に合うか」を、候補者目線で40字以内の1文で説明してください。

## 候補者シグナル
{json.dumps(signals, ensure_ascii=False)}

## 企業リスト
{json.dumps(compact, ensure_ascii=False)}

## 出力形式（JSON、job_idをキーに）
{{ "job-001": "理由の1文", ... }}
JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        return data if isinstance(data, dict) else {}
    except Exception as e:
        logger.warning(f"explain_top failed, using rule reasons: {e}")
        return {}

from __future__ import annotations
"""
企業名解決の共通ヘルパー。

companyRealityProfiles は本来 `metadata`（seedデータ由来）に社名等を持つ想定だったが、
実アプリのフォーム経由で登録された企業は metadata を持たず、代わりに `company_id` で
`companies` コレクション（backend/app/routers/auth.py の register_company が作成）に
name / industry / size_band / region を持つ。

このモジュールは、profile単体・複数件のどちらからも
「metadata優先 → companiesコレクションへフォールバック」で会社情報を解決する。
"""
import asyncio
import logging
from typing import Optional
from app.db import firestore

logger = logging.getLogger(__name__)

_FIELDS = ("name", "industry", "region", "size_band")


def resolve_company_fields(cp: dict, company: Optional[dict]) -> dict:
    """
    1件のprofileについて、metadata → companies の順で name/industry/region/size_band を解決する。
    どちらにも値が無いフィールドは None のまま返す。
    """
    md = cp.get("metadata", {}) or {}
    company = company or {}
    return {field: md.get(field) or company.get(field) for field in _FIELDS}


async def batch_get_companies(company_ids: list[str]) -> dict[str, dict]:
    """
    ユニークな company_id 群を asyncio.gather で並列取得し、company_id -> company dict の辞書を返す。
    N+1 を避けるため、呼び出し側で重複除去してから渡すことを想定（本関数内でも念のため重複除去する）。
    """
    unique_ids = [cid for cid in dict.fromkeys(company_ids) if cid]
    if not unique_ids:
        return {}
    results = await asyncio.gather(
        *[firestore.get("companies", cid) for cid in unique_ids],
        return_exceptions=True,
    )
    resolved: dict[str, dict] = {}
    for cid, result in zip(unique_ids, results):
        if isinstance(result, Exception):
            logger.warning(f"company lookup failed for company_id={cid}: {result}")
            continue
        if result:
            resolved[cid] = result
    return resolved


def dedupe_latest_by_job_id(profiles: list[dict]) -> list[dict]:
    """同じ job_id のprofileが複数ある場合、created_at が最新の1件のみを残す。"""
    latest_by_job: dict[str, dict] = {}
    no_job_id: list[dict] = []
    for p in profiles:
        job_id = p.get("job_id")
        if not job_id:
            no_job_id.append(p)
            continue
        existing = latest_by_job.get(job_id)
        if existing is None or (p.get("created_at") or "") > (existing.get("created_at") or ""):
            latest_by_job[job_id] = p
    return list(latest_by_job.values()) + no_job_id


async def enrich_profiles_with_company(profiles: list[dict]) -> list[dict]:
    """
    候補者向け一覧などで使う統合処理:
    1. job_id重複を除去（created_at最新のみ残す）
    2. ユニークな company_id を一括解決（N+1回避）
    3. 各profileに company_fields（name/industry/region/size_band）を付与
    4. name が metadata/companies のどちらからも解決できない profile は除外する
    """
    deduped = dedupe_latest_by_job_id(profiles)
    companies_by_id = await batch_get_companies([p.get("company_id") for p in deduped])

    enriched = []
    for p in deduped:
        fields = resolve_company_fields(p, companies_by_id.get(p.get("company_id")))
        if not fields["name"]:
            continue
        enriched.append((p, fields))
    return enriched

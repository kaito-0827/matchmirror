#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
companies.json の100社を MatchMirror のデータストアに投入するスクリプト。

2つのモードがある:

1) ストア直書き（デフォルト）
   firestore モジュール経由で companyRealityProfiles コレクションに保存する。
   - GOOGLE_CLOUD_PROJECT 等が設定されていれば Firestore に永続化される。
   - 未設定ならアプリのin-memoryストアに書き込む（同一プロセス内のみ有効）。
     ※ in-memory はプロセスごとに独立するため、別プロセスで起動中の
        uvicorn には反映されない点に注意（その場合は --via-api を使う）。

   実行:
       cd backend && venv/bin/python -m app.seed.seed
       cd backend && venv/bin/python -m app.seed.seed --reset   # 既存を消してから投入

2) API経由（--via-api）
   起動中のバックエンドの POST /api/company-profiles に1社ずつ投入する。
   in-memory で起動中のサーバにデータを流し込みたい場合はこちら。
   ※ このエンドポイントは CompanyRealityInput のフィールドのみ受け付けるため、
      metadata（社名・業界など）は保存されない。

   実行（先にバックエンドを起動しておく）:
       cd backend && venv/bin/python -m app.seed.seed --via-api
       cd backend && venv/bin/python -m app.seed.seed --via-api --base-url http://127.0.0.1:8000
"""
from __future__ import annotations
import argparse
import asyncio
import json
import os
import sys

SEED_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(SEED_DIR, "companies.json")


def load_companies() -> list[dict]:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


async def seed_store(reset: bool) -> None:
    """firestore モジュール経由でストアに直書きする。"""
    # backend/ を import パスに通す（python -m で実行すれば不要だが直接実行も許容）
    backend_root = os.path.abspath(os.path.join(SEED_DIR, "..", ".."))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)

    from app.db import firestore  # noqa: E402
    from app.agents import company_agent  # noqa: E402
    from app.models.company import CompanyRealityInput  # noqa: E402
    from datetime import datetime, timezone  # noqa: E402

    companies = load_companies()

    if reset:
        # 既存のseedデータ（seed=True）を削除する。Firestore/in-memory両対応。
        existing = await firestore.list_all("companyRealityProfiles")
        removed = 0
        for d in existing:
            if d.get("seed") and d.get("id"):
                await firestore.delete("companyRealityProfiles", d["id"])
                removed += 1
        print(f"既存のseedデータ {removed}件を削除しました")

    count = 0
    for c in companies:
        inp = CompanyRealityInput(
            company_id=c["company_id"],
            job_id=c["job_id"],
            job_title=c["job_title"],
            daily_tasks=c["daily_tasks"],
            ojt_structure=c["ojt_structure"],
            leave_reality=c["leave_reality"],
            culture_values=c["culture_values"],
            evaluation_criteria=c.get("evaluation_criteria"),
            workstyle=c.get("workstyle"),
        )
        completeness, missing = company_agent.calculate_completeness(inp)
        # ドキュメントIDは company_id 固定 → 再実行は上書きになり重複しない（冪等）
        profile_id = c["company_id"]
        await firestore.save("companyRealityProfiles", profile_id, {
            "company_id": inp.company_id,
            "job_id": inp.job_id,
            "job_title": inp.job_title,
            "daily_tasks": inp.daily_tasks,
            "ojt_structure": inp.ojt_structure,
            "leave_reality": inp.leave_reality,
            "culture_values": inp.culture_values,
            "evaluation_criteria": inp.evaluation_criteria,
            "workstyle": inp.workstyle,
            # メタ情報はリッチ版として併せて保存（既存リーダーは無視できる）
            "metadata": c.get("metadata", {}),
            "structured_data": None,  # AI構造化はseed時には行わない
            "completeness": completeness,
            "missing_fields": missing,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "seed": True,
        })
        count += 1
    print(f"✓ {count}社を companyRealityProfiles に投入しました（直書きモード）")


def seed_via_api(base_url: str) -> None:
    """起動中のバックエンドAPIに1社ずつPOSTする。"""
    import urllib.request
    import urllib.error

    companies = load_companies()
    url = f"{base_url.rstrip('/')}/api/company-profiles"
    ok = 0
    for c in companies:
        payload = {
            "company_id": c["company_id"],
            "job_id": c["job_id"],
            "job_title": c["job_title"],
            "daily_tasks": c["daily_tasks"],
            "ojt_structure": c["ojt_structure"],
            "leave_reality": c["leave_reality"],
            "culture_values": c["culture_values"],
            "evaluation_criteria": c.get("evaluation_criteria"),
            "workstyle": c.get("workstyle"),
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    ok += 1
        except urllib.error.HTTPError as e:
            print(f"  ! {c['company_id']} 失敗: {e.code} {e.read().decode('utf-8', 'ignore')[:120]}")
        except Exception as e:
            print(f"  ! {c['company_id']} 失敗: {e}")
    print(f"✓ {ok}/{len(companies)}社を API経由で投入しました（{url}）")


def main() -> None:
    parser = argparse.ArgumentParser(description="MatchMirror 企業モックデータ投入")
    parser.add_argument("--via-api", action="store_true", help="起動中バックエンドへAPI経由で投入")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="API投入時のベースURL")
    parser.add_argument("--reset", action="store_true", help="投入前にin-memoryの既存データを消す")
    args = parser.parse_args()

    if args.via_api:
        seed_via_api(args.base_url)
    else:
        asyncio.run(seed_store(args.reset))


if __name__ == "__main__":
    main()

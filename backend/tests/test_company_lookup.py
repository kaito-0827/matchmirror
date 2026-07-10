"""
企業名フォールバック解決 と job_id 重複除去のテスト。
GET /api/company-profiles が:
  - metadata.name を持つ(seed由来)プロファイルはそのまま名前を返す
  - metadataを持たないがcompany_idでcompaniesに解決できるプロファイルは、
    companiesコレクションからname/industry/region/size_bandを解決する
  - どちらからもnameが解決できないプロファイル（テストデータの残骸）は除外する
  - 同じjob_idのプロファイルが複数あればcreated_atが最新の1件のみ残す
ことを確認する。in-memoryストア（companyRealityProfiles, companies）に直接データを
仕込んだ上でAPIを叩く。
"""
import pytest
from app.db import firestore

pytestmark = pytest.mark.anyio


async def test_list_profiles_resolves_name_from_metadata(client):
    """metadata.nameがあるプロファイルはそのまま社名を返す（seed互換）。"""
    await firestore.save("companyRealityProfiles", "profile-md-1", {
        "job_id": "job-md-1",
        "company_id": "company-md-1",
        "job_title": "seed企業の求人",
        "metadata": {"name": "メタデータ株式会社", "industry": "IT・通信", "region": "関東", "size_band": "51〜300名"},
        "workstyle": "リモート週3",
        "created_at": "2026-01-01T00:00:00",
    })

    res = await client.get("/api/company-profiles")
    assert res.status_code == 200, res.text
    items = {it["job_id"]: it for it in res.json()["items"]}
    assert "job-md-1" in items
    assert items["job-md-1"]["name"] == "メタデータ株式会社"
    assert items["job-md-1"]["industry"] == "IT・通信"


async def test_list_profiles_falls_back_to_companies_collection(client):
    """metadataが無いプロファイルは company_id 経由で companies コレクションから解決する。"""
    await firestore.save("companies", "company-fallback-1", {
        "id": "company-fallback-1",
        "name": "フォールバック株式会社",
        "industry": "メーカー",
        "size_band": "301〜1000名",
        "region": "関西",
    })
    await firestore.save("companyRealityProfiles", "profile-fallback-1", {
        "job_id": "job-fallback-1",
        "company_id": "company-fallback-1",
        "job_title": "実アプリ登録の求人",
        "workstyle": "出社中心",
        "created_at": "2026-01-01T00:00:00",
    })

    res = await client.get("/api/company-profiles")
    assert res.status_code == 200, res.text
    items = {it["job_id"]: it for it in res.json()["items"]}
    assert "job-fallback-1" in items
    it = items["job-fallback-1"]
    assert it["name"] == "フォールバック株式会社"
    assert it["industry"] == "メーカー"
    assert it["region"] == "関西"
    assert it["size_band"] == "301〜1000名"


async def test_list_profiles_excludes_nameless_profiles(client):
    """metadataにもcompaniesにも社名が無いプロファイル（テストデータの残骸）は一覧から除外する。"""
    await firestore.save("companyRealityProfiles", "profile-nameless-1", {
        "job_id": "job-nameless-1",
        "company_id": "company-does-not-exist",
        "job_title": "残骸求人",
        "created_at": "2026-01-01T00:00:00",
    })

    res = await client.get("/api/company-profiles")
    assert res.status_code == 200, res.text
    job_ids = {it["job_id"] for it in res.json()["items"]}
    assert "job-nameless-1" not in job_ids


async def test_list_profiles_dedupes_by_job_id_keeping_latest(client):
    """同一job_idのプロファイルが複数存在する場合、created_atが最新の1件のみ残す。"""
    await firestore.save("companies", "company-dup-1", {
        "id": "company-dup-1",
        "name": "重複テスト株式会社",
        "industry": "小売",
        "size_band": "1〜50名",
        "region": "全国・リモート",
    })
    # 古い方（別のjob_title）
    await firestore.save("companyRealityProfiles", "profile-dup-old", {
        "job_id": "job-dup-1",
        "company_id": "company-dup-1",
        "job_title": "旧求人タイトル",
        "created_at": "2026-01-01T00:00:00",
    })
    # 新しい方
    await firestore.save("companyRealityProfiles", "profile-dup-new", {
        "job_id": "job-dup-1",
        "company_id": "company-dup-1",
        "job_title": "新求人タイトル",
        "created_at": "2026-06-01T00:00:00",
    })

    res = await client.get("/api/company-profiles")
    assert res.status_code == 200, res.text
    matching = [it for it in res.json()["items"] if it["job_id"] == "job-dup-1"]
    assert len(matching) == 1
    assert matching[0]["job_title"] == "新求人タイトル"


async def test_list_profiles_metadata_takes_precedence_over_companies(client):
    """metadataとcompaniesの両方に値がある場合はmetadataを優先する。"""
    await firestore.save("companies", "company-precedence-1", {
        "id": "company-precedence-1",
        "name": "companies側の社名",
        "industry": "companies側業種",
        "size_band": "companies側規模",
        "region": "companies側地域",
    })
    await firestore.save("companyRealityProfiles", "profile-precedence-1", {
        "job_id": "job-precedence-1",
        "company_id": "company-precedence-1",
        "job_title": "優先度確認求人",
        "metadata": {"name": "metadata側の社名"},
        "created_at": "2026-01-01T00:00:00",
    })

    res = await client.get("/api/company-profiles")
    assert res.status_code == 200, res.text
    items = {it["job_id"]: it for it in res.json()["items"]}
    assert items["job-precedence-1"]["name"] == "metadata側の社名"

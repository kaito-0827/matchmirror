"""
スモークテスト: 今回追加した4エンドポイントが200を返すことを確認する。
モックエージェント（GOOGLE_GEMINI_API_KEY未設定）で動作する。
"""
import pytest
from app.utils.rate_limit import _hits

pytestmark = pytest.mark.anyio


async def _create_profile(client) -> str:
    """テスト用企業プロファイルを作成し profile_id を返す。"""
    res = await client.post("/api/company-profiles", json={
        "company_id": "test-company-001",
        "job_id": "test-job-001",
        "job_title": "バックエンドエンジニア",
        "daily_tasks": "FastAPIでAPIを開発する。週次スプリントで進める。",
        "ojt_structure": "入社後3ヶ月はメンターが1on1でサポート。",
        "leave_reality": "有給取得率70%。月平均残業10時間。",
        "culture_values": "フラットな組織。意見を言いやすい環境。",
        "evaluation_criteria": "半期ごとにOKRで評価。",
        "workstyle": "リモート週3、出社週2。",
    })
    assert res.status_code == 200, res.text
    return res.json()["profile_id"]


async def _create_session(client, profile_id: str) -> str:
    """テスト用診断セッションを作成し session_id を返す。"""
    res = await client.post("/api/diagnosis/sessions", json={
        "user_id": "test-user-001",
        "job_id": "test-job-001",
    })
    assert res.status_code == 200, res.text
    return res.json()["session_id"]


async def _advance_session(client, session_id: str):
    """セッションを5問進めてレポート生成可能にする。"""
    for _ in range(5):
        res = await client.post(f"/api/diagnosis/sessions/{session_id}/messages", json={
            "text": "リモートワーク中心で働きたいです。チームワークも大切にしたい。",
        })
        assert res.status_code == 200, res.text
        data = res.json()
        if data.get("diagnosis_complete"):
            break


async def _create_report(client, session_id: str) -> str:
    """レポートを生成して report_id を返す。"""
    res = await client.post(f"/api/diagnosis/sessions/{session_id}/report")
    assert res.status_code == 200, res.text
    return res.json()["report_id"]


# ── テスト本体 ──────────────────────────────────────────────

async def test_deep_dive_returns_question(client):
    """deep-dive エンドポイントが追加質問を返す。"""
    profile_id = await _create_profile(client)
    session_id = await _create_session(client, profile_id)
    await _advance_session(client, session_id)

    res = await client.post(f"/api/diagnosis/sessions/{session_id}/deep-dive")
    assert res.status_code == 200, res.text
    body = res.json()
    assert "question" in body
    assert isinstance(body["question"], str)
    assert len(body["question"]) > 0


async def test_reopen_session(client):
    """reopen エンドポイントでセッションを再開できる。"""
    profile_id = await _create_profile(client)
    session_id = await _create_session(client, profile_id)
    await _advance_session(client, session_id)

    res = await client.post(f"/api/diagnosis/sessions/{session_id}/reopen")
    assert res.status_code == 200, res.text
    body = res.json()
    assert "session_id" in body
    assert "first_question" in body


async def test_post_interview_recalculates_score(client):
    """post-interview がスコアを再計算して新 report_id を返す。"""
    profile_id = await _create_profile(client)
    session_id = await _create_session(client, profile_id)
    await _advance_session(client, session_id)
    report_id = await _create_report(client, session_id)

    res = await client.post(f"/api/reports/{report_id}/post-interview", json={
        "feedbacks": [
            {
                "gap_axis": "働き方",
                "gap_title": "リモート勤務の頻度",
                "status": "confirmed",
                "note": "週3リモートで合意できた",
            }
        ]
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert "new_report_id" in body
    assert "before_score" in body
    assert "after_score" in body
    assert isinstance(body["delta"], (int, float))


async def test_posting_check_returns_warnings(client):
    """posting-check が警告リストを返す（開発モードは認証不要）。"""
    profile_id = await _create_profile(client)

    res = await client.post(
        f"/api/company-profiles/{profile_id}/posting-check",
        json={"posting_text": "アットホームな職場です。残業はほぼありません。成長できる環境。"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert "warnings" in body
    assert isinstance(body["warnings"], list)
    assert "overall_risk" in body
    assert body["warning_count"] == len(body["warnings"])


async def test_posting_check_404_on_unknown_profile(client):
    """存在しない profile_id は 404 を返す。"""
    res = await client.post(
        "/api/company-profiles/nonexistent-id/posting-check",
        json={"posting_text": "求人票テキスト"},
    )
    assert res.status_code == 404


async def test_extract_from_posting_returns_fields(client):
    """extract-from-posting が7軸の抽出結果とフォーム自動入力値を返す（認証不要）。"""
    res = await client.post(
        "/api/company-profiles/extract-from-posting",
        json={
            "posting_text": (
                "【職種】バックエンドエンジニア\n"
                "アットホームな職場です。残業はほぼありません。\n"
                "OJTでしっかり育成します。フレックス制度あり、リモート週3可。"
            )
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert "form_fields" in body
    assert "extracted_fields" in body
    assert len(body["extracted_fields"]) == 7
    assert "missing_axes" in body
    for f in body["extracted_fields"]:
        assert "field_key" in f
        assert "axis_label" in f
        assert "divergence_risk" in f


async def test_extract_from_posting_422_on_empty_text(client):
    """空テキストは422を返す。"""
    res = await client.post(
        "/api/company-profiles/extract-from-posting",
        json={"posting_text": "   "},
    )
    assert res.status_code == 422


async def test_recommendations_rate_limited_after_threshold(client):
    """無認証の /api/recommendations は同一IPからの過剰リクエストを429で拒否する。"""
    _hits.clear()
    for _ in range(10):
        res = await client.post("/api/recommendations", json={"signals": ["リモート希望"]})
        assert res.status_code == 200, res.text

    res = await client.post("/api/recommendations", json={"signals": ["リモート希望"]})
    assert res.status_code == 429
    assert "detail" in res.json()


async def test_rate_limit_keys_by_route_template_not_resolved_path(client):
    """session_idが異なっても同じエンドポイント（ルートテンプレート）として制限される。"""
    _hits.clear()
    profile_id = await _create_profile(client)

    for _ in range(15):
        session_id = await _create_session(client, profile_id)
        res = await client.post(f"/api/diagnosis/sessions/{session_id}/deep-dive")
        assert res.status_code == 200, res.text

    session_id = await _create_session(client, profile_id)
    res = await client.post(f"/api/diagnosis/sessions/{session_id}/deep-dive")
    assert res.status_code == 429


async def test_create_company_profile_rate_limited_after_threshold(client):
    """無認証でGeminiを呼ぶ /api/company-profiles は同一IPからの過剰リクエストを429で拒否する。"""
    _hits.clear()
    for i in range(10):
        await _create_profile(client)

    res = await client.post("/api/company-profiles", json={
        "company_id": "test-company-001",
        "job_id": "test-job-001",
        "job_title": "バックエンドエンジニア",
        "daily_tasks": "FastAPIでAPIを開発する。",
        "ojt_structure": "入社後3ヶ月はメンターが1on1でサポート。",
        "leave_reality": "有給取得率70%。",
        "culture_values": "フラットな組織。",
    })
    assert res.status_code == 429
    assert "detail" in res.json()


async def test_extract_from_posting_rate_limited_after_threshold(client):
    """無認証でGeminiを呼ぶ /api/company-profiles/extract-from-posting は過剰リクエストを429で拒否する。"""
    _hits.clear()
    for _ in range(10):
        res = await client.post(
            "/api/company-profiles/extract-from-posting",
            json={"posting_text": "アットホームな職場です。残業はほぼありません。"},
        )
        assert res.status_code == 200, res.text

    res = await client.post(
        "/api/company-profiles/extract-from-posting",
        json={"posting_text": "アットホームな職場です。残業はほぼありません。"},
    )
    assert res.status_code == 429


async def test_autopilot_returns_decision_and_plan(client):
    """autopilot エンドポイントが自律判断・優先質問・フォロー計画を一気通貫で返す。"""
    profile_id = await _create_profile(client)
    session_id = await _create_session(client, profile_id)
    await _advance_session(client, session_id)
    report_id = await _create_report(client, session_id)

    res = await client.post(f"/api/reports/{report_id}/autopilot")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["decision"]["action"] in ("ask_questions_first", "build_plan_directly")
    assert isinstance(body["decision"]["reasoning"], str) and len(body["decision"]["reasoning"]) > 0
    assert isinstance(body["decision"]["focus_axes"], list)
    assert "plan_id" in body
    assert len(body["tasks"]) > 0
    assert isinstance(body["priority_questions"], list)


async def test_autopilot_404_on_unknown_report(client):
    """存在しないreport_idは404を返す。"""
    res = await client.post("/api/reports/nonexistent-id/autopilot")
    assert res.status_code == 404


async def test_company_dashboard_scope_and_info_edit(client):
    """会社アカウント起点で自社求人・マッチが引け、会社情報を編集できる。"""
    _hits.clear()
    hr = {"X-Dev-Uid": "hr-user-1", "X-Dev-Email": "hr@example.com"}

    # 会社情報つきで登録
    res = await client.post("/api/auth/register/company", json={
        "name": "テスト株式会社",
        "industry": "IT・通信",
        "size_band": "51〜300名",
        "region": "関東",
    }, headers=hr)
    assert res.status_code == 200, res.text
    body = res.json()
    company_id = body["account"]["company_id"]
    assert body["company"]["industry"] == "IT・通信"

    # 自社の実態プロファイルを登録
    job_id = f"job-{company_id}"
    res = await client.post("/api/company-profiles", json={
        "company_id": company_id,
        "job_id": job_id,
        "job_title": "法人営業",
        "daily_tasks": "新規開拓と既存フォロー。週次で商談レビュー。",
        "ojt_structure": "3ヶ月間メンターが同行。",
        "leave_reality": "有給取得率60%。月平均残業20時間。",
        "culture_values": "チームで成果を出す文化。",
    }, headers=hr)
    assert res.status_code == 200, res.text

    # 自社求人一覧が引ける
    res = await client.get("/api/company-profiles/mine", headers=hr)
    assert res.status_code == 200, res.text
    mine = res.json()
    assert mine["company_id"] == company_id
    assert any(p["job_id"] == job_id for p in mine["items"])

    # 候補者が診断→レポート→マッチング
    cand = {"X-Dev-Uid": "cand-user-1", "X-Dev-Email": "cand@example.com"}
    res = await client.post("/api/auth/register/candidate", json={"display_name": "候補 太郎"}, headers=cand)
    assert res.status_code == 200, res.text
    res = await client.post("/api/diagnosis/sessions", json={"user_id": "cand-user-1", "job_id": job_id}, headers=cand)
    assert res.status_code == 200, res.text
    session_id = res.json()["session_id"]
    await _advance_session(client, session_id)
    res = await client.post(f"/api/diagnosis/sessions/{session_id}/report", headers=cand)
    assert res.status_code == 200, res.text
    report_id = res.json()["report_id"]
    res = await client.post("/api/matches", json={"report_id": report_id}, headers=cand)
    assert res.status_code == 200, res.text

    # 会社側: 自社スコープのマッチ一覧に候補者名が出る
    res = await client.get("/api/company-matches/mine", headers=hr)
    assert res.status_code == 200, res.text
    matches = res.json()
    assert matches["total"] >= 1
    assert any(m["candidate_name"] == "候補 太郎" and m["job_id"] == job_id for m in matches["items"])

    # 会社情報の編集（メンバー本人はOK）
    res = await client.patch(f"/api/companies/{company_id}", json={"name": "テスト株式会社（新）", "region": "全国・リモート"}, headers=hr)
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "テスト株式会社（新）"
    assert res.json()["region"] == "全国・リモート"

    # 他人は編集できない
    res = await client.patch(f"/api/companies/{company_id}", json={"name": "乗っ取り"}, headers={"X-Dev-Uid": "someone-else"})
    assert res.status_code == 403


async def test_company_mine_endpoints_empty_for_non_company(client):
    """会社アカウント未登録の主体には空リストを返す（404にしない）。"""
    headers = {"X-Dev-Uid": "no-company-user"}
    res = await client.get("/api/company-profiles/mine", headers=headers)
    assert res.status_code == 200
    assert res.json()["items"] == []
    res = await client.get("/api/company-matches/mine", headers=headers)
    assert res.status_code == 200
    assert res.json()["items"] == []


async def test_autopilot_rate_limited_after_threshold(client):
    """autopilot は同一IPからの過剰リクエストを429で拒否する。"""
    _hits.clear()
    profile_id = await _create_profile(client)
    session_id = await _create_session(client, profile_id)
    await _advance_session(client, session_id)
    report_id = await _create_report(client, session_id)

    for _ in range(5):
        res = await client.post(f"/api/reports/{report_id}/autopilot")
        assert res.status_code == 200, res.text

    res = await client.post(f"/api/reports/{report_id}/autopilot")
    assert res.status_code == 429

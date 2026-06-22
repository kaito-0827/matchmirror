"""
スモークテスト: 今回追加した4エンドポイントが200を返すことを確認する。
モックエージェント（GOOGLE_GEMINI_API_KEY未設定）で動作する。
"""
import pytest

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

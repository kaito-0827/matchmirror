"""
Agent Console 進捗トラッキングのテスト。
モックエージェント（GOOGLE_GEMINI_API_KEY未設定）でレポート生成/Autopilotを呼び、
agentProgress ドキュメントが最終的に status=done・全step done になることを確認する。
"""
import pytest
from app.utils.rate_limit import _hits

pytestmark = pytest.mark.anyio


async def _create_profile(client) -> str:
    res = await client.post("/api/company-profiles", json={
        "company_id": "progress-company-001",
        "job_id": "progress-job-001",
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


async def _create_session(client) -> str:
    res = await client.post("/api/diagnosis/sessions", json={
        "user_id": "progress-user-001",
        "job_id": "progress-job-001",
    })
    assert res.status_code == 200, res.text
    return res.json()["session_id"]


async def _advance_session(client, session_id: str):
    for _ in range(5):
        res = await client.post(f"/api/diagnosis/sessions/{session_id}/messages", json={
            "text": "リモートワーク中心で働きたいです。チームワークも大切にしたい。",
        })
        assert res.status_code == 200, res.text
        if res.json().get("diagnosis_complete"):
            break


async def test_report_progress_unknown_before_generation(client):
    """レポート生成前は status=unknown, steps=[] を200で返す（404にしない）。"""
    res = await client.get("/api/diagnosis/sessions/nonexistent-session/report-progress")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "unknown"
    assert body["steps"] == []


async def test_report_progress_reaches_done_with_all_steps_done(client):
    """レポート生成後、進捗ドキュメントが status=done かつ全stepがdoneになっている。"""
    _hits.clear()
    await _create_profile(client)
    session_id = await _create_session(client)
    await _advance_session(client, session_id)

    res = await client.post(f"/api/diagnosis/sessions/{session_id}/report")
    assert res.status_code == 200, res.text

    progress_res = await client.get(f"/api/diagnosis/sessions/{session_id}/report-progress")
    assert progress_res.status_code == 200, progress_res.text
    progress = progress_res.json()

    assert progress["status"] == "done"
    step_ids = {s["id"] for s in progress["steps"]}
    assert step_ids == {"mismatch", "questions", "guardrail", "finalize"}
    for step in progress["steps"]:
        assert step["status"] == "done", step
        assert step["started_at"] is not None
        assert step["finished_at"] is not None


async def test_autopilot_progress_unknown_before_run(client):
    """Autopilot実行前は status=unknown, steps=[] を200で返す。"""
    res = await client.get("/api/reports/nonexistent-report/autopilot-progress")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "unknown"
    assert body["steps"] == []


async def test_autopilot_progress_reaches_done_with_all_steps_done(client):
    """Autopilot実行後、進捗ドキュメントが status=done かつ全stepがdoneになっている。"""
    _hits.clear()
    await _create_profile(client)
    session_id = await _create_session(client)
    await _advance_session(client, session_id)

    report_res = await client.post(f"/api/diagnosis/sessions/{session_id}/report")
    assert report_res.status_code == 200, report_res.text
    report_id = report_res.json()["report_id"]

    res = await client.post(f"/api/reports/{report_id}/autopilot")
    assert res.status_code == 200, res.text

    progress_res = await client.get(f"/api/reports/{report_id}/autopilot-progress")
    assert progress_res.status_code == 200, progress_res.text
    progress = progress_res.json()

    assert progress["status"] == "done"
    step_ids = {s["id"] for s in progress["steps"]}
    assert step_ids == {"orchestrator", "prioritize", "followup"}
    for step in progress["steps"]:
        assert step["status"] == "done", step
        assert step["started_at"] is not None
        assert step["finished_at"] is not None

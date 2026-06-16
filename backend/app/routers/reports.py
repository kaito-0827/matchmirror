import uuid
from fastapi import APIRouter, HTTPException
from app.models.report import ReportGenerateResponse, AxisScore, GapItem, MatchItem, RiskLevel
from app.models.followup import FollowUpPlanResponse
from app.agents import mismatch_agent, question_agent, followup_agent, guardrail_agent
from app.db import firestore
from app.utils import audit
from datetime import datetime

router = APIRouter(prefix="/api", tags=["reports"])


def _raw_company_profile(cp: dict) -> dict:
    """structured_data が無い企業の生の実態フィールドを、照合用dictに整形する。"""
    md = cp.get("metadata", {}) or {}
    return {
        "company_name": md.get("name"),
        "industry": md.get("industry"),
        "region": md.get("region"),
        "size_band": md.get("size_band"),
        "job_title": cp.get("job_title"),
        "daily_tasks": cp.get("daily_tasks"),
        "ojt_structure": cp.get("ojt_structure"),
        "leave_reality": cp.get("leave_reality"),
        "culture_values": cp.get("culture_values"),
        "evaluation_criteria": cp.get("evaluation_criteria"),
        "workstyle": cp.get("workstyle"),
    }


@router.post("/diagnosis/sessions/{session_id}/report", response_model=ReportGenerateResponse)
async def generate_report(session_id: str):
    """
    ミスマッチ診断レポートを生成する。
    MismatchAgent → QuestionAgent → GuardrailAgent の順で処理する。
    """
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")

    # 企業プロファイルを取得
    company_profiles = await firestore.query(
        "companyRealityProfiles", {"job_id": session["job_id"]}
    )
    # structured_data があればそれを、無ければ生の実態フィールドから組み立てる
    # （seedした100社は structured_data=None のため、生データで照合する）
    if company_profiles:
        cp = company_profiles[0]
        company_profile = cp.get("structured_data") or _raw_company_profile(cp)
    else:
        company_profile = {}

    # MismatchAgent でスコアリング
    analysis = await mismatch_agent.run_mismatch_analysis(
        company_profile=company_profile,
        candidate_signals=session.get("extracted_signals", []),
        conversation_messages=session.get("messages", []),
    )

    # QuestionAgent で質問生成
    questions = await question_agent.generate_questions(
        gaps=analysis.get("gaps", []),
        company_profile=company_profile,
        candidate_signals=session.get("extracted_signals", []),
    )

    # GuardrailAgent で出力チェック
    candidate_summary = analysis.get("candidate_summary", "")
    guardrail_result = await guardrail_agent.check_output(candidate_summary)
    if not guardrail_result.passed and guardrail_result.safe_version:
        candidate_summary = guardrail_result.safe_version

    # レポートを保存
    report_id = firestore.new_id()
    axis_scores = [
        AxisScore(
            axis=ax["axis"],
            score=ax["score"],
            color=ax.get("color", "#dc8a14"),
            summary=ax.get("summary", ""),
        )
        for ax in analysis.get("axis_scores", [])
    ]
    gaps = [
        GapItem(
            axis=g["axis"],
            title=g["title"],
            detail=g["detail"],
            severity=RiskLevel(g.get("severity", "medium")),
            recommended_question=g.get("recommended_question"),
        )
        for g in analysis.get("gaps", [])
    ]
    matches = [
        MatchItem(axis=m["axis"], title=m["title"], detail=m["detail"])
        for m in analysis.get("matches", [])
    ]

    await firestore.save("mismatchReports", report_id, {
        "session_id": session_id,
        "user_id": session["user_id"],
        "job_id": session["job_id"],
        "overall_score": analysis.get("overall_score", 60),
        "axis_scores": [a.model_dump() for a in axis_scores],
        "gaps": [g.model_dump() for g in gaps],
        "matches": [m.model_dump() for m in matches],
        "questions": [q.model_dump() for q in questions],
        "candidate_summary": candidate_summary,
        "guardrail_passed": guardrail_result.passed,
        "confidence": analysis.get("confidence", 0.75),
        "created_at": datetime.utcnow().isoformat(),
    })

    await firestore.update("diagnosisSessions", session_id, {
        "status": "report_generated",
        "report_id": report_id,
    })
    await audit.log(session["user_id"], "report_generated", report_id)

    return ReportGenerateResponse(
        report_id=report_id,
        overall_score=analysis.get("overall_score", 60),
        axis_scores=axis_scores,
        gaps=gaps,
        matches=matches,
        questions=questions,
        candidate_summary=candidate_summary,
        guardrail_passed=guardrail_result.passed,
        confidence=analysis.get("confidence", 0.75),
    )


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    """候補者向け/企業向けレポートを取得する。"""
    report = await firestore.get("mismatchReports", report_id)
    if not report:
        raise HTTPException(status_code=404, detail="レポートが見つかりません")
    return report


@router.post("/reports/{report_id}/follow-up-plan", response_model=FollowUpPlanResponse)
async def generate_followup_plan(report_id: str):
    """内定前後フォロー計画を生成する。"""
    report = await firestore.get("mismatchReports", report_id)
    if not report:
        raise HTTPException(status_code=404, detail="レポートが見つかりません")

    tasks = await followup_agent.generate_followup_plan(
        gaps=report.get("gaps", []),
        questions=report.get("questions", []),
        overall_score=report.get("overall_score", 60),
    )

    plan_id = firestore.new_id()
    await firestore.save("followUpPlans", plan_id, {
        "report_id": report_id,
        "user_id": report["user_id"],
        "tasks": [t.model_dump() for t in tasks],
        "approved": False,
        "created_at": datetime.utcnow().isoformat(),
    })

    await audit.log(report["user_id"], "followup_plan_generated", plan_id)
    return FollowUpPlanResponse(
        plan_id=plan_id,
        tasks=tasks,
        owner_suggestion="人事担当",
    )


@router.patch("/follow-up-plans/{plan_id}/approve")
async def approve_plan(plan_id: str):
    """フォロー計画を承認する。"""
    plan = await firestore.get("followUpPlans", plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="フォロー計画が見つかりません")
    await firestore.update("followUpPlans", plan_id, {
        "approved": True,
        "approved_at": datetime.utcnow().isoformat(),
    })
    return {"message": "フォロー計画を承認しました", "plan_id": plan_id}

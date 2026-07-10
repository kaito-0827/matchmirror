import uuid
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.models.report import (
    ReportGenerateResponse, AxisScore, GapItem, MatchItem, RiskLevel, EvidenceItem,
    GapResolution, PostInterviewRequest, PostInterviewResponse, GuardrailLogEntry,
)
from app.models.followup import FollowUpPlanResponse, AutopilotResponse, AutopilotDecision
from app.agents import mismatch_agent, question_agent, followup_agent, guardrail_agent, orchestrator_agent
from app.auth import Principal, get_principal
from app.db import firestore
from app.utils import audit, agent_progress
from app.utils.company_lookup import resolve_company_fields
from app.utils.rate_limit import rate_limiter
from datetime import datetime

router = APIRouter(prefix="/api", tags=["reports"])

REPORT_STEPS = [
    {"id": "mismatch", "agent": "MismatchAgent", "label": "企業実態と候補者希望を6軸で照合"},
    {"id": "questions", "agent": "QuestionAgent", "label": "面談で確認すべき質問を優先度順に生成"},
    {"id": "guardrail", "agent": "GuardrailAgent", "label": "出力の差別性・断定表現を検査"},
    {"id": "finalize", "agent": "システム", "label": "レポートを保存"},
]

AUTOPILOT_STEPS = [
    {"id": "orchestrator", "agent": "OrchestratorAgent", "label": "診断結果から次のアクションを自律判断"},
    {"id": "prioritize", "agent": "OrchestratorAgent", "label": "重点軸に沿って確認質問を並べ替え"},
    {"id": "followup", "agent": "FollowUpAgent", "label": "重点軸を反映したフォロー計画を生成"},
]


async def _raw_company_profile(cp: dict, company: Optional[dict] = None) -> dict:
    """
    structured_data が無い企業の生の実態フィールドを、照合用dictに整形する。
    社名等は metadata 優先、無ければ company_id で companies コレクションへフォールバック。
    呼び出し側で既に companies ドキュメントを取得済みの場合は `company` に渡すと再取得を避けられる。
    """
    if company is None and cp.get("company_id"):
        company = await firestore.get("companies", cp.get("company_id"))
    fields = resolve_company_fields(cp, company)
    return {
        "company_name": fields["name"],
        "industry": fields["industry"],
        "region": fields["region"],
        "size_band": fields["size_band"],
        "job_title": cp.get("job_title"),
        "daily_tasks": cp.get("daily_tasks"),
        "ojt_structure": cp.get("ojt_structure"),
        "leave_reality": cp.get("leave_reality"),
        "culture_values": cp.get("culture_values"),
        "evaluation_criteria": cp.get("evaluation_criteria"),
        "workstyle": cp.get("workstyle"),
    }


class CompareRequest(BaseModel):
    job_ids: list[str]


async def _analyze_one(cp_doc: dict, signals: list, messages: list) -> dict:
    """1社分の軽量ミスマッチ分析（mismatchのみ。question/guardrailは呼ばない）。"""
    company = await firestore.get("companies", cp_doc.get("company_id")) if cp_doc.get("company_id") else None
    fields = resolve_company_fields(cp_doc, company)
    company_profile = cp_doc.get("structured_data") or await _raw_company_profile(cp_doc, company)
    analysis = await mismatch_agent.run_mismatch_analysis(
        company_profile=company_profile,
        candidate_signals=signals,
        conversation_messages=messages,
    )
    gaps = analysis.get("gaps", [])
    matches = analysis.get("matches", [])
    return {
        "job_id": cp_doc.get("job_id"),
        "company_name": fields["name"],
        "industry": fields["industry"],
        "region": fields["region"],
        "size_band": fields["size_band"],
        "job_title": cp_doc.get("job_title"),
        "overall_score": analysis.get("overall_score", 60),
        "axis_scores": analysis.get("axis_scores", []),
        "gaps": [
            {"axis": g.get("axis"), "title": g.get("title"), "severity": g.get("severity", "medium")}
            for g in gaps[:3]
        ],
        "matches": [{"axis": m.get("axis"), "title": m.get("title")} for m in matches[:2]],
    }


@router.post(
    "/diagnosis/sessions/{session_id}/compare",
    dependencies=[Depends(rate_limiter(max_requests=10, window_seconds=60))],
)
async def compare_companies(session_id: str, body: CompareRequest):
    """1回の診断シグナルを、複数社（最大3）に対して並列でミスマッチ照合し比較する。"""
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")

    job_ids = list(dict.fromkeys(body.job_ids))[:3]
    signals = session.get("extracted_signals", [])
    messages = session.get("messages", [])

    docs = []
    for jid in job_ids:
        profiles = await firestore.query("companyRealityProfiles", {"job_id": jid})
        if profiles:
            docs.append(profiles[0])

    items = await asyncio.gather(*[_analyze_one(d, signals, messages) for d in docs]) if docs else []
    items = sorted(items, key=lambda x: x["overall_score"], reverse=True)
    return {"items": items}


@router.post(
    "/diagnosis/sessions/{session_id}/report",
    response_model=ReportGenerateResponse,
    dependencies=[Depends(rate_limiter(max_requests=5, window_seconds=60))],
)
async def generate_report(session_id: str):
    """
    ミスマッチ診断レポートを生成する。
    MismatchAgent → QuestionAgent → GuardrailAgent の順で処理する。
    """
    session = await firestore.get("diagnosisSessions", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")

    await agent_progress.start("report", session_id, REPORT_STEPS)

    try:
        company_profiles = await firestore.query(
            "companyRealityProfiles", {"job_id": session["job_id"]}
        )
        if company_profiles:
            cp = company_profiles[0]
            company_profile = cp.get("structured_data") or await _raw_company_profile(cp)
        else:
            company_profile = {}

        await agent_progress.step_running("report", session_id, "mismatch")
        analysis = await mismatch_agent.run_mismatch_analysis(
            company_profile=company_profile,
            candidate_signals=session.get("extracted_signals", []),
            conversation_messages=session.get("messages", []),
        )
        await agent_progress.step_done("report", session_id, "mismatch")

        candidate_summary = analysis.get("candidate_summary", "")
        # QuestionAgent と GuardrailAgent(×2) は実際に並列実行される
        await agent_progress.step_running("report", session_id, "questions")
        await agent_progress.step_running("report", session_id, "guardrail")
        questions, guardrail_result, gap_issues = await asyncio.gather(
            question_agent.generate_questions(
                gaps=analysis.get("gaps", []),
                company_profile=company_profile,
                candidate_signals=session.get("extracted_signals", []),
            ),
            guardrail_agent.check_output(candidate_summary),
            guardrail_agent.check_gaps(analysis.get("gaps", [])),
        )
        await agent_progress.step_done("report", session_id, "questions")
        await agent_progress.step_done("report", session_id, "guardrail")

        if not guardrail_result.passed and guardrail_result.safe_version:
            candidate_summary = guardrail_result.safe_version

        # gaps と summary 両方の問題を結合
        all_guardrail_issues = guardrail_result.issues + gap_issues
        guardrail_passed = guardrail_result.passed and not gap_issues

        await agent_progress.step_running("report", session_id, "finalize")

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
                evidence=EvidenceItem(**g["evidence"]) if g.get("evidence") else None,
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
            "guardrail_passed": guardrail_passed,
            "guardrail_issues": all_guardrail_issues,
            "confidence": analysis.get("confidence", 0.75),
            "revision": 1,
            "parent_report_id": None,
            "created_at": datetime.utcnow().isoformat(),
        })

        # guardrailログを保存（問題があった場合のみ）
        if not guardrail_passed:
            log_id = firestore.new_id()
            await firestore.save("guardrailLogs", log_id, {
                "report_id": report_id,
                "issues": all_guardrail_issues,
                "original": analysis.get("candidate_summary", ""),
                "safe_version": guardrail_result.safe_version,
                "action": guardrail_result.action,
                "created_at": datetime.utcnow().isoformat(),
            })

        await firestore.update("diagnosisSessions", session_id, {
            "status": "report_generated",
            "report_id": report_id,
        })
        await audit.log(session["user_id"], "report_generated", report_id)

        await agent_progress.step_done("report", session_id, "finalize")
        await agent_progress.finish("report", session_id)
    except Exception:
        await agent_progress.fail("report", session_id)
        raise

    return ReportGenerateResponse(
        report_id=report_id,
        overall_score=analysis.get("overall_score", 60),
        axis_scores=axis_scores,
        gaps=gaps,
        matches=matches,
        questions=questions,
        candidate_summary=candidate_summary,
        guardrail_passed=guardrail_passed,
        guardrail_issues=all_guardrail_issues,
        confidence=analysis.get("confidence", 0.75),
    )


@router.get(
    "/diagnosis/sessions/{session_id}/report-progress",
    dependencies=[Depends(rate_limiter(max_requests=120, window_seconds=60))],
)
async def get_report_progress(session_id: str):
    """
    レポート生成中の Agent Console 進捗を返す（フロントが1.5秒間隔でポーリングする）。
    進捗ドキュメントが無い場合も404にせず status="unknown" を返す（ポーリング側の実装を単純化するため）。
    """
    doc = await agent_progress.get("report", session_id)
    if not doc:
        return {"status": "unknown", "steps": []}
    return doc


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    """候補者向け/企業向けレポートを取得する。"""
    report = await firestore.get("mismatchReports", report_id)
    if not report:
        raise HTTPException(status_code=404, detail="レポートが見つかりません")
    return report


@router.get("/reports/{report_id}/guardrail-log")
async def get_guardrail_log(report_id: str):
    """レポートに紐づくGuardrailAgentのログを返す。"""
    logs = await firestore.query("guardrailLogs", {"report_id": report_id})
    return {
        "report_id": report_id,
        "logs": logs,
        "total": len(logs),
    }


@router.post(
    "/reports/{report_id}/post-interview",
    response_model=PostInterviewResponse,
    dependencies=[Depends(rate_limiter(max_requests=5, window_seconds=60))],
)
async def submit_post_interview(report_id: str, body: PostInterviewRequest):
    """
    面談後フィードバックを記録し、スコアを再計算する。
    確認済み論点を合成して MismatchAgent を再実行し、差分スコアを返す。
    """
    report = await firestore.get("mismatchReports", report_id)
    if not report:
        raise HTTPException(status_code=404, detail="レポートが見つかりません")

    # 面談後フィードバックをコンテキスト文字列に合成
    feedback_lines = []
    resolved_count = 0
    unresolved_count = 0
    for fb in body.feedbacks:
        if fb.status == GapResolution.confirmed:
            feedback_lines.append(f"- 【確認済み】{fb.gap_axis}: {fb.gap_title}{' — ' + fb.note if fb.note else ''}")
            resolved_count += 1
        elif fb.status == GapResolution.unresolved:
            feedback_lines.append(f"- 【未解決】{fb.gap_axis}: {fb.gap_title}{' — ' + fb.note if fb.note else ''}")
            unresolved_count += 1

    post_interview_context = "\n".join(feedback_lines)

    # 元セッションの情報を取得
    session_id = report.get("session_id", "")
    session = await firestore.get("diagnosisSessions", session_id)
    messages = session.get("messages", []) if session else []
    signals = session.get("extracted_signals", []) if session else []

    # 企業プロファイルを取得
    company_profiles = await firestore.query(
        "companyRealityProfiles", {"job_id": report.get("job_id", "")}
    )
    if company_profiles:
        cp = company_profiles[0]
        company_profile = cp.get("structured_data") or await _raw_company_profile(cp)
    else:
        company_profile = {}

    # MismatchAgent を再実行（面談後コンテキスト付き）
    analysis = await mismatch_agent.run_mismatch_analysis(
        company_profile=company_profile,
        candidate_signals=signals,
        conversation_messages=messages,
        post_interview_context=post_interview_context,
    )

    before_score = report.get("overall_score", 60)
    after_score = analysis.get("overall_score", 60)

    # 新リビジョンのレポートを保存
    new_report_id = firestore.new_id()
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
            evidence=EvidenceItem(**g["evidence"]) if g.get("evidence") else None,
        )
        for g in analysis.get("gaps", [])
    ]
    matches = [
        MatchItem(axis=m["axis"], title=m["title"], detail=m["detail"])
        for m in analysis.get("matches", [])
    ]

    await firestore.save("mismatchReports", new_report_id, {
        "session_id": session_id,
        "user_id": report.get("user_id", ""),
        "job_id": report.get("job_id", ""),
        "overall_score": after_score,
        "axis_scores": [a.model_dump() for a in axis_scores],
        "gaps": [g.model_dump() for g in gaps],
        "matches": [m.model_dump() for m in matches],
        "questions": report.get("questions", []),
        "candidate_summary": analysis.get("candidate_summary", ""),
        "guardrail_passed": report.get("guardrail_passed", True),
        "guardrail_issues": [],
        "confidence": analysis.get("confidence", 0.75),
        "revision": report.get("revision", 1) + 1,
        "parent_report_id": report_id,
        "post_interview_feedbacks": [f.model_dump() for f in body.feedbacks],
        "created_at": datetime.utcnow().isoformat(),
    })

    await audit.log(report.get("user_id", ""), "post_interview_submitted", new_report_id)

    return PostInterviewResponse(
        new_report_id=new_report_id,
        before_score=before_score,
        after_score=after_score,
        delta=after_score - before_score,
        resolved_count=resolved_count,
        unresolved_count=unresolved_count,
    )


@router.get("/my/reports")
async def my_reports(principal: Principal = Depends(get_principal)):
    """ログイン中ユーザーの保存済みレポート一覧（マイレポート）。"""
    reports = await firestore.query("mismatchReports", {"user_id": principal.uid})
    # 最新リビジョンのみを表示（他のレポートから親として参照されていないもの = 最新）
    all_child_ids = {r.get("parent_report_id") for r in reports if r.get("parent_report_id")}
    # 子レポートがある場合は親を除外して子のみ、ない場合はそのまま
    latest_reports = []
    for r in reports:
        rid = r.get("id")
        if rid not in all_child_ids:
            latest_reports.append(r)
    latest_reports.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    items = [
        {
            "id": r.get("id"),
            "job_id": r.get("job_id"),
            "overall_score": r.get("overall_score"),
            "candidate_summary": r.get("candidate_summary", ""),
            "created_at": r.get("created_at"),
            "gap_count": len(r.get("gaps", [])),
            "revision": r.get("revision", 1),
            "parent_report_id": r.get("parent_report_id"),
        }
        for r in latest_reports
    ]
    return {"items": items, "total": len(items)}


class ClaimRequest(BaseModel):
    guest_id: str


@router.post("/my/claim")
async def claim_guest(body: ClaimRequest, principal: Principal = Depends(get_principal)):
    """ゲスト(guest-*)が作成した診断/レポートを、ログイン中アカウントへ引き継ぐ。"""
    if not body.guest_id.startswith("guest-"):
        raise HTTPException(status_code=400, detail="不正なゲストIDです")
    if body.guest_id == principal.uid:
        return {"claimed": 0}
    moved = 0
    for collection in ("mismatchReports", "diagnosisSessions"):
        docs = await firestore.query(collection, {"user_id": body.guest_id})
        for d in docs:
            if d.get("id"):
                await firestore.update(collection, d["id"], {"user_id": principal.uid})
                moved += 1
    return {"claimed": moved}


@router.post(
    "/reports/{report_id}/follow-up-plan",
    response_model=FollowUpPlanResponse,
    dependencies=[Depends(rate_limiter(max_requests=10, window_seconds=60))],
)
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


@router.post(
    "/reports/{report_id}/autopilot",
    response_model=AutopilotResponse,
    dependencies=[Depends(rate_limiter(max_requests=5, window_seconds=60))],
)
async def run_autopilot(report_id: str):
    """
    診断レポートに対しAIエージェントが自律的に次のアクションを判断し、
    確認質問の優先順位付けからフォロー計画生成までを一気通貫で実行する。
    OrchestratorAgent → (優先質問の絞り込み) → FollowUpAgent の順で処理する。
    """
    report = await firestore.get("mismatchReports", report_id)
    if not report:
        raise HTTPException(status_code=404, detail="レポートが見つかりません")

    await agent_progress.start("autopilot", report_id, AUTOPILOT_STEPS)

    try:
        await agent_progress.step_running("autopilot", report_id, "orchestrator")
        decision = await orchestrator_agent.decide_followup_strategy(
            axis_scores=report.get("axis_scores", []),
            gaps=report.get("gaps", []),
            confidence=report.get("confidence", 0.75),
        )
        focus_axes = decision["focus_axes"]
        await agent_progress.step_done("autopilot", report_id, "orchestrator")

        await agent_progress.step_running("autopilot", report_id, "prioritize")
        questions = report.get("questions", [])
        if focus_axes:
            focus_set = set(focus_axes)
            questions = sorted(questions, key=lambda q: 0 if q.get("axis") in focus_set else 1)
        await agent_progress.step_done("autopilot", report_id, "prioritize")

        await agent_progress.step_running("autopilot", report_id, "followup")
        tasks = await followup_agent.generate_followup_plan(
            gaps=report.get("gaps", []),
            questions=questions,
            overall_score=report.get("overall_score", 60),
            focus_axes=focus_axes,
        )
        await agent_progress.step_done("autopilot", report_id, "followup")

        plan_id = firestore.new_id()
        await firestore.save("followUpPlans", plan_id, {
            "report_id": report_id,
            "user_id": report["user_id"],
            "tasks": [t.model_dump() for t in tasks],
            "approved": False,
            "autopilot": True,
            "decision_action": decision["action"],
            "decision_reasoning": decision["reasoning"],
            "decision_focus_axes": focus_axes,
            "created_at": datetime.utcnow().isoformat(),
        })

        await audit.log(report["user_id"], "autopilot_followup_generated", plan_id)
        await agent_progress.finish("autopilot", report_id)
    except Exception:
        await agent_progress.fail("autopilot", report_id)
        raise

    return AutopilotResponse(
        decision=AutopilotDecision(
            action=decision["action"],
            reasoning=decision["reasoning"],
            focus_axes=focus_axes,
        ),
        priority_questions=questions[:4],
        plan_id=plan_id,
        tasks=tasks,
        owner_suggestion="人事担当",
    )


@router.get(
    "/reports/{report_id}/autopilot-progress",
    dependencies=[Depends(rate_limiter(max_requests=120, window_seconds=60))],
)
async def get_autopilot_progress(report_id: str):
    """
    Autopilot実行中の Agent Console 進捗を返す（フロントが1.5秒間隔でポーリングする）。
    進捗ドキュメントが無い場合も404にせず status="unknown" を返す。
    """
    doc = await agent_progress.get("autopilot", report_id)
    if not doc:
        return {"status": "unknown", "steps": []}
    return doc


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

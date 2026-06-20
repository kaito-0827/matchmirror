from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.models.followup import CompanyDashboard, DashboardCandidate, DashboardTrends, TrendPoint
from app.db import firestore
from collections import defaultdict

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/company-dashboard/jobs/{job_id}", response_model=CompanyDashboard)
async def get_company_dashboard(job_id: str):
    """
    企業向け集計ダッシュボードを取得する。
    候補者の不安カテゴリ・フォロー優先度・採用広報改善案を返す。
    候補者個人情報は抽象化し、カテゴリのみを表示する。
    """
    reports = await firestore.query("mismatchReports", {"job_id": job_id})

    # 最新リビジョンのみを集計対象にする
    child_ids = {r.get("parent_report_id") for r in reports if r.get("parent_report_id")}
    latest_reports = [r for r in reports if r.get("id") not in child_ids]

    risk_categories: dict[str, int] = {}
    common_questions: list[str] = []
    candidates: list[DashboardCandidate] = []
    high_risk_count = 0
    pending_followup_count = 0
    pending_concern_count = 0

    for i, report in enumerate(latest_reports):
        for gap in report.get("gaps", []):
            cat = gap.get("axis", "その他")
            risk_categories[cat] = risk_categories.get(cat, 0) + 1
            if gap.get("severity") == "high":
                high_risk_count += 1

        for q in report.get("questions", [])[:2]:
            if q.get("text") and q["text"] not in common_questions:
                common_questions.append(q["text"])

        display_name = f"候補者{chr(65 + i)}"
        main_concerns = [g["axis"] for g in report.get("gaps", [])[:2]]
        risk_level = "high" if report.get("overall_score", 60) < 50 else "medium"
        recommended_action = _recommend_action(report.get("gaps", []))

        # 面談後フィードバックがあるか確認
        has_post_interview = bool(report.get("parent_report_id") is None and
                                  await _has_child_report(report.get("id", "")))

        # unresolved ギャップ数（面談後フィードバック記録済みの場合）
        unresolved_count = sum(
            1 for g in report.get("gaps", [])
            if g.get("resolution") == "unresolved"
        )
        if unresolved_count > 0:
            pending_concern_count += 1

        candidates.append(DashboardCandidate(
            user_id=report.get("user_id", ""),
            display_name=display_name,
            main_concerns=main_concerns,
            risk_level=risk_level,
            recommended_action=recommended_action,
            report_id=report.get("id"),
            has_post_interview=has_post_interview,
            unresolved_count=unresolved_count,
        ))

        plans = await firestore.query("followUpPlans", {"report_id": report.get("id", "")})
        if not plans or not plans[0].get("approved"):
            pending_followup_count += 1

    if not latest_reports:
        return _mock_dashboard(job_id)

    return CompanyDashboard(
        job_id=job_id,
        risk_categories=risk_categories,
        common_questions=common_questions[:5],
        candidates=candidates,
        total_count=len(latest_reports),
        high_risk_count=high_risk_count,
        pending_followup_count=pending_followup_count,
        pending_concern_count=pending_concern_count,
    )


@router.get("/company-dashboard/jobs/{job_id}/trends")
async def get_dashboard_trends(job_id: str, period: str = "month"):
    """
    不安カテゴリの時系列トレンドを返す。
    候補者個人は出さず、軸別件数の月次推移のみ。
    """
    reports = await firestore.query("mismatchReports", {"job_id": job_id})
    # 最新リビジョンのみ
    child_ids = {r.get("parent_report_id") for r in reports if r.get("parent_report_id")}
    latest_reports = [r for r in reports if r.get("id") not in child_ids]

    if not latest_reports:
        return _mock_trends()

    # created_at で月次バケット化
    monthly: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in latest_reports:
        created_at = r.get("created_at", "")
        if created_at:
            month_key = created_at[:7]  # "2026-06"
            for gap in r.get("gaps", []):
                axis = gap.get("axis", "その他")
                monthly[month_key][axis] += 1

    sorted_months = sorted(monthly.keys())
    points = [
        TrendPoint(period=m, axis_counts=dict(monthly[m]))
        for m in sorted_months
    ]

    # 直近2ヶ月のデルタを計算
    deltas: dict[str, int] = {}
    if len(sorted_months) >= 2:
        prev = monthly[sorted_months[-2]]
        curr = monthly[sorted_months[-1]]
        all_axes = set(list(prev.keys()) + list(curr.keys()))
        for axis in all_axes:
            deltas[axis] = curr.get(axis, 0) - prev.get(axis, 0)

    return DashboardTrends(points=points, deltas=deltas)


async def _has_child_report(report_id: str) -> bool:
    """このレポートを親とする子レポートが存在するか確認する。"""
    children = await firestore.query("mismatchReports", {"parent_report_id": report_id})
    return len(children) > 0


def _recommend_action(gaps: list[dict]) -> str:
    if not gaps:
        return "定期面談でフォローアップ"
    top_gap = gaps[0]
    axis = top_gap.get("axis", "")
    actions = {
        "文化・価値観": "現場面談を設定",
        "OJT体制": "OJT担当者との面談を設定",
        "条件・制度": "制度説明資料を共有",
        "有休運用": "有休運用の実態を説明",
        "仕事内容": "初月タスク例を提示",
        "働き方": "働き方説明資料を共有",
    }
    return actions.get(axis, "個別面談でフォローアップ")


def _mock_dashboard(job_id: str) -> CompanyDashboard:
    return CompanyDashboard(
        job_id=job_id,
        risk_categories={
            "OJT / 育成体制": 2,
            "有休運用の実態": 2,
            "仕事内容の比率": 1,
        },
        common_questions=[
            "入社後1カ月は誰にどの頻度で相談できますか？",
            "チーム内で有休を取る時の調整方法は？",
            "企画業務と運用業務の比率はどれくらいですか？",
        ],
        candidates=[
            DashboardCandidate(user_id="u1", display_name="候補者A", main_concerns=["OJT / 自走文化", "有休運用"], risk_level="high", recommended_action="現場面談を設定", has_post_interview=True, unresolved_count=1),
            DashboardCandidate(user_id="u2", display_name="候補者B", main_concerns=["有休運用", "仕事内容比率"], risk_level="medium", recommended_action="制度説明資料を共有", has_post_interview=False, unresolved_count=0),
            DashboardCandidate(user_id="u3", display_name="候補者C", main_concerns=["仕事内容比率"], risk_level="low", recommended_action="初月タスク例を提示", has_post_interview=False, unresolved_count=0),
        ],
        total_count=3,
        high_risk_count=1,
        pending_followup_count=2,
        pending_concern_count=1,
    )


def _mock_trends() -> DashboardTrends:
    return DashboardTrends(
        points=[
            TrendPoint(period="2026-04", axis_counts={"文化・価値観": 3, "働き方": 2, "条件・制度": 1}),
            TrendPoint(period="2026-05", axis_counts={"文化・価値観": 4, "働き方": 1, "条件・制度": 2}),
            TrendPoint(period="2026-06", axis_counts={"文化・価値観": 2, "働き方": 3, "条件・制度": 1}),
        ],
        deltas={"文化・価値観": -2, "働き方": 2, "条件・制度": -1},
    )

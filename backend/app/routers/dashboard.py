from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.models.followup import CompanyDashboard, DashboardCandidate
from app.db import firestore

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/company-dashboard/jobs/{job_id}", response_model=CompanyDashboard)
async def get_company_dashboard(job_id: str):
    """
    企業向け集計ダッシュボードを取得する。
    候補者の不安カテゴリ・フォロー優先度・採用広報改善案を返す。
    候補者個人情報は抽象化し、カテゴリのみを表示する。
    """
    # 当該求人のレポートを集計
    reports = await firestore.query("mismatchReports", {"job_id": job_id})

    risk_categories: dict[str, int] = {}
    common_questions: list[str] = []
    candidates: list[DashboardCandidate] = []
    high_risk_count = 0
    pending_followup_count = 0

    for i, report in enumerate(reports):
        # 不安カテゴリ集計（候補者個人情報は出さない）
        for gap in report.get("gaps", []):
            cat = gap.get("axis", "その他")
            risk_categories[cat] = risk_categories.get(cat, 0) + 1
            if gap.get("severity") == "high":
                high_risk_count += 1

        # よくある質問を集計
        for q in report.get("questions", [])[:2]:
            if q.get("text") and q["text"] not in common_questions:
                common_questions.append(q["text"])

        # 候補者サマリー（個人を特定できない表示名）
        display_name = f"候補者{chr(65 + i)}"
        main_concerns = [g["axis"] for g in report.get("gaps", [])[:2]]
        risk_level = "high" if report.get("overall_score", 60) < 50 else "medium"
        recommended_action = _recommend_action(report.get("gaps", []))

        candidates.append(DashboardCandidate(
            user_id=report.get("user_id", ""),
            display_name=display_name,
            main_concerns=main_concerns,
            risk_level=risk_level,
            recommended_action=recommended_action,
            report_id=report.get("id"),
        ))

        # フォロー未完了チェック
        plans = await firestore.query("followUpPlans", {"report_id": report.get("id", "")})
        if not plans or not plans[0].get("approved"):
            pending_followup_count += 1

    # データがない場合はモックデータを返す
    if not reports:
        return _mock_dashboard(job_id)

    return CompanyDashboard(
        job_id=job_id,
        risk_categories=risk_categories,
        common_questions=common_questions[:5],
        candidates=candidates,
        total_count=len(reports),
        high_risk_count=high_risk_count,
        pending_followup_count=pending_followup_count,
    )


def _recommend_action(gaps: list[dict]) -> str:
    if not gaps:
        return "定期面談でフォローアップ"
    top_gap = gaps[0]
    axis = top_gap.get("axis", "")
    severity = top_gap.get("severity", "medium")
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
            "OJT / 育成体制": 8,
            "有休運用の実態": 6,
            "仕事内容の比率": 5,
            "評価制度": 3,
        },
        common_questions=[
            "入社後1カ月は誰にどの頻度で相談できますか？",
            "チーム内で有休を取る時の調整方法は？",
            "企画業務と運用業務の比率はどれくらいですか？",
        ],
        candidates=[
            DashboardCandidate(user_id="u1", display_name="Aさん", main_concerns=["OJT / 自走文化"], risk_level="high", recommended_action="現場面談を設定"),
            DashboardCandidate(user_id="u2", display_name="Bさん", main_concerns=["有休運用"], risk_level="medium", recommended_action="制度説明資料を共有"),
            DashboardCandidate(user_id="u3", display_name="Cさん", main_concerns=["仕事内容比率"], risk_level="low", recommended_action="初月タスク例を提示"),
        ],
        total_count=12,
        high_risk_count=4,
        pending_followup_count=8,
    )

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.models.company import (
    CompanyRealityInput, CompanyProfileResponse, JobPostingCheckInput, JobPostingCheckResponse,
    JobPostingWarning, JobPostingWarningRisk, PostingExtractInput, PostingExtractResponse, ExtractedField,
    CompanyQuestion, QuestionBankResponse, QuestionnaireInput, QuestionnaireResponse, QuestionOption,
)
from app.agents import company_agent
from app.auth import Principal, get_optional_principal, get_principal
from app.config import settings
from app.db import firestore
from app.utils import audit
from app.utils.rate_limit import rate_limiter
from datetime import datetime

router = APIRouter(prefix="/api", tags=["company"])


@router.post(
    "/company-profiles",
    response_model=CompanyProfileResponse,
    dependencies=[Depends(rate_limiter(max_requests=10, window_seconds=60))],
)
async def create_company_profile(inp: CompanyRealityInput):
    """
    企業実態プロファイルを作成する。
    CompanyAgentが入力を構造化し、候補者照合用プロファイルを生成する。
    """
    completeness, missing_fields = company_agent.calculate_completeness(inp)
    if completeness < 50:
        raise HTTPException(
            status_code=422,
            detail=f"入力が不十分です。以下を追加してください: {', '.join(missing_fields)}",
        )

    structured = await company_agent.structure_company_reality(inp)

    profile_id = firestore.new_id()
    await firestore.save("companyRealityProfiles", profile_id, {
        "id": profile_id,
        "company_id": inp.company_id,
        "job_id": inp.job_id,
        "job_title": inp.job_title,
        "daily_tasks": inp.daily_tasks,
        "ojt_structure": inp.ojt_structure,
        "leave_reality": inp.leave_reality,
        "culture_values": inp.culture_values,
        "evaluation_criteria": inp.evaluation_criteria,
        "workstyle": inp.workstyle,
        "structured_data": structured,
        "completeness": completeness,
        "missing_fields": missing_fields,
        "created_at": datetime.utcnow().isoformat(),
    })

    await audit.log(
        actor_id=inp.company_id,
        action="create_company_profile",
        target=profile_id,
        metadata={"job_id": inp.job_id, "completeness": completeness},
    )

    return CompanyProfileResponse(
        profile_id=profile_id,
        completeness=completeness,
        missing_fields=missing_fields,
        message="企業実態プロファイルを作成しました。",
    )


@router.get("/company-profiles")
async def list_company_profiles():
    """
    企業実態プロファイルの一覧を返す（候補者の会社選択用）。
    個票ではなく選択に必要なメタ情報のみを軽量に返す。
    """
    profiles = await firestore.list_all("companyRealityProfiles")
    items = []
    for p in profiles:
        md = p.get("metadata", {}) or {}
        items.append({
            "job_id": p.get("job_id"),
            "company_id": p.get("company_id"),
            "job_title": p.get("job_title"),
            "name": md.get("name"),
            "industry": md.get("industry"),
            "region": md.get("region"),
            "size_band": md.get("size_band"),
            "workstyle": p.get("workstyle"),
        })
    items.sort(key=lambda x: x.get("company_id") or "")
    return {"items": items, "total": len(items)}


@router.get("/company-profiles/question-bank", response_model=QuestionBankResponse)
async def get_question_bank():
    """
    企業実態を入力するためのMBTI形式の選択式質問一覧を返す。
    認証不要（プロファイル登録前に使うテキストのみで完結する）。
    """
    questions = [
        CompanyQuestion(
            id=q["id"],
            field_key=q["field_key"],
            question=q["question"],
            options=[QuestionOption(**o) for o in q["options"]],
        )
        for q in company_agent.QUESTION_BANK
    ]
    return QuestionBankResponse(questions=questions)


@router.get("/company-profiles/mine")
async def my_company_profiles(principal: Principal = Depends(get_principal)):
    """
    ログイン中の会社アカウントに紐づく企業実態プロファイル（自社求人）一覧を返す。
    企業ダッシュボードが自社の求人・マッチを解決するために使う。
    ※ ルート順序: /company-profiles/{profile_id} より前に置くこと。
    """
    account = await firestore.get("accounts", principal.uid)
    company_id = (account or {}).get("company_id")
    if not company_id:
        return {"items": [], "total": 0, "company_id": None}

    profiles = await firestore.query("companyRealityProfiles", {"company_id": company_id})
    items = [
        {
            "profile_id": p.get("id"),
            "job_id": p.get("job_id"),
            "job_title": p.get("job_title"),
            "completeness": p.get("completeness"),
            "created_at": p.get("created_at"),
        }
        for p in profiles
    ]
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"items": items, "total": len(items), "company_id": company_id}


@router.get("/company-profiles/{profile_id}")
async def get_company_profile(profile_id: str):
    """企業実態プロファイルを取得する。"""
    profile = await firestore.get("companyRealityProfiles", profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="プロファイルが見つかりません")
    return profile


@router.get("/company-profiles/job/{job_id}")
async def get_profile_by_job(job_id: str):
    """求人IDから企業実態プロファイルを取得する。"""
    profiles = await firestore.query("companyRealityProfiles", {"job_id": job_id})
    if not profiles:
        raise HTTPException(status_code=404, detail="この求人のプロファイルが見つかりません")
    return profiles[0]


@router.post(
    "/company-profiles/extract-from-posting",
    response_model=PostingExtractResponse,
    dependencies=[Depends(rate_limiter(max_requests=10, window_seconds=60))],
)
async def extract_from_posting(body: PostingExtractInput):
    """
    求人票テキストを読み取り、企業実態フォームの自動入力値を抽出する。
    プロファイル登録前に使うため認証不要（テキストのみで完結する）。
    """
    if not body.posting_text.strip():
        raise HTTPException(status_code=422, detail="求人票のテキストを入力してください。")

    result = await company_agent.extract_reality_from_posting(body.posting_text)

    extracted_fields = [
        ExtractedField(
            field_key=f["field_key"],
            axis_label=company_agent.AXIS_LABELS.get(f["field_key"], f["field_key"]),
            value=f.get("value", ""),
            source_quote=f.get("source_quote", ""),
            in_posting=f.get("in_posting", False),
            divergence_risk=JobPostingWarningRisk(f.get("divergence_risk", "low")),
            divergence_note=f.get("divergence_note", ""),
        )
        for f in result.get("extracted_fields", [])
    ]

    return PostingExtractResponse(
        form_fields=result.get("form_fields", {}),
        extracted_fields=extracted_fields,
        missing_axes=result.get("missing_axes", []),
    )


@router.post("/company-profiles/generate-from-answers", response_model=QuestionnaireResponse)
async def generate_from_answers(body: QuestionnaireInput):
    """
    MBTI形式の質問への回答から、企業実態フォームの自動入力値を生成する。
    """
    bank_by_id = {q["id"]: q for q in company_agent.QUESTION_BANK}
    labels_by_field: dict[str, list[str]] = {}
    for ans in body.answers:
        q = bank_by_id.get(ans.question_id)
        if not q:
            continue
        option = next((o for o in q["options"] if o["value"] == ans.value), None)
        if not option:
            continue
        labels_by_field.setdefault(q["field_key"], []).append(option["label"])

    if not labels_by_field:
        raise HTTPException(status_code=422, detail="回答が見つかりません。")

    form_fields = await company_agent.generate_form_from_answers(labels_by_field)
    return QuestionnaireResponse(form_fields=form_fields)


@router.post("/company-profiles/{profile_id}/posting-check", response_model=JobPostingCheckResponse)
async def check_job_posting(
    profile_id: str,
    body: JobPostingCheckInput,
    principal: Optional[Principal] = Depends(get_optional_principal),
):
    """
    求人票テキストと登録済み実態プロファイルのギャップを診断する。
    誇張・曖昧・乖離のある表現を検出し、改善案を提示する。
    """
    # 本番では認証必須 + オーナーチェック
    if not settings.is_development:
        if not principal:
            raise HTTPException(status_code=401, detail="認証が必要です")

    profile = await firestore.get("companyRealityProfiles", profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="プロファイルが見つかりません")

    if not settings.is_development and principal:
        if profile.get("company_id") != principal.uid:
            raise HTTPException(status_code=403, detail="このプロファイルへのアクセス権がありません")

    reality_profile = profile.get("structured_data") or {
        "daily_tasks": profile.get("daily_tasks"),
        "ojt_structure": profile.get("ojt_structure"),
        "leave_reality": profile.get("leave_reality"),
        "culture_values": profile.get("culture_values"),
        "evaluation_criteria": profile.get("evaluation_criteria"),
        "workstyle": profile.get("workstyle"),
    }

    result = await company_agent.analyze_posting_gap(
        posting_text=body.posting_text,
        reality_profile=reality_profile,
    )

    warnings = [
        JobPostingWarning(
            phrase=w["phrase"],
            issue=w["issue"],
            risk_level=JobPostingWarningRisk(w.get("risk_level", "medium")),
            suggestion=w["suggestion"],
        )
        for w in result.get("warnings", [])
    ]

    # 診断結果を保存（履歴・改善追跡用）
    check_id = firestore.new_id()
    await firestore.save("postingChecks", check_id, {
        "profile_id": profile_id,
        "job_id": profile.get("job_id"),
        "company_id": profile.get("company_id"),
        "posting_text": body.posting_text[:500],  # 先頭500文字のみ保存
        "warning_count": len(warnings),
        "overall_risk": result.get("overall_risk", "medium"),
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    })

    return JobPostingCheckResponse(
        warnings=warnings,
        overall_risk=JobPostingWarningRisk(result.get("overall_risk", "medium")),
        summary=result.get("summary", ""),
        warning_count=len(warnings),
    )

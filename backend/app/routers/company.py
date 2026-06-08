from fastapi import APIRouter, HTTPException
from app.models.company import CompanyRealityInput, CompanyProfileResponse
from app.agents import company_agent
from app.db import firestore
from app.utils import audit
from datetime import datetime

router = APIRouter(prefix="/api", tags=["company"])


@router.post("/company-profiles", response_model=CompanyProfileResponse)
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

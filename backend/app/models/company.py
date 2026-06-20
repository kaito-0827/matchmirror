from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CompanyRealityInput(BaseModel):
    company_id: str
    job_id: str
    job_title: str
    daily_tasks: str = Field(..., description="日次業務・仕事内容の実態")
    ojt_structure: str = Field(..., description="OJT/育成体制")
    leave_reality: str = Field(..., description="有休・残業の運用実態")
    culture_values: str = Field(..., description="文化・価値観")
    evaluation_criteria: Optional[str] = Field(None, description="評価基準")
    workstyle: Optional[str] = Field(None, description="出社・リモート・残業実態")


class CompanyRealityProfile(BaseModel):
    id: str
    company_id: str
    job_id: str
    job_title: str
    daily_tasks: str
    ojt_structure: str
    leave_reality: str
    culture_values: str
    evaluation_criteria: Optional[str] = None
    workstyle: Optional[str] = None
    structured_data: Optional[dict] = None
    completeness: int = 0
    missing_fields: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CompanyProfileResponse(BaseModel):
    profile_id: str
    completeness: int
    missing_fields: list[str]
    message: str


class JobPostingCheckInput(BaseModel):
    posting_text: str = Field(..., description="求人票のテキスト全文")


class JobPostingWarningRisk(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class JobPostingWarning(BaseModel):
    phrase: str
    issue: str
    risk_level: JobPostingWarningRisk
    suggestion: str


class JobPostingCheckResponse(BaseModel):
    warnings: List[JobPostingWarning]
    overall_risk: JobPostingWarningRisk
    summary: str
    warning_count: int

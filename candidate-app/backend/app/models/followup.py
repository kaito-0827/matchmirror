from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"


class FollowUpTask(BaseModel):
    id: str
    title: str
    axis: str
    due_label: str
    days_before_join: Optional[int] = None
    days_after_join: Optional[int] = None
    owner: str
    status: TaskStatus = TaskStatus.pending
    detail: Optional[str] = None


class FollowUpPlan(BaseModel):
    id: str
    report_id: str
    user_id: str
    tasks: List[FollowUpTask]
    approved: bool = False
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FollowUpPlanResponse(BaseModel):
    plan_id: str
    tasks: List[FollowUpTask]
    owner_suggestion: str


class DashboardCandidate(BaseModel):
    user_id: str
    display_name: str
    main_concerns: List[str]
    risk_level: str
    recommended_action: str
    report_id: Optional[str] = None


class CompanyDashboard(BaseModel):
    job_id: str
    risk_categories: dict
    common_questions: List[str]
    candidates: List[DashboardCandidate]
    total_count: int
    high_risk_count: int
    pending_followup_count: int

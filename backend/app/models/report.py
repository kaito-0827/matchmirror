from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class GapResolution(str, Enum):
    confirmed = "confirmed"
    unresolved = "unresolved"
    pending = "pending"


class EvidenceItem(BaseModel):
    company_quote: str
    candidate_quote: str


class AxisScore(BaseModel):
    axis: str
    score: int = Field(..., ge=0, le=100)
    color: str
    summary: str


class GapItem(BaseModel):
    axis: str
    title: str
    detail: str
    severity: RiskLevel
    recommended_question: Optional[str] = None
    evidence: Optional[EvidenceItem] = None
    resolution: GapResolution = GapResolution.pending


class MatchItem(BaseModel):
    axis: str
    title: str
    detail: str


class RecommendedQuestion(BaseModel):
    id: str
    axis: str
    text: str
    priority: RiskLevel
    background: Optional[str] = None


class MismatchReport(BaseModel):
    id: str
    session_id: str
    user_id: str
    job_id: str
    overall_score: int
    axis_scores: List[AxisScore]
    gaps: List[GapItem]
    matches: List[MatchItem]
    questions: List[RecommendedQuestion]
    candidate_summary: str
    guardrail_passed: bool = True
    guardrail_notes: Optional[str] = None
    guardrail_issues: List[str] = []
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    parent_report_id: Optional[str] = None
    revision: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReportGenerateResponse(BaseModel):
    report_id: str
    overall_score: int
    axis_scores: List[AxisScore]
    gaps: List[GapItem]
    matches: List[MatchItem]
    questions: List[RecommendedQuestion]
    candidate_summary: str
    guardrail_passed: bool
    guardrail_issues: List[str] = []
    confidence: float


class PostInterviewFeedbackItem(BaseModel):
    gap_axis: str
    gap_title: str
    status: GapResolution
    note: Optional[str] = None


class PostInterviewRequest(BaseModel):
    feedbacks: List[PostInterviewFeedbackItem]


class PostInterviewResponse(BaseModel):
    new_report_id: str
    before_score: int
    after_score: int
    delta: int
    resolved_count: int
    unresolved_count: int


class GuardrailLogEntry(BaseModel):
    report_id: str
    issues: List[str]
    original: str
    safe_version: Optional[str] = None
    action: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

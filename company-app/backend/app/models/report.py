from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


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
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
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
    confidence: float

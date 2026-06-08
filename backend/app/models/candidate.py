from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CareerStage(str, Enum):
    new_grad = "new_grad"
    mid_career = "mid_career"


class CandidateProfileInput(BaseModel):
    user_id: str
    career_stage: CareerStage
    priorities: List[str] = Field(..., description="重視する条件リスト")
    anxieties: List[str] = Field(..., description="不安・懸念点リスト")
    deal_breakers: List[str] = Field(default=[], description="避けたい条件")
    career_goals: Optional[str] = Field(None, description="キャリア期待・目標")


class CandidateProfile(BaseModel):
    id: str
    user_id: str
    career_stage: CareerStage
    priorities: List[str]
    anxieties: List[str]
    deal_breakers: List[str] = []
    career_goals: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

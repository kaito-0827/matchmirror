from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class SessionStatus(str, Enum):
    active = "active"
    completed = "completed"
    report_generated = "report_generated"


class MessageRole(str, Enum):
    ai = "ai"
    user = "user"


class ChatMessage(BaseModel):
    role: MessageRole
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    extracted_signals: List[str] = []


class DiagnosisSessionCreate(BaseModel):
    user_id: str
    job_id: str


class DiagnosisSession(BaseModel):
    id: str
    user_id: str
    job_id: str
    status: SessionStatus = SessionStatus.active
    messages: List[ChatMessage] = []
    extracted_signals: List[str] = []
    question_index: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SessionCreateResponse(BaseModel):
    session_id: str
    first_question: str


class MessageRequest(BaseModel):
    text: str


class MessageResponse(BaseModel):
    next_question: str
    extracted_signals: List[str]
    progress: int
    is_complete: bool
    quick_replies: List[str] = []

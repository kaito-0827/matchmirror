from __future__ import annotations
"""
Firebase Auth と紐づくアカウント・会社・ユーザーのデータモデル。

- accounts: Firebase Auth の uid を主キーとする「誰がどのロールか」の索引。
- users:    候補者(candidate)のプロフィール。doc id = uid。
- companies: 会社(company)アカウントの組織情報。doc id = 自動採番のcompany_id。
            HR担当者の uid が owner_uid / member_uids として紐づく。
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AccountRole(str, Enum):
    candidate = "candidate"
    company = "company"
    admin = "admin"


# --- accounts（uid → ロール索引） -------------------------------------------
class Account(BaseModel):
    uid: str
    email: Optional[str] = None
    role: AccountRole
    user_id: Optional[str] = None      # role=candidate のとき = uid
    company_id: Optional[str] = None   # role=company のとき所属会社ID
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- users（候補者プロフィール） --------------------------------------------
class CareerStage(str, Enum):
    new_grad = "new_grad"
    mid_career = "mid_career"


class UserRegisterInput(BaseModel):
    display_name: str = Field(..., description="表示名")
    career_stage: CareerStage = CareerStage.new_grad


class UserUpdateInput(BaseModel):
    display_name: Optional[str] = None
    career_stage: Optional[CareerStage] = None
    priorities: Optional[List[str]] = None
    anxieties: Optional[List[str]] = None
    deal_breakers: Optional[List[str]] = None
    career_goals: Optional[str] = None


class UserProfile(BaseModel):
    id: str                # = uid
    uid: str
    email: Optional[str] = None
    display_name: str
    career_stage: CareerStage = CareerStage.new_grad
    priorities: List[str] = []
    anxieties: List[str] = []
    deal_breakers: List[str] = []
    career_goals: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# --- companies（会社アカウント） --------------------------------------------
class CompanyRegisterInput(BaseModel):
    name: str = Field(..., description="会社名")
    industry: Optional[str] = None
    size_band: Optional[str] = None
    region: Optional[str] = None
    contact_email: Optional[str] = None


class CompanyUpdateInput(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    size_band: Optional[str] = None
    region: Optional[str] = None
    contact_email: Optional[str] = None


class CompanyAccount(BaseModel):
    id: str                # = company_id
    name: str
    industry: Optional[str] = None
    size_band: Optional[str] = None
    region: Optional[str] = None
    contact_email: Optional[str] = None
    owner_uid: str
    member_uids: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MeResponse(BaseModel):
    account: Account
    user: Optional[UserProfile] = None
    company: Optional[CompanyAccount] = None

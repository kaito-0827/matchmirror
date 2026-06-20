from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.routers import company, diagnosis, reports, dashboard, auth, users, companies, recommend, matches

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"MatchMirror API starting — environment: {settings.environment}")
    from app.db.firestore import get_db
    get_db()
    yield
    logger.info("MatchMirror API shutting down")


app = FastAPI(
    title="MatchMirror API",
    description="採用ミスマッチを入社前に可視化するAIエージェントAPI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(company.router)
app.include_router(recommend.router)
app.include_router(diagnosis.router)
app.include_router(reports.router)
app.include_router(matches.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "environment": settings.environment,
        "version": "1.0.0",
    }


@app.get("/api/agents")
async def list_agents():
    """実装されているAIエージェント一覧。"""
    return {
        "agents": [
            {"name": "CompanyAgent", "role": "企業実態を構造化し、CompanyRealityProfileを生成"},
            {"name": "CandidateAgent", "role": "候補者の希望・不安・価値観を対話で抽出"},
            {"name": "MismatchAgent", "role": "企業実態と候補者希望を6軸で照合しズレを検出"},
            {"name": "QuestionAgent", "role": "面接・面談で確認すべき質問を優先度順に生成"},
            {"name": "FollowUpAgent", "role": "内定前後の不安解消タスクとコミュニケーション計画を生成"},
            {"name": "GuardrailAgent", "role": "AI出力の差別性・断定表現・個人情報過剰露出を検査"},
        ]
    }

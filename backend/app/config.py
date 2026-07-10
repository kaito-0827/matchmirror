import os
from pydantic_settings import BaseSettings
from typing import List

# uvicornをどのディレクトリから起動しても backend/.env を確実に読む
_ENV_FILE = os.path.join(os.path.dirname(__file__), "..", ".env")


class Settings(BaseSettings):
    environment: str = "development"
    google_gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    google_cloud_project: str = ""
    firestore_emulator_host: str = ""
    firebase_service_account_path: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    class Config:
        env_file = _ENV_FILE
        extra = "ignore"


settings = Settings()

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    environment: str = "development"
    google_gemini_api_key: str = ""
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
        env_file = ".env"
        extra = "ignore"


settings = Settings()

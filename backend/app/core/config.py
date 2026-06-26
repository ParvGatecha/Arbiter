import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARBITER"
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "*")
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/arbiter"
    )
    
    # Redis & Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    # Inference Client
    JUDGE_PROVIDER: str = os.getenv("JUDGE_PROVIDER", "ollama")  # 'ollama', 'sglang', or 'openai'
    JUDGE_MODEL: str = os.getenv("JUDGE_MODEL", "llama3")
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://ollama:11434")
    SGLANG_URL: str = os.getenv("SGLANG_URL", "http://sglang:30000")
    
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "mock-key")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "")

    class Config:
        case_sensitive = True

settings = Settings()

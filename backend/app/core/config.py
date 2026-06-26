from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARBITER"
    ALLOWED_ORIGINS: str = "*"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/arbiter"
    
    # Redis & Celery
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Inference Client
    JUDGE_PROVIDER: str = "ollama"  # 'ollama', 'sglang', or 'openai'
    JUDGE_MODEL: str = "llama3"
    OLLAMA_URL: str = "http://ollama:11434"
    SGLANG_URL: str = "http://sglang:30000"
    
    OPENAI_API_KEY: str = "mock-key"
    OPENAI_BASE_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

settings = Settings()

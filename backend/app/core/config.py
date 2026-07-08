from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARBITER"
    ALLOWED_ORIGINS: str = "*"
    
    # Security and Encryption
    SECRET_KEY: str = "arbiter-secret-key-jwt-signing-token-verification-12345"
    ENCRYPTION_KEY: str = "Z3VpZGVsaW5lc19mb3JfZW5jcnlwdGlvbl9rZXlfMzJieXRlcw=="  # base64 encoded 32 bytes key
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/arbiter"
    
    # Redis & Celery
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Inference Client
    JUDGE_PROVIDER: str = "ollama"  # 'ollama', 'sglang', or 'openai'
    JUDGE_MODEL: str = "llama3"
    OLLAMA_URL: str = "http://ollama:11434"
    SGLANG_URL: str = "http://sglang:30000"
    
    # Provider Keys
    OPENAI_API_KEY: str = "mock-key"
    OPENAI_BASE_URL: str = ""
    ANTHROPIC_API_KEY: str = "mock-key"
    GEMINI_API_KEY: str = "mock-key"
    
    # Threat Intelligence Feed
    THREAT_INTEL_URL: str = "https://signatures.arbiter.ai/v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

settings = Settings()

from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel

try:
    from backend.app.core.config import settings
except ImportError:
    from app.core.config import settings

# Create async database engine with backend-agnostic options
engine_kwargs = {"echo": False, "future": True}
if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

# Create async session factory
async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        # Create all tables defined in db_models
        await conn.run_sync(SQLModel.metadata.create_all)
        
        # Migration check for PostgreSQL
        if "sqlite" not in settings.DATABASE_URL:
            await conn.execute(text("ALTER TABLE evaluationrun ADD COLUMN IF NOT EXISTS provider VARCHAR;"))
            await conn.execute(text("ALTER TABLE evaluationrun ADD COLUMN IF NOT EXISTS model VARCHAR;"))
            await conn.execute(text("ALTER TABLE evaluationrun ADD COLUMN IF NOT EXISTS system_prompt VARCHAR;"))

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get async database session."""
    async with async_session_maker() as session:
        yield session


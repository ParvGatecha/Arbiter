from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel
from backend.app.core.config import settings

# Create async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
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

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get async database session."""
    async with async_session_maker() as session:
        yield session

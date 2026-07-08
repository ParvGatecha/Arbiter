import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from backend.app.api.endpoints import router as api_router
from backend.app.api.runs import router as runs_router
from backend.app.api.gateway import router as gateway_router
from backend.app.core.database import init_db
from backend.app.core.config import settings

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("arbiter.main")

# Initialize OpenTelemetry Tracing with Console Span Exporter for local observability
provider = TracerProvider()
processor = BatchSpanProcessor(ConsoleSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB migrations/initialization
    logger.info("Creating database tables if not existing...")
    try:
        await init_db()
        logger.info("Database tables initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize database tables: {str(e)}")
    yield

app = FastAPI(
    title="ARBITER Platform API",
    description="Self-hosted production LLM evaluation platform with statistical regression metrics.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend dashboard accessibility
allowed_origins_list = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount core API endpoints
app.include_router(api_router, prefix="/api")
app.include_router(runs_router, prefix="/api/runs")
app.include_router(gateway_router, prefix="/api")

# Instrument FastAPI with OpenTelemetry
FastAPIInstrumentor.instrument_app(app)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "arbiter-backend"}

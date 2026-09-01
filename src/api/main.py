"""FastAPI application and routes"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config.settings import settings
from src.data.database import init_db
from .schemas import HealthResponse
from .routes import accounts, transactions, projections, prices, auth, workspace, categories, analytics, payments, recurring, admin, bugs
from .middleware import AuthMiddleware
from .middleware_cache import CacheControlMiddleware
from .rate_limit import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    db_url = os.environ.get("DATABASE_URL", "sqlite:///./ledgera.db")
    init_db(db_url)

    # Log CORS config so a browser-side "Failed to fetch" is diagnosable from
    # backend logs alone. Also flag the common footgun of running on a hosted
    # env with the localhost default still in place.
    logger.info("CORS allowed_origins=%s", settings.allowed_origins)
    if settings.allowed_origins == ["http://localhost:3000"] and os.environ.get("RAILWAY_ENVIRONMENT"):
        logger.warning(
            "ALLOWED_ORIGINS not set on Railway — CORS will reject every browser "
            "request from the deployed frontend. Set ALLOWED_ORIGINS env var to "
            "the frontend's public URL (comma-separated for multiple)."
        )
    yield


app = FastAPI(
    title="Ledgera API",
    description="Dual-approach banking + projections + line-by-line accounting",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False
)

# Rate limiter (in-memory backend; resets on container restart)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Cache headers middleware (innermost — adds Cache-Control/ETag to responses)
app.add_middleware(CacheControlMiddleware)

# JWT authentication middleware (runs after CORS, before cache)
app.add_middleware(AuthMiddleware)

# CORS configuration (outer — wraps ALL responses including auth errors)
# Origins are enumerated explicitly via ALLOWED_ORIGINS env var. Wildcard +
# credentials is spec-invalid and browsers ignore credentials in that combo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "If-None-Match"],
    expose_headers=["ETag"],
    max_age=600,
)


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint"""
    return HealthResponse(status="ok")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="ok")


# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(workspace.router, prefix="/api/v1", tags=["workspace"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["accounts"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(projections.router, prefix="/api/v1/projections", tags=["projections"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(prices.router, prefix="/api/v1/prices", tags=["prices"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(recurring.router, prefix="/api/v1/recurring", tags=["recurring"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(bugs.router, prefix="/api/v1/bugs", tags=["bugs"])


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

"""FastAPI application and routes"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from config.settings import settings
from src.data.database import get_session, init_db
from .errors import AppError
from .logging_config import configure_logging
from .schemas import HealthResponse
from .routes import accounts, transactions, projections, prices, auth, workspace, categories, analytics, payments, recurring, admin, bugs
from .middleware import AuthMiddleware
from .middleware_cache import CacheControlMiddleware
from .rate_limit import limiter
from .request_id import REQUEST_ID_HEADER, RequestIDMiddleware

logger = logging.getLogger(__name__)


def _init_sentry() -> None:
    """Initialize Sentry only when SENTRY_DSN is set. No-op otherwise."""
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if not sentry_dsn:
        logger.info("SENTRY_DSN not set — error tracking disabled")
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[FastApiIntegration(), StarletteIntegration()],
        traces_sample_rate=0.1,
        profiles_sample_rate=0.0,
        environment=os.environ.get("RAILWAY_ENVIRONMENT_NAME", "local"),
        release=os.environ.get("RAILWAY_DEPLOYMENT_ID"),
    )
    logger.info("Sentry initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    configure_logging()
    _init_sentry()

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

# Request-ID middleware — runs OUTSIDE auth so the correlation ID is available
# for every log line, including auth failures. Starlette adds middleware in
# LIFO order, so the last add_middleware is the outermost wrapper.
app.add_middleware(RequestIDMiddleware)

# CORS configuration (outer — wraps ALL responses including auth errors)
# Origins are enumerated explicitly via ALLOWED_ORIGINS env var. Wildcard +
# credentials is spec-invalid and browsers ignore credentials in that combo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # If adding a client-side SDK that decorates fetch (Sentry, OTel, analytics),
    # add its headers here — narrow list is intentional, see B33.
    allow_headers=["Authorization", "Content-Type", "If-None-Match", REQUEST_ID_HEADER],
    expose_headers=["ETag", REQUEST_ID_HEADER],
    max_age=600,
)


@app.exception_handler(AppError)
async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message, **exc.extra},
    )


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint"""
    return HealthResponse(status="ok")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Backward-compat liveness probe (Railway hits this)."""
    return HealthResponse(status="ok")


@app.get("/health/live", response_model=HealthResponse)
async def health_live():
    """Kubernetes-style liveness — process is up, no dep checks."""
    return HealthResponse(status="ok")


@app.get("/health/ready", response_model=HealthResponse)
async def health_ready():
    """Readiness probe — verifies the DB is reachable via SELECT 1."""
    gen = get_session()
    try:
        session = next(gen)
        session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("readiness probe failed")
        raise HTTPException(
            status_code=503,
            detail=f"not ready: {type(exc).__name__}",
        )
    finally:
        try:
            gen.close()
        except StopIteration:
            pass
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

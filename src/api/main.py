"""FastAPI application and routes"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.data.database import init_db
from .schemas import HealthResponse
from .routes import accounts, transactions, projections, prices, auth, workspace, categories, analytics, payments, recurring, admin, bugs
from .middleware import AuthMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    db_url = os.environ.get("DATABASE_URL", "sqlite:///./ledgera.db")
    init_db(db_url)
    yield


app = FastAPI(
    title="Ledgera API",
    description="Dual-approach banking + projections + line-by-line accounting",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False
)

# JWT authentication middleware (inner — runs after CORS)
app.add_middleware(AuthMiddleware)

# CORS configuration (outer — wraps ALL responses including auth errors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

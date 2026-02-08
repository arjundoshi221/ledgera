"""FastAPI application and routes"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from src.data.database import get_session, init_db
from .schemas import HealthResponse
from .routes import accounts, transactions, projections, prices

app = FastAPI(
    title="Ledgera API",
    description="Dual-approach banking + projections + line-by-line accounting",
    version="0.1.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Initialize database on startup"""
    db_url = "sqlite:///./ledgera.db"  # SQLite for MVP
    init_db(db_url)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="ok")


# Include routers
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(projections.router, prefix="/api/v1/projections", tags=["projections"])
app.include_router(prices.router, prefix="/api/v1/prices", tags=["prices"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

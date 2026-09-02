"""Test fixtures and utilities"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.main import app
from src.data import database as db_module
from src.data.database import get_session
from src.data.models import Base


@pytest.fixture
def test_db(monkeypatch):
    """Create an in-memory SQLite database for testing.

    Overrides both the FastAPI `get_session` dependency AND the module-level
    `_SessionLocal` — the auth middleware imports `get_session` directly (to
    do a disabled-user check) rather than via dependency injection, so the
    override alone would leave that path calling into an uninitialized DB.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_session():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_session] = override_get_session
    monkeypatch.setattr(db_module, "_SessionLocal", SessionLocal)

    # slowapi's Limiter is module-level and persists rate-limit buckets across
    # tests; disable it so tests can hit /auth/firebase repeatedly without
    # tripping the 5/minute cap.
    from src.api.rate_limit import limiter
    monkeypatch.setattr(limiter, "enabled", False)

    yield engine
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_db) -> TestClient:
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def firebase_verify(monkeypatch):
    """Intercept firebase_admin token verification for the duration of one test.

    Returns a `register(token, decoded)` callable so tests can mint fake ID
    tokens that the real /auth/firebase endpoint accepts as if Firebase had
    verified them. Unknown tokens raise InvalidIdTokenError (a FirebaseError),
    which the endpoint maps to 401.

    Firebase Admin SDK init is lazy (see src/services/firebase_service.py:
    _init_firebase), so patching verify_id_token before the endpoint fires
    short-circuits the real credential load — no network, no service account.
    """
    from firebase_admin import auth as firebase_auth

    registry: dict[str, dict] = {}

    def _fake_verify(token, **_kwargs):
        if token not in registry:
            raise firebase_auth.InvalidIdTokenError("unknown mock token")
        return registry[token]

    monkeypatch.setattr(firebase_auth, "verify_id_token", _fake_verify)

    def register(token: str, decoded: dict) -> None:
        registry[token] = decoded

    return register


def firebase_signup(client: TestClient, firebase_verify, *,
                    token: str, uid: str, email: str,
                    name: str = "Test User", email_verified: bool = True) -> dict:
    """Register a fake Firebase token and POST /auth/firebase to create a user.

    Returns the AuthResponse JSON (user_id, workspace_id, access_token, ...).
    """
    firebase_verify(token, {
        "uid": uid,
        "email": email,
        "email_verified": email_verified,
        "name": name,
    })
    resp = client.post("/auth/firebase", json={"id_token": token})
    assert resp.status_code == 200, resp.text
    return resp.json()

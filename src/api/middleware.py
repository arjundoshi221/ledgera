"""Authentication middleware"""

import contextlib
import logging

from fastapi import Request, status
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config.settings import settings
from src.services.auth_service import AuthService

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT authentication middleware."""

    def __init__(self, app):
        super().__init__(app)
        self.auth_service = AuthService(
            secret_key=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
            token_expiry_hours=settings.jwt_expiry_hours,
        )

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public endpoints
        skip_paths = ["/auth/signup", "/auth/login", "/auth/firebase", "/health", "/health/live", "/health/ready", "/docs", "/openapi.json", "/redoc"]
        if request.url.path in skip_paths:
            request.state.user_id = None
            request.state.workspace_id = None
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            request.state.user_id = None
            request.state.workspace_id = None
            return await call_next(request)

        token = auth_header[7:]

        # Decode token
        result = self.auth_service.decode_access_token(token)
        if not result:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or expired token"},
                headers={"WWW-Authenticate": "Bearer"}
            )

        user_id, workspace_id = result
        request.state.user_id = str(user_id)
        request.state.workspace_id = str(workspace_id)

        # Block disabled users from accessing any endpoint. Fail closed:
        # if the DB check itself errors we cannot verify account state, so
        # refuse the request rather than let a disabled user slip through.
        from src.data.database import get_session as _get_session
        from src.data.models import UserModel

        gen = _get_session()
        try:
            db = next(gen)
            try:
                disabled = db.query(UserModel.id).filter(
                    UserModel.id == str(user_id),
                    UserModel.is_disabled == True,  # noqa: E712
                ).first()
            except SQLAlchemyError:
                logger.exception("disabled-user check failed for user_id=%s", user_id)
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "auth check unavailable"},
                )
        finally:
            with contextlib.suppress(StopIteration):
                gen.close()

        if disabled:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Account is disabled. Contact support."},
            )

        return await call_next(request)

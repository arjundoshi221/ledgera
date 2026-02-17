"""Authentication middleware"""

import os
from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.services.auth_service import AuthService

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT authentication middleware."""

    def __init__(self, app):
        super().__init__(app)
        self.auth_service = AuthService(secret_key=JWT_SECRET)

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public endpoints
        skip_paths = ["/auth/signup", "/auth/login", "/health", "/docs", "/openapi.json", "/redoc"]
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

        return await call_next(request)

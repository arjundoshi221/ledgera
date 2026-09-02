"""Request-ID plumbing.

Every incoming request gets a UUID either forwarded from the client via
``X-Request-Id`` or minted by the middleware. The ID is stashed in a
``ContextVar`` so log records emitted anywhere in the request lifecycle can
attach it (see ``logging_config.JsonFormatter``) and echoed back on the
response so the frontend can surface it in error toasts / support tickets.

Wired ahead of :class:`AuthMiddleware` and :class:`CacheControlMiddleware` so
even auth failures carry a correlation ID.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

REQUEST_ID_HEADER = "X-Request-Id"


def get_request_id() -> str | None:
    """Return the current request's ID, if any."""
    return request_id_var.get()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Reads / mints the correlation ID and echoes it on the response."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming if incoming else str(uuid.uuid4())
        token = request_id_var.set(request_id)
        try:
            response: Response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

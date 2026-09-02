"""Structured application errors.

Raise these from route handlers instead of ``fastapi.HTTPException`` so the
global handler in ``src.api.main`` can emit a consistent JSON envelope:

    {"code": "<machine-readable code>", "message": "<human message>", ...extra}

The frontend keys off ``code`` for typed handling; the ``extra`` payload lets
callers surface structured context (IDs, counts) without string-parsing.
"""


class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, **extra: object) -> None:
        super().__init__(message)
        self.message = message
        self.extra = extra


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class Forbidden(AppError):
    status_code = 403
    code = "forbidden"


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_failed"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


class TransferConflict(Conflict):
    code = "transfer_conflict"

"""Structured JSON logging for the FastAPI backend.

We emit one JSON object per log record to stdout so Railway (or any log
aggregator that reads container stdout) can index each field individually.
The formatter is hand-rolled to avoid a runtime dep on ``python-json-logger``.

Fields:
  * ``timestamp`` — ISO 8601, UTC, millisecond precision
  * ``level``     — record levelname
  * ``logger``    — record name
  * ``message``   — formatted message
  * ``request_id``— populated from :mod:`src.api.request_id` when set
  * ``exception`` — traceback text when ``exc_info`` is present
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from logging.config import dictConfig

from .request_id import get_request_id


class JsonFormatter(logging.Formatter):
    """Emit each record as a single JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "src.api.logging_config.JsonFormatter",
        },
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["stdout"],
        "level": "INFO",
    },
    "loggers": {
        # Uvicorn ships its own handlers; route them through ours so the
        # request lifecycle also gets JSON + request_id.
        "uvicorn": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
    },
}


def configure_logging() -> None:
    """Install the JSON dictConfig. Idempotent — safe to call multiple times."""
    dictConfig(LOGGING_CONFIG)

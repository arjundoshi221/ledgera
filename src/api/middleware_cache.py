"""
Cache middleware for FastAPI
Adds HTTP caching headers to responses
"""

import hashlib
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds HTTP caching headers to responses.

    Implements:
    - Cache-Control headers (max-age, stale-while-revalidate)
    - ETag support for conditional requests
    - Vary headers for per-user caching
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

        # Cache strategies by endpoint pattern
        self.cache_strategies = {
            # Static/rarely changing data - longer cache
            "/api/v1/categories": {"max_age": 600, "swr": 120},  # 10 min + 2 min SWR
            "/api/v1/categories/funds": {"max_age": 600, "swr": 120},
            "/api/v1/categories/subcategories": {"max_age": 600, "swr": 120},
            "/api/v1/workspace": {"max_age": 1800, "swr": 300},  # 30 min + 5 min SWR
            "/api/v1/prices/fx": {"max_age": 900, "swr": 180},  # 15 min + 3 min SWR
            "/api/v1/payments/cards": {"max_age": 600, "swr": 120},
            "/api/v1/payments/methods": {"max_age": 600, "swr": 120},

            # Frequently changing data - shorter cache
            "/api/v1/accounts": {"max_age": 300, "swr": 60},  # 5 min + 1 min SWR
            "/api/v1/transactions": {"max_age": 60, "swr": 30},  # 1 min + 30s SWR
            "/api/v1/recurring": {"max_age": 300, "swr": 60},
            "/api/v1/recurring/pending": {"max_age": 60, "swr": 30},

            # Analytics - computed, expensive
            "/api/v1/analytics/expense-split": {"max_age": 120, "swr": 60},
            "/api/v1/analytics/income-split": {"max_age": 120, "swr": 60},
            "/api/v1/analytics/income-allocation": {"max_age": 120, "swr": 60},
            "/api/v1/analytics/fund-tracker": {"max_age": 120, "swr": 60},
            "/api/v1/analytics/monthly-dashboard": {"max_age": 120, "swr": 60},
            "/api/v1/analytics/net-worth": {"max_age": 120, "swr": 60},
            "/api/v1/analytics/fund-allocation-overrides": {"max_age": 120, "swr": 60},

            # Scenarios
            "/api/v1/projections/scenarios": {"max_age": 300, "swr": 60},
        }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)

        # Check if client sent If-None-Match header (ETag validation)
        client_etag = request.headers.get("if-none-match")

        # Get the response
        response = await call_next(request)

        # Only cache successful responses
        if response.status_code != 200:
            return response

        # Check if this endpoint should be cached
        path = request.url.path
        cache_strategy = self._get_cache_strategy(path)

        if cache_strategy:
            # Add Cache-Control header
            max_age = cache_strategy["max_age"]
            swr = cache_strategy["swr"]
            response.headers["Cache-Control"] = (
                f"max-age={max_age}, stale-while-revalidate={swr}, private"
            )

            # Add Vary header for user-specific caching
            # This ensures different users get different cache entries
            response.headers["Vary"] = "Authorization"

            # Generate ETag based on response body
            # Note: This requires reading the response body, which may impact performance
            # For production, consider generating ETags at the route level
            if hasattr(response, "body"):
                etag = self._generate_etag(response.body)
                response.headers["ETag"] = etag

                # If client's ETag matches, return 304 Not Modified
                if client_etag and client_etag == etag:
                    return Response(
                        status_code=304,
                        headers={
                            "Cache-Control": response.headers["Cache-Control"],
                            "ETag": etag,
                            "Vary": "Authorization",
                        },
                    )

        return response

    def _get_cache_strategy(self, path: str) -> dict | None:
        """
        Get cache strategy for a given path.
        Matches exact paths or path prefixes.
        """
        # Exact match
        if path in self.cache_strategies:
            return self.cache_strategies[path]

        # Prefix match (for dynamic routes like /api/v1/accounts/{id})
        for pattern, strategy in self.cache_strategies.items():
            if path.startswith(pattern):
                return strategy

        return None

    def _generate_etag(self, content: bytes) -> str:
        """
        Generate an ETag from response content.
        Uses MD5 hash for simplicity (not cryptographic use).
        """
        return f'"{hashlib.md5(content).hexdigest()}"'


def add_cache_headers(
    max_age: int = 60,
    stale_while_revalidate: int = 30,
    private: bool = True,
) -> Callable:
    """
    Decorator to add cache headers to specific routes.

    Usage:
        @router.get("/my-endpoint")
        @add_cache_headers(max_age=300, stale_while_revalidate=60)
        async def my_endpoint():
            ...

    Args:
        max_age: Cache duration in seconds
        stale_while_revalidate: Time in seconds to serve stale content while revalidating
        private: If True, cache is private (user-specific), if False, cache is public
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            from fastapi import Response as FastAPIResponse

            # Call the original function
            result = await func(*args, **kwargs)

            # If result is a Response object, add headers
            if isinstance(result, FastAPIResponse):
                cache_directive = "private" if private else "public"
                result.headers["Cache-Control"] = (
                    f"{cache_directive}, max-age={max_age}, "
                    f"stale-while-revalidate={stale_while_revalidate}"
                )
                result.headers["Vary"] = "Authorization"

            return result

        return wrapper
    return decorator


# ============================================================
# Utility functions for cache invalidation hints
# ============================================================

def add_no_cache_headers(response: Response):
    """
    Add headers to prevent caching.
    Use for POST/PUT/DELETE responses or sensitive data.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"


def add_must_revalidate_headers(response: Response):
    """
    Add headers that force revalidation.
    Use for data that changes frequently but can be cached briefly.
    """
    response.headers["Cache-Control"] = "max-age=0, must-revalidate, private"
    response.headers["Vary"] = "Authorization"

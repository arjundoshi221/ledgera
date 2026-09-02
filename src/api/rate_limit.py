"""Rate limiting for auth-adjacent endpoints"""
import logging

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)


def _client_ip(request: Request) -> str:
    # Railway's edge is the only ingress path to the container, so the first
    # X-Forwarded-For entry is the untampered client IP. Off-Railway (local
    # dev, or any deploy where XFF is absent) we fall back to the socket peer.
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip, default_limits=[])

logger.info("Rate limiter key_func=_client_ip (X-Forwarded-For first entry, fallback get_remote_address)")

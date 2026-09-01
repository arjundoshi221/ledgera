"""Application settings loaded from environment via pydantic-settings."""

from typing import Annotated

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _parse_csv_list(v: object) -> list[str]:
    """Accept a comma-separated string from env or a list from code.

    Empty strings and pure whitespace entries are discarded. Whitespace
    around each entry is stripped. A list input is returned as-is.
    """
    if isinstance(v, str):
        return [item.strip() for item in v.split(",") if item.strip()]
    if isinstance(v, list):
        return v
    raise TypeError(f"ALLOWED_ORIGINS must be a comma-separated string or list, got {type(v).__name__}")


CsvList = Annotated[list[str], NoDecode, BeforeValidator(_parse_csv_list)]


class Settings(BaseSettings):
    """Typed application settings. Missing required values fail at startup."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    database_url: str = "sqlite:///./ledgera.db"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_debug: bool = False

    price_provider: str = "yahoo_finance"
    price_cache_ttl: int = 3600

    base_currency: str = "SGD"

    # Raw JSON string of the Firebase service account credentials. Required in
    # prod/preview (Railway env). Local dev may leave this unset and drop
    # `firebase-service-account.json` in the repo root as a fallback.
    firebase_service_account_json: str | None = None

    # CORS: comma-separated list of allowed origins in env (ALLOWED_ORIGINS).
    # Dev default is localhost so `python -m src.api.main` works without a
    # .env file. Prod/preview MUST override this in Railway env vars —
    # localhost is not an origin an attacker can spoof from a browser.
    allowed_origins: CsvList = ["http://localhost:3000"]


settings = Settings()

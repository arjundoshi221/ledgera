"""One-shot read-only probe of the production DB.

Reads DATABASE_URL_PUBLIC from .env (or the environment). Does NOT touch
`config.settings` on purpose — that would risk mixing prod credentials into
the local app's session factory. Prints schema shape + row counts only, no
row data. Safe to run repeatedly.

Usage:
    ./.conda/python.exe scripts/prod_readonly_probe.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


def _load_env_file(env_path: Path) -> None:
    """Minimal .env loader — avoids dotenv dep and Settings() side-effects."""
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    _load_env_file(Path(__file__).parent.parent / ".env")

    url = os.environ.get("DATABASE_URL_PUBLIC")
    if not url:
        print("FAIL: DATABASE_URL_PUBLIC not set in .env or environment.")
        return 1

    # Never print the URL. Print only the host/port so we know what we're hitting.
    from urllib.parse import urlparse
    parsed = urlparse(url)
    print(f"Target: {parsed.scheme}://{parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')}")

    engine = create_engine(url, connect_args={"connect_timeout": 10})

    with engine.connect() as conn:
        # Sanity ping.
        result = conn.execute(text("SELECT 1")).scalar()
        assert result == 1
        print("PING OK")

        # Schema shape.
        insp = inspect(engine)
        tables = sorted(insp.get_table_names())
        print(f"\nTables ({len(tables)}):")
        for t in tables:
            try:
                count = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
                print(f"  {t:40s} {count:>8}")
            except Exception as e:  # noqa: BLE001
                print(f"  {t:40s}   ERR: {e}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

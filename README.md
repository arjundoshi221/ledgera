# Ledgera

## What Ledgera is

Ledgera is projection-driven personal finance: a forward-looking allocation system for structuring income before it lands. Users define programmable rules that split income across investments, savings, and multi-currency accounts, then model multi-year trajectories against those rules. No bank integrations, no advisors — the user owns every input and every allocation. Backend is a FastAPI service over SQLAlchemy with a Next.js frontend.

## Local dev setup

Backend:

```bash
pip install -e ".[dev]"
cp .env.example .env  # then fill in JWT_SECRET at minimum
python -m src.api.main
```

Frontend:

```bash
cd frontend
cp .env.example .env.local  # then fill in NEXT_PUBLIC_FIREBASE_* values
npm install
npm run dev
```

See [.env.example](.env.example) and [frontend/.env.example](frontend/.env.example) for the full env var list.

## Repo layout

- `src/` — FastAPI backend (routes, services, domain, data layer)
- `frontend/` — Next.js app router frontend (`src/app`, `src/lib`, `src/components`)
- `config/` — `Settings` (pydantic-settings) and migration notes
- `tests/` — pytest suite for the backend
- `documentation/` — architecture docs, design docs, historical phase notes
- `development/` — internal sprint/bug tracking (gitignored)
- `pyproject.toml` — Python packaging, deps, tool config (ruff, pytest, mypy)

## Deployment

Deployed on Railway with backend and frontend running as separate services. Backend migrations run at boot via `_run_migrations()` in [src/api/main.py](src/api/main.py) (Alembic setup pending in B16). Frontend picks up `NEXT_PUBLIC_API_URL` at build time to point at the backend service URL.

## Docs pointer

Design docs, architecture, and historical context live in [`documentation/`](documentation/). Start with [ARCHITECTURE.md](documentation/ARCHITECTURE.md) and [QUICKSTART.md](documentation/QUICKSTART.md).

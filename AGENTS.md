# AGENTS.md

High-signal notes for OpenCode sessions working in this repo. Read before editing.

## Architecture

NodeWorks: Next.js frontend + three FastAPI backend services. **MongoDB is the source of truth** for app data; **Neo4j is a derived knowledge graph** written to only via manual sync endpoints (`/kbs/freelancers/ingest`, `/kbs/projects/ingest`) in `backend/ai_api/main.py`. Do not invent Neo4j writes from the frontend.

Backend services (do not confuse them):

| Service | Dir | Port | Role |
|---|---|---|---|
| `ai_api` | `backend/ai_api` | 8010 | **Canonical backend.** CV analysis + KBS + recommendations. The one the frontend and Docker actually call. Imports `cv_analysis_module` from `backend/MergedCVAnalyzer-with-KBS`. |
| `interview_api` | `backend/interview_api` | 8001 | AI technical interview microservice. Own `requirements.txt`, own `routers/`. Frontend proxies via `/api/interview/*`. |
| `cv_api` | `backend/cv_api` | 8000 | **Legacy/standalone** CV-only API. Not used by Docker or the frontend by default. |

`backend/start_backend.bat` is a legacy Windows helper that starts `cv_api` + `interview_api` only — it does **not** start `ai_api`, so it is not a complete backend. Prefer Docker or run `ai_api` manually.

The root `README.md` folder structure is **stale**: `MergedCVAnalyzer-with-KBS` and `Recommender-System` now live under `backend/`, not at the repo root. Trust the filesystem, not the README tree.

## Commands (run from repo root)

```bash
npm run dev          # frontend only (cd frontend && next dev) -> http://localhost:3000
npm run build        # production build (also the only typecheck gate; see below)
npm run lint         # ESLint on frontend
npm run docker:dev   # full stack via docker compose up --build
npm run docker:down  # stop the stack
```

Backend (local, non-Docker): start MongoDB + Neo4j first, then:

```bash
pip install -r requirements.txt
cd backend/ai_api
python -m uvicorn main:app --reload --port 8010
```

## Verification gotchas

- **No test suite and no CI.** No `pytest` config, no JS test files, no `test` script, no `.github/workflows`. Nothing runs lint/build on push — the agent is the gate. Verify via lint + build instead.
- **No `typecheck` script.** Type errors only surface during `next build`. To verify types: `npm run build` from root.
- **Lint is `eslint`, not `next lint`.** Next.js 16 removed `next lint`; the `lint` script is bare `eslint`. Running `next lint` will fail.
- Suggested order: `npm run lint` -> `npm run build`.

## Environment

- **Root `.env` is canonical.** Copy `.env.example` -> `.env` and fill secrets. Required: `MONGODB_URI`, `JWT_SECRET`, `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`, and one AI provider key.
- `ai_api/main.py` loads **both** root `.env` and `frontend/.env` (via `load_dotenv`). Root takes precedence; don't rely on per-service `.env` files existing.
- **Docker uses different host values than local.** In Compose, set `DOCKER_MONGODB_URI=mongodb://mongo:27017/nodeworks` and `DOCKER_NEO4J_URI=bolt://neo4j:7687` (service names, not `localhost`). The frontend container reaches the backend at `http://backend:8010`, but the browser still needs `NEXT_PUBLIC_CV_ANALYSIS_API_URL=http://localhost:8010/...`.
- CV provider is configurable via `CV_ANALYSIS_PROVIDER`. Provider→key mapping (from `backend/MergedCVAnalyzer-with-KBS/cv_analysis_module/config.py`): `glm`→`ZHIPUAI_API_KEY` (alias `GLM_API_KEY`), `opencode_go`→`OPENCODE_GO_API_KEY`, `openrouter`→`OPENROUTER_API_KEY`, `gemini`→`GEMINI_API_KEY`. `choose_provider()` returns `CV_ANALYSIS_PROVIDER` verbatim if set, **ignoring which keys are present** — so a provider with no matching key fails at runtime, not at startup.
- **`.env.example` mismatch gotcha:** it ships `CV_ANALYSIS_PROVIDER="glm"` + `CV_ANALYSIS_MODEL="glm-5.2"` but only an `OPENCODE_GO_API_KEY` placeholder. Copying it and filling only that key runs the `glm` provider with no GLM key. Either add `ZHIPUAI_API_KEY`/`GLM_API_KEY`, or switch `CV_ANALYSIS_PROVIDER="opencode_go"` + `CV_ANALYSIS_MODEL="deepseek-v4-pro"`. Keep `INTERVIEW_MODEL` consistent with your chosen model (interview_api falls back to `GEMINI_API_KEY` if `OPENCODE_GO_API_KEY` is absent).
- Health checks: `GET http://localhost:8010/health` (ai_api), `GET http://localhost:8001/health` (interview_api). Docker uses these for readiness.

## Frontend conventions

- Next.js 16, React 19, **strict** TypeScript, Mantine 9, Redux Toolkit, Tailwind 4, mongoose 9, react-hook-form + zod.
- Path alias: `@/*` -> `frontend/src/*` (configured in `frontend/tsconfig.json`).
- Frontend layout: `src/app` (routes + API routes), `src/components`, `src/lib` (auth, db client, models, API client, KBS sync helpers).
- `frontend/.env` and `frontend/.env.local` are gitignored; only root `.env.example` is committed.

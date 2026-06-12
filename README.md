# NodeWorks

AI-powered freelance marketplace and team formation platform. Match freelancers to projects and build optimal teams using a Neo4j Knowledge-Based System (KBS), LLM-powered CV analysis, and graph-based recommendation algorithms.

## Architecture

```
Next.js App (3000) -> AI KBS API (8010) -> Neo4j Graph DB (7687)
        |
        +-> MongoDB (27017)
```

- **Frontend** (Next.js 16 + Mantine UI) - serves the web app, REST API routes, MongoDB persistence, and JWT authentication
- **AI KBS API** (FastAPI) - manages the Neo4j knowledge graph, runs CV analysis via LLMs, and computes job/freelancer/team recommendations
- **Neo4j** - stores the KBS graph (Freelancer, Skill, Project, Role, Company nodes with bidirectional relationships)

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **MongoDB** >= 6.0 running on `localhost:27017`
- **Neo4j** >= 5.x running on `bolt://localhost:7687`
- At least one LLM API key (Gemini, GLM-4, or OpenRouter)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/AdhammElwakeel/graduation_project.git
cd graduation_project
```

### 2. Environment variables

Copy the example env files and fill in real values:

```bash
# Root-level env (used by the Python AI API)
cp .env.example .env

# Frontend env
cp frontend/.env.example frontend/.env
```

**Root `.env`** (AI KBS API + CV analyzer):

| Variable | Description | Example |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `ZHIPUAI_API_KEY` | ZhipuAI GLM-4 API key | `...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-...` |
| `CV_ANALYSIS_MODEL` | Force a specific model (`gemini`, `glm4`, `openrouter`) | Leave empty for auto-detect |
| `NEO4J_URI` | Neo4j bolt connection | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `your-password` |
| `AI_API_BASE_URL` | AI API base URL | `http://localhost:8010` |

**`frontend/.env`** (Next.js app):

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nodeworks` |
| `JWT_SECRET` | Secret for signing JWT tokens | A long random string |
| `NEXT_PUBLIC_CV_ANALYSIS_API_URL` | Browser-accessible CV analysis endpoint | `http://localhost:8010/api/analyze-cv` |
| `CV_ANALYSIS_API_URL` | Server-side CV analysis endpoint | `http://localhost:8010/api/analyze-cv` |
| `AI_API_BASE_URL` | AI KBS API base URL | `http://localhost:8010` |

### 3. Start MongoDB

Make sure MongoDB is running locally or update `MONGODB_URI` to point to your instance.

### 4. Start Neo4j

Make sure Neo4j is running. Create a new database or use the default `neo4j` database. Update `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` in `.env`.

### 5. Install and start the AI KBS API

```bash
cd backend/ai_api
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8010
```

This starts the combined KBS + CV analysis API on port 8010.

<details>
<summary>Alternative: Standalone CV Analysis API (port 8000)</summary>

If you only need CV analysis (without KBS/recommendations):

```bash
cd backend/cv_api
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
```

This runs a simpler API with just `POST /api/analyze-cv`. Update `CV_ANALYSIS_API_URL` accordingly.
</details>

### 6. Install and start the frontend

From the project root:

```bash
npm install
npm run dev
```

Or manually:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Running the Project (Summary)

You need **4 services** running simultaneously:

| # | Service | Port | Start Command |
|---|---------|------|---------------|
| 1 | MongoDB | 27017 | `mongod` or your system service |
| 2 | Neo4j | 7687 | `neo4j` console or desktop |
| 3 | AI KBS API | 8010 | `cd backend/ai_api && python3 -m uvicorn main:app --reload --port 8010` |
| 4 | Next.js | 3000 | `npm run dev` (from root or `frontend/`) |

## API Endpoints

### AI KBS API (port 8010)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/kbs/health` | Neo4j connection health |
| POST | `/api/analyze-cv` | Analyze a CV PDF (multipart) |
| POST | `/kbs/freelancers/ingest` | Sync freelancer to Neo4j graph |
| POST | `/kbs/projects/ingest` | Sync project to Neo4j graph |
| POST | `/recommendations/jobs` | Recommend jobs for a freelancer |
| POST | `/recommendations/freelancers` | Recommend freelancers for a project |
| POST | `/recommendations/teams` | Form an optimal team for a project |

### Next.js API Routes (port 3000)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |
| GET/PATCH | `/api/users/profile` | Get/update profile |
| GET/POST | `/api/projects` | List/create projects |
| GET/PATCH | `/api/projects/[id]` | Get/update a project |
| GET/POST/PATCH | `/api/proposals` | List, submit, or update proposals |
| POST | `/api/cv/analyze` | Proxy CV analysis to AI API |
| POST | `/api/kbs/freelancer/sync` | Sync freelancer to KBS |
| POST | `/api/kbs/projects/[id]/sync` | Sync project to KBS |
| GET | `/api/kbs/health` | Check KBS health |
| GET | `/api/recommendations/jobs` | KBS job recommendations |
| GET | `/api/recommendations/projects/[id]/freelancers` | Freelancer recommendations |
| GET | `/api/recommendations/projects/[id]/team` | Team formation recommendations |

## CV Analysis Models

The CV analyzer auto-detects which LLM to use based on available API keys (priority: OpenRouter > Gemini > GLM-4). Override with `CV_ANALYSIS_MODEL` in `.env`.

Supported models extract structured data from PDFs: skills, experience, education, projects, certifications - then score candidates against 30+ tech roles.

## Project Structure

```
graduation_project/
|-- frontend/                    # Next.js 16 app (Mantine UI, MongoDB, JWT)
|   |-- src/
|   |   |-- app/                 # Pages + API routes
|   |   |   |-- (auth)/          # Login, register, forgot-password
|   |   |   |-- client/          # Client dashboard, projects, proposals
|   |   |   |-- freelancer/      # Freelancer dashboard, jobs, onboarding
|   |   |   `-- api/             # REST API route handlers
|   |   |-- components/          # React components (kbs/, client/, freelancer/, landing/)
|   |   `-- lib/                 # Auth, DB, models, API client, server-side KBS sync
|   `-- package.json
|-- backend/
|   |-- ai_api/                  # FastAPI - KBS + CV analysis + recommendations (port 8010)
|   |   |-- main.py              # KnowledgeGraphService, endpoints, team formation
|   |   `-- requirements.txt
|   |-- cv_api/                  # Standalone CV analysis API (port 8000, optional)
|   |   |-- main.py
|   |   `-- requirements.txt
|   `-- MergedCVAnalyzer-with-KBS/  # CV analysis module (shared)
|       |-- cv_analysis_module/  # AI client adapters, PDF utils, role scorer
|       `-- main.py              # Batch processing + Neo4j ingestion script
|-- Recommender-System/          # Research prototype (Jupyter notebook)
|-- MergedCVAnalyzer-with-KBS/   # Root-level copy of CV analyzer
|-- architecture-kbs-recsys.excalidraw  # Architecture diagram
`-- docs/                        # GP Report & Presentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Mantine UI v9, Redux Toolkit |
| Auth | JWT (jose + bcryptjs) |
| Database | MongoDB (Mongoose), Neo4j Python driver |
| Backend | FastAPI, Python 3 |
| AI/ML | Google Gemini, ZhipuAI GLM-4, OpenRouter, xAI Grok |
| CV Processing | PyMuPDF |

# NodeWorks

NodeWorks is an AI-powered freelance and team formation platform built with Next.js, MongoDB, FastAPI, Neo4j, CV analysis, KBS, and recommendation-system features.

## Folder Structure

```
graduation_project/
|-- frontend/                   # Next.js app, API routes, UI, MongoDB models
|   |-- src/
|   |   |-- app/                # App routes, dashboards, onboarding, API routes
|   |   |-- components/         # Shared UI components
|   |   `-- lib/                # Auth, DB, API client, models, KBS sync helpers
|   |-- package.json
|   `-- .env.example
|-- backend/
|   |-- ai_api/                 # FastAPI service for CV analysis, KBS, recommendations
|   |-- cv_api/                 # Standalone CV analysis API
|   `-- MergedCVAnalyzer-with-KBS/
|-- MergedCVAnalyzer-with-KBS/   # CV analysis module/research code
|-- Recommender-System/         # Recommendation-system research prototype
|-- docs/                       # Report and presentation files
|-- package.json                # Root scripts that run the frontend
|-- requirements.txt            # Single Python dependency file
|-- .env.example
`-- README.md
```

## Requirements

- Node.js 18+
- Python 3.11+
- MongoDB running locally or remotely
- Neo4j running locally or remotely
- At least one CV-analysis API key: `GEMINI_API_KEY`, `ZHIPUAI_API_KEY`, or `OPENROUTER_API_KEY`

## Environment Setup

Copy the example files:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Update the values in both files, especially:

- `MONGODB_URI`
- `JWT_SECRET`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `AI_API_BASE_URL`
- `CV_ANALYSIS_API_URL`
- `NEXT_PUBLIC_CV_ANALYSIS_API_URL`
- One of `GEMINI_API_KEY`, `ZHIPUAI_API_KEY`, or `OPENROUTER_API_KEY`

## How to Run

### Docker: run everything with one command

Copy the root environment file and set your secrets first:

```bash
cp .env.example .env
```

For Opencode Go CV extraction, add your API settings to `.env`:

```env
CV_ANALYSIS_PROVIDER="opencode_go"
OPENCODE_GO_API_KEY="your-key"
OPENCODE_GO_BASE_URL="https://opencode.ai/zen/go/v1"
CV_ANALYSIS_MODEL="deepseek-v4-flash"
```

Start the full stack:

```bash
npm run docker:dev
```

This starts:

- Next.js frontend: `http://localhost:3000`
- FastAPI backend for CV analysis, KBS, and recommendations: `http://localhost:8010`
- Neo4j browser: `http://localhost:7474`
- MongoDB: `localhost:27017`

Stop the stack:

```bash
npm run docker:down
```

The old local workflow is still available below.

Run MongoDB and Neo4j first, then start the backend and frontend.

### 1. Start MongoDB

Use your local MongoDB service, or set `MONGODB_URI` in `frontend/.env` to a remote MongoDB database.

### 2. Start Neo4j

Use Neo4j Desktop, Neo4j Aura, or a local Neo4j server. Make sure `.env` has the correct Neo4j credentials.

### 3. Start the AI/KBS backend

```bash
pip install -r requirements.txt
cd backend/ai_api
python3 -m uvicorn main:app --reload --port 8010
```

The backend runs on `http://localhost:8010`.

### 4. Start the frontend

From the project root:

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

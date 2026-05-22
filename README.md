NodeWorks is an AI-powered freelance and team formation platform.

The project is split into a Next.js frontend and a Python FastAPI CV-analysis service.

## Getting Started

Install frontend dependencies, then run the development server:

```bash
npm install
npm run dev
```

The frontend runs from `frontend/` and starts on [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env` for the backend CV analyzer. Copy `frontend/.env.example` to `frontend/.env` for the Next.js app.

Required frontend variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `NEXT_PUBLIC_CV_ANALYSIS_API_URL`
- `CV_ANALYSIS_API_URL`

Required CV analyzer variable depends on the selected model in `backend/MergedCVAnalyzer-with-KBS/cv_analysis_module/config.py`:

- `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, or `ZHIPUAI_API_KEY`

Optional:

- `CV_ANALYSIS_MODEL` to force a specific model. If omitted, the analyzer chooses a model based on the available API key.

## CV Analysis API

```bash
cd backend/cv_api
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The API exposes `POST /api/analyze-cv` for PDF analysis.

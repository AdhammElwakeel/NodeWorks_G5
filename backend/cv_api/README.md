# CV Analysis API

FastAPI microservice that wraps the `MergedCVAnalyzer-with-KBS` module.

## Setup

```bash
cd backend/cv_api
pip install --user -r requirements.txt
```

Make sure your provider settings are set in the root `.env` file:
```
CV_ANALYSIS_PROVIDER="opencode_go"
OPENCODE_GO_API_KEY="your-key-here"
OPENCODE_GO_BASE_URL="https://opencode.ai/zen/go/v1"
CV_ANALYSIS_MODEL="deepseek-v4-pro"
```

## Run

```bash
# From backend/cv_api/
python -m uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/analyze-cv` | Upload a PDF, get structured JSON back |

### `POST /api/analyze-cv`

**Request:** `multipart/form-data` with a `file` field (PDF only)

**Response:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "years of experience": "48 months",
  "all_skills": ["React", "TypeScript", "Node.js"],
  "experience": [{"role": "Frontend Dev", "company": "Acme", "years": "2 years"}],
  "education": [{"degree": "BSc CS", "institution": "Cairo University"}],
  "projects": [...],
  "best_role": "React Frontend Developer",
  "best_score": 87.5,
  "role_rankings": [...]
}
```

## Interactive Docs

Visit `http://localhost:8000/docs` while the server is running.

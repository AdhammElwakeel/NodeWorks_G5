# Freelance Recommender API

Content-based freelancer recommendation system — individual matching and team formation.

## Files

| File | Purpose |
|------|---------|
| `api.py` | FastAPI web service — all endpoints |
| `engine.py` | Recommendation engine (individual + team) |
| `scorer.py` | Skill normalisation + role scoring |
| `db.py` | Neo4j data layer |
| `requirements.txt` | Python dependencies |

## Setup

```bash
pip install -r requirements.txt
```

Create a `.env` file:
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
BLOOM_ZIP=bloom-export.zip   # fallback if Neo4j is down
```

## Run

```bash
uvicorn api:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

## Endpoints

### POST /recommend
```json
{
  "required_skills": ["Python", "Machine Learning", "NLP"],
  "required_role": "Machine Learning Engineer",
  "team_size": 1,
  "top_k": 3
}
```
- `team_size=1` → returns best individual candidates  
- `team_size=2+` → returns optimal teams, no duplicates, no empty teams

### POST /ingest
Call this from `main.py` after every new CV is processed:
```python
import requests
requests.post("http://localhost:8000/ingest", json=cv_json)
```
The new freelancer is immediately available for recommendations.

### GET /freelancers — list all
### GET /freelancer/{email} — one profile + full role rankings
### GET /skills — all skills in the system
### GET /roles — all role definitions
### POST /reload — force full reload from Neo4j
### GET /health — liveness check

## Integrating with main.py

Add at the end of `analyze_cv()` in `main.py`:
```python
import requests
try:
    requests.post("http://localhost:8000/ingest", json=result, timeout=5)
    print("✅ Recommender updated")
except Exception:
    pass  # API offline, will sync on next reload
```

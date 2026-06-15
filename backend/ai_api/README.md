# AI KBS API

FastAPI service for manual Knowledge-Based System sync into Neo4j.

Install dependencies from the project root, then run from this directory:

```bash
pip install -r ../../requirements.txt
python3 -m uvicorn main:app --reload --port 8010
```

Endpoints:

- `GET /health`
- `GET /kbs/health`
- `POST /kbs/freelancers/ingest`
- `POST /kbs/projects/ingest`

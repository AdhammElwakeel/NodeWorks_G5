"""
api.py  —  FastAPI web service for the Freelance Recommender

Endpoints
---------
POST /recommend          →  run individual or team recommendation
POST /ingest             →  add a new freelancer (from CV JSON), auto-rescores
GET  /freelancers        →  list all freelancers in the system
GET  /freelancer/{email} →  get one freelancer's profile + role rankings
GET  /skills             →  list all known skills
GET  /roles              →  list role definitions
GET  /health             →  liveness check

Run:
    uvicorn api:app --reload --port 8000
"""

import os
import json
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scorer import pick_best_role, ROLE_DEFINITIONS
from engine import recommend_individual, recommend_team

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("recommender")


# ── In-memory store (loaded from Neo4j at startup) ───────────
# This is the single shared state. All requests read from here.
# When a new CV is ingested, only that freelancer is updated.
STORE: dict = {}          # name -> freelancer dict
SOURCE: str = "unknown"   # "neo4j" or "csv"


# ── Data loading ─────────────────────────────────────────────

def _load_data():
    global STORE, SOURCE
    # Try Neo4j first
    try:
        from db import load_from_neo4j
        STORE  = load_from_neo4j()
        SOURCE = "neo4j"
        log.info(f"✅ Loaded {len(STORE)} freelancers from Neo4j")
        return
    except Exception as e:
        log.warning(f"Neo4j unavailable ({e}), falling back to CSV...")

    # Fallback: bloom-export.zip
    import zipfile, tempfile, pandas as pd
    from collections import defaultdict

    zip_path = os.getenv("BLOOM_ZIP", "bloom-export.zip")
    if not os.path.exists(zip_path):
        log.error(f"No data source found. Set NEO4J_* env vars or provide {zip_path}")
        STORE  = {}
        SOURCE = "none"
        return

    tmp = tempfile.mkdtemp()
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(tmp)

    nodes = pd.read_csv(f"{tmp}/node-export.csv")
    graph = pd.read_csv(f"{tmp}/graph-export.csv")
    sn, en, rt = "~start_node_property_name", "~end_node_property_name", "~relationship_type"

    freelancers = {}
    for _, row in nodes[nodes["~labels"] == "Freelancer"].iterrows():
        n = row["name"]
        email = row.get("email")
        freelancers[n] = {
            "name": n,
            "email": email if pd.notna(email) else None,
            "skills": [], "experience": [], "projects": [], "education": [],
        }

    for _, row in graph[graph[rt] == "HAS_SKILL"].iterrows():
        n = row[sn]
        if n in freelancers: freelancers[n]["skills"].append(row[en])

    for _, row in graph[graph[rt] == "WORKED_AT"].iterrows():
        n = row[sn]
        if n in freelancers:
            freelancers[n]["experience"].append({
                "company": row[en],
                "role": row.get("~relationship_property_role"),
                "duration": row.get("~relationship_property_duration"),
            })

    proj_techs = defaultdict(list)
    for _, row in graph[graph[rt] == "USED_TECH"].iterrows():
        proj_techs[row[sn]].append(row[en])
    for _, row in graph[graph[rt] == "CREATED_PROJECT"].iterrows():
        n, proj = row[sn], row[en]
        if n in freelancers:
            freelancers[n]["projects"].append({
                "name": proj, "technologies": proj_techs.get(proj, [])
            })

    for _, row in graph[graph[rt] == "STUDIED_AT"].iterrows():
        n = row[sn]
        if n in freelancers:
            freelancers[n]["education"].append({
                "institution": row[en],
                "degree": row.get("~relationship_property_degree"),
            })

    STORE  = {n: pick_best_role(f) for n, f in freelancers.items()}
    SOURCE = "csv"
    log.info(f"✅ Loaded {len(STORE)} freelancers from CSV fallback")


# ── Lifespan (startup / shutdown) ────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_data()
    yield

app = FastAPI(
    title="Freelance Recommender API",
    version="2.0",
    description="Content-based recommender for freelancer matching and team formation.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────

class RecommendRequest(BaseModel):
    required_skills: list[str]  = Field(...,  example=["Python","Machine Learning","NLP"])
    required_role:   Optional[str] = Field(None, example="Machine Learning Engineer")
    team_size:       int           = Field(1,    ge=1, le=20, description="1=individual, 2+=team")
    top_k:           int           = Field(3,    ge=1, le=10, description="Number of results")

class FreelancerIngest(BaseModel):
    name:       str
    email:      str
    phone:      Optional[str] = None
    skills:     list[str]     = []
    experience: list[dict]    = []   # [{company, role, duration}]
    projects:   list[dict]    = []   # [{name, technologies:[]}]
    education:  list[dict]    = []   # [{institution, degree}]
    # Optional: pass these if already computed by your CV pipeline
    all_skills:    Optional[list[str]] = None
    best_role:     Optional[str]       = None
    best_score:    Optional[float]     = None
    role_rankings: Optional[list]      = None


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "freelancers_loaded": len(STORE), "source": SOURCE}


@app.get("/freelancers")
def list_freelancers():
    return [
        {
            "name":       f["name"],
            "email":      f["email"],
            "best_role":  f.get("best_role"),
            "role_score": round(f.get("best_score", 0), 1),
            "skills":     f.get("skills", []),
            "projects":   [p["name"] for p in f.get("projects", [])],
        }
        for f in STORE.values()
    ]


@app.get("/freelancer/{email}")
def get_freelancer(email: str):
    f = next((v for v in STORE.values() if v.get("email") == email), None)
    if not f:
        raise HTTPException(404, f"No freelancer with email {email!r}")
    return {
        **f,
        "role_rankings": [
            {"role": r["role"], "score": r["score"],
             "matched": r["matched_skills"], "missing": r["missing_skills"]}
            for r in f.get("role_rankings", [])
        ],
    }


@app.get("/skills")
def list_skills():
    skills = set()
    for f in STORE.values():
        skills.update(f.get("skills", []))
    return sorted(skills)


@app.get("/roles")
def list_roles():
    return [
        {
            "role":           name,
            "required_skills": defn["required_skills"],
            "required_years":  defn["required_years"],
        }
        for name, defn in ROLE_DEFINITIONS.items()
    ]


@app.post("/recommend")
def recommend(req: RecommendRequest):
    if not STORE:
        raise HTTPException(503, "No freelancer data loaded yet.")

    skills = [s.strip() for s in req.required_skills if s.strip()]
    if not skills:
        raise HTTPException(400, "required_skills cannot be empty.")

    if req.team_size == 1:
        return recommend_individual(STORE, skills, req.required_role, req.top_k)
    else:
        result = recommend_team(STORE, skills, req.required_role, req.team_size, req.top_k)
        if not result["results"]:
            raise HTTPException(
                422,
                f"Not enough freelancers to form a team of {req.team_size}. "
                f"Currently {len(STORE)} freelancers in the system."
            )
        return result


@app.post("/ingest")
def ingest_freelancer(f: FreelancerIngest, background_tasks: BackgroundTasks):
    """
    Add or update a freelancer in the live store.
    Call this immediately after main.py processes a new CV.
    The improved scorer runs automatically.
    """
    # Merge all_skills into skills if provided (your CV pipeline may produce both)
    merged_skills = list({*(f.skills or []), *(f.all_skills or [])})

    candidate = {
        "name":       f.name,
        "email":      f.email,
        "phone":      f.phone,
        "skills":     merged_skills,
        "experience": f.experience,
        "projects":   f.projects,
        "education":  f.education,
    }

    # Run improved scorer
    scored = pick_best_role(candidate)
    STORE[f.name] = scored

    log.info(f"Ingested: {f.name} → {scored['best_role']} ({scored['best_score']}%)")

    # Write back to Neo4j in background (non-blocking)
    background_tasks.add_task(_sync_to_neo4j, scored)

    return {
        "status":     "ingested",
        "name":       scored["name"],
        "best_role":  scored["best_role"],
        "best_score": scored["best_score"],
        "role_rankings": [
            {"role": r["role"], "score": r["score"]}
            for r in scored.get("role_rankings", [])
        ],
    }


@app.post("/reload")
def reload_data():
    """Force a full reload from Neo4j (call after bulk ingestion)."""
    _load_data()
    return {"status": "reloaded", "count": len(STORE), "source": SOURCE}


# ── Background helpers ────────────────────────────────────────

def _sync_to_neo4j(scored: dict):
    """Write updated role score back to Neo4j (runs in background)."""
    if SOURCE != "neo4j":
        return
    try:
        from db import update_role_score
        update_role_score(scored["email"], scored["best_role"], scored["best_score"])
    except Exception as e:
        log.warning(f"Neo4j sync failed for {scored['email']}: {e}")

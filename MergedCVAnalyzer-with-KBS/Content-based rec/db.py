"""
db.py  —  Neo4j data layer
Pulls ALL freelancer data live from Neo4j every time load() is called.
Call load() once at startup and again whenever a new CV is ingested.
"""
import os
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv()

try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

from scorer import pick_best_role

def _driver():
    uri  = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER",     "neo4j")
    pwd  = os.getenv("NEO4J_PASSWORD", "password")
    return GraphDatabase.driver(uri, auth=(user, pwd))

def _run(driver, query, **params):
    with driver.session() as s:
        return [r.data() for r in s.run(query, **params)]

def load_from_neo4j() -> dict:
    """
    Returns dict[name -> freelancer_dict] with improved scores applied.
    Raises ConnectionError if Neo4j is unreachable.
    """
    if not NEO4J_AVAILABLE:
        raise ConnectionError("neo4j package not installed")

    driver = _driver()
    try:
        # Test connection
        driver.verify_connectivity()
    except Exception as e:
        driver.close()
        raise ConnectionError(f"Cannot reach Neo4j: {e}")

    freelancers = {}

    # Base
    for row in _run(driver, """
        MATCH (f:Freelancer)
        RETURN f.name AS name, f.email AS email, f.phone AS phone
    """):
        n = row["name"]
        freelancers[n] = {
            "name": n, "email": row.get("email"), "phone": row.get("phone"),
            "skills": [], "experience": [], "projects": [], "education": [],
        }

    # Skills
    for row in _run(driver, """
        MATCH (f:Freelancer)-[:HAS_SKILL]->(s:Skill)
        RETURN f.name AS name, s.name AS skill
    """):
        n = row["name"]
        if n in freelancers:
            freelancers[n]["skills"].append(row["skill"])

    # Experience
    for row in _run(driver, """
        MATCH (f:Freelancer)-[r:WORKED_AT]->(c:Company)
        RETURN f.name AS name, c.name AS company, r.role AS role, r.duration AS duration
    """):
        n = row["name"]
        if n in freelancers:
            freelancers[n]["experience"].append({
                "company": row["company"], "role": row.get("role"), "duration": row.get("duration")
            })

    # Projects + tech stack
    proj_techs = defaultdict(list)
    for row in _run(driver, """
        MATCH (p:Project)-[:USED_TECH]->(s:Skill)
        RETURN p.name AS project, s.name AS tech
    """):
        proj_techs[row["project"]].append(row["tech"])

    for row in _run(driver, """
        MATCH (f:Freelancer)-[:CREATED_PROJECT]->(p:Project)
        RETURN f.name AS name, p.name AS project
    """):
        n = row["name"]
        if n in freelancers:
            freelancers[n]["projects"].append({
                "name": row["project"],
                "technologies": proj_techs.get(row["project"], [])
            })

    # Education
    for row in _run(driver, """
        MATCH (f:Freelancer)-[r:STUDIED_AT]->(i:Institution)
        RETURN f.name AS name, i.name AS institution, r.degree AS degree
    """):
        n = row["name"]
        if n in freelancers:
            freelancers[n]["education"].append({
                "institution": row["institution"], "degree": row.get("degree")
            })

    driver.close()

    # Apply improved scorer to everyone
    return {n: pick_best_role(f) for n, f in freelancers.items()}


def update_role_score(email: str, role: str, score: float):
    """Update MATCHES_ROLE edge after re-scoring a newly ingested CV."""
    driver = _driver()
    with driver.session() as s:
        s.run("""
            MATCH (f:Freelancer {email: $email})
            MERGE (r:Role {name: $role})
            MERGE (f)-[mr:MATCHES_ROLE]->(r)  SET mr.score = $score
            MERGE (r)-[sc:SUITABLE_CANDIDATE]->(f) SET sc.score = $score
        """, email=email, role=role, score=score)
    driver.close()

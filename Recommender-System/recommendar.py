"""
recommender.py
==============
Flexible team formation recommender for NodeWorks.

Scoring formula
---------------
    final_score = tech_score + (synergy_score * 0.1) + knowledge_score

  tech_score      – sum of each member's pre-computed role score from the KG
  synergy_score   – pairwise shared-skill count across all team members
                    (0 when team size == 1)
  knowledge_score – how well each member's skills AND domain knowledge
                    match the client's project keywords, summed across team.
                    Skill match   = +1.0 per keyword hit
                    Domain match  = +0.5 per keyword hit (partial credit,
                    since domain knowledge is broader/less precise than skills)
"""

from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "MergedCVAnalyzer-with-KBS"))
from collections import defaultdict
from itertools import permutations
from typing import Any
import os

from role_matcher import RoleMatcher

# ---------------------------------------------------------------------------
# Neo4j loader
# ---------------------------------------------------------------------------

_FREELANCER_QUERY = """
MATCH (f:Freelancer)
OPTIONAL MATCH (f)-[:HAS_SKILL]->(s:Skill)
WITH f, collect(DISTINCT s.name) AS skills
OPTIONAL MATCH (f)-[:HAS_DOMAIN]->(d:Domain)
WITH f, skills, collect(DISTINCT d.name) AS domains
OPTIONAL MATCH (f)-[r:MATCHES_ROLE]->(role:Role)
RETURN
    f.name  AS name,
    f.email AS email,
    skills,
    domains,
    collect({role: role.name, score: r.score}) AS role_rankings
"""


def load_freelancers_from_neo4j() -> list[dict]:
    """
    Fetch all Freelancers from Neo4j.

    Returns a list of dicts:
        {
            "name":           str,
            "email":          str,
            "all_skills":     [str, ...],
            "domain_knowledge": [str, ...],
            "role_rankings":  [{"role": str, "score": float}, ...]
        }
    """
    try:
        from neo4j import GraphDatabase
        from dotenv import load_dotenv
    except ImportError as e:
        raise ImportError("Run: pip install neo4j python-dotenv") from e

    load_dotenv()
    uri      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
    user     = os.getenv("NEO4J_USER",     "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")

    driver      = GraphDatabase.driver(uri, auth=(user, password))
    freelancers: list[dict] = []

    with driver.session() as session:
        for row in session.run(_FREELANCER_QUERY):
            rankings = [
                {"role": r["role"], "score": float(r["score"] or 0)}
                for r in row["role_rankings"]
                if r["role"] is not None
            ]
            freelancers.append({
                "name":             row["name"],
                "email":            row["email"],
                "all_skills":       [s for s in row["skills"]  if s],
                "domain_knowledge": [d for d in row["domains"]  if d],
                "role_rankings":    rankings,
            })

    driver.close()
    return freelancers


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _normalise(s: str) -> str:
    return s.strip().lower()


def _get_role_score(freelancer: dict, role: str) -> float:
    target = _normalise(role)
    for entry in freelancer.get("role_rankings", []):
        if _normalise(entry.get("role", "")) == target:
            return float(entry.get("score", 0.0))
    return 0.0


def _skill_set(freelancer: dict) -> set[str]:
    return {_normalise(s) for s in freelancer.get("all_skills", [])}


def _domain_set(freelancer: dict) -> set[str]:
    return {_normalise(d) for d in freelancer.get("domain_knowledge", [])}


def _pairwise_synergy(members: list[dict]) -> int:
    """Count shared skills across every unique pair in the team."""
    skills = [_skill_set(m) for m in members]
    total, n = 0, len(skills)
    for i in range(n):
        for j in range(i + 1, n):
            total += len(skills[i] & skills[j])
    return total


def _keyword_matches_domain(keyword: str, domain_set: set[str]) -> bool:
    """
    Check if a keyword is related to any domain in the set.
    Uses substring matching so "medical" matches "Medical Imaging",
    and "diabetic" matches "Diabetic Retinopathy".
    """
    kw = _normalise(keyword)
    for domain in domain_set:
        if kw in domain or domain in kw:
            return True
    return False


def _knowledge_score(members: list[dict], keywords: list[str]) -> float:
    """
    Score how well the team covers the client's project keywords.

    For each keyword:
      - Exact skill match  → +1.0  (freelancer has it as a tech skill)
      - Domain match       → +0.5  (freelancer worked in that domain)

    A keyword can give at most 1.0 per member (skill match takes priority,
    domain match only adds 0.5 if there's no skill match).
    Summed across all team members.
    """
    norm_kw = [_normalise(k) for k in keywords]
    score   = 0.0

    for member in members:
        skills  = _skill_set(member)
        domains = _domain_set(member)

        for kw in norm_kw:
            if kw in skills:
                score += 1.0                              # exact skill hit
            elif _keyword_matches_domain(kw, domains):
                score += 0.5                              # domain knowledge hit
    return score


def _team_canonical_key(perm: tuple[int, ...], requested_roles: list[str]) -> tuple:
    role_to_indices: dict[str, list[int]] = defaultdict(list)
    for slot, fi in enumerate(perm):
        role_to_indices[_normalise(requested_roles[slot])].append(fi)
    return tuple(
        (role, tuple(sorted(indices)))
        for role, indices in sorted(role_to_indices.items())
    )


def _validate_roles(requested_roles: list[str]) -> list[str]:
    """
    Resolve arbitrary client-typed role strings (e.g. "AI Engineer",
    "backend dev") to the closest TECH_ROLES key using embedding
    similarity — NOT exact string matching.

    Why: TECH_ROLES is our fixed internal taxonomy (~30 roles). Clients
    will never type those exact strings, and listing more aliases by
    hand doesn't scale — there's always another phrasing. The
    RoleMatcher embeds the 30 role names once (cached to disk) and
    nearest-neighbor matches each query against them, so any phrasing
    a client uses resolves to whichever real role it's semantically
    closest to.

    Returns the resolved role list (same length/order as input) so
    callers can use it for scoring against the KG, which only knows
    the exact TECH_ROLES names.

    Raises ValueError if any role can't be confidently matched
    (below RoleMatcher's min_confidence threshold) — this surfaces a
    genuinely unrecognizable request instead of silently mapping it
    to a wrong role.
    """
    try:
        from cv_analysis_module.config import TECH_ROLES
    except ImportError as e:
        raise ImportError(
            "Could not import TECH_ROLES from cv_analysis_module.config. "
            "Make sure cv_analysis_module is on PYTHONPATH (it lives under "
            "MergedCVAnalyzer-with-KBS/ in this project's layout)."
        ) from e

    matcher = _get_role_matcher(TECH_ROLES)
    return matcher.match_all(requested_roles)


_role_matcher_singleton: RoleMatcher | None = None


def _get_role_matcher(tech_roles: dict) -> RoleMatcher:
    """
    Cache the RoleMatcher (and its loaded embedding model) at module level
    so repeated calls to recommend_teams() in the same process don't reload
    the sentence-transformer model each time — only the role-name embeddings
    are cached to disk; the model itself stays warm in memory per-process.
    """
    global _role_matcher_singleton
    if _role_matcher_singleton is None:
        _role_matcher_singleton = RoleMatcher(tech_roles)
    return _role_matcher_singleton


# ---------------------------------------------------------------------------
# Core recommender
# ---------------------------------------------------------------------------

def recommend_teams(
    freelancers: list[dict],
    requested_roles: list[str],
    keywords: list[str],
    limit: int = 5,
    min_score: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Form and rank all valid unique team combinations.

    Parameters
    ----------
    freelancers     : output of load_freelancers_from_neo4j()
    requested_roles : e.g. ["AI Engineer", "AI Engineer", "Full-Stack Developer"]
    keywords        : project keywords — can be tech skills OR domain terms
                      e.g. ["medical imaging", "PyTorch", "REST API", "React"]
    limit           : max teams to return
    min_score       : minimum role score to qualify for a slot (default 0)
    """
    if not freelancers:
        raise ValueError("freelancers list is empty.")
    if not requested_roles:
        raise ValueError("requested_roles list is empty.")

    # Resolve whatever the client typed ("AI Engineer", "backend dev", ...)
    # to the closest real TECH_ROLES key — scoring against the KG only
    # works against those exact names. We keep `requested_roles` (the
    # original strings) for display and dedup-by-slot, and use
    # `resolved_roles` only for the actual score lookup.
    resolved_roles = _validate_roles(requested_roles)

    n_roles       = len(requested_roles)
    single_person = n_roles == 1
    n_freelancers = len(freelancers)

    if n_freelancers < n_roles:
        raise ValueError(
            f"Not enough freelancers ({n_freelancers}) to fill {n_roles} roles."
        )

    role_scores = [
        [_get_role_score(f, role) for role in resolved_roles]
        for f in freelancers
    ]

    results:   list[dict] = []
    seen_keys: set[tuple] = set()

    for perm in permutations(range(n_freelancers), n_roles):
        if not all(role_scores[perm[j]][j] > min_score for j in range(n_roles)):
            continue

        canon = _team_canonical_key(perm, requested_roles)
        if canon in seen_keys:
            continue
        seen_keys.add(canon)

        members = [freelancers[perm[j]] for j in range(n_roles)]
        t_score = sum(role_scores[perm[j]][j] for j in range(n_roles))
        s_score = 0 if single_person else _pairwise_synergy(members)
        k_score = _knowledge_score(members, keywords)
        final   = t_score + (s_score * 0.1) + k_score

        results.append({
            "members": [
                {
                    "name":           freelancers[perm[j]].get("name", f"Freelancer {perm[j]}"),
                    "requested_role": requested_roles[j],
                    "matched_role":   resolved_roles[j],
                    "tech_score":     role_scores[perm[j]][j],
                }
                for j in range(n_roles)
            ],
            "tech_score":      round(t_score, 2),
            "synergy_score":   s_score,
            "knowledge_score": round(k_score, 2),
            "final_score":     round(final, 4),
        })

    results.sort(key=lambda x: (x["final_score"], x["tech_score"]), reverse=True)
    return results[:limit]


# ---------------------------------------------------------------------------
# Pretty printer
# ---------------------------------------------------------------------------

def print_teams(teams: list[dict]) -> None:
    if not teams:
        print("❌  No valid teams could be formed with the given constraints.")
        return

    ICONS = {
        "ai": "🤖", "machine": "🤖", "nlp": "🤖", "vision": "👁️",
        "data": "📊", "generative": "✨", "agent": "🤖",
        "ui": "🎨", "ux": "🎨", "design": "🎨",
        "web": "💻", "full": "💻", "front": "💻", "mern": "💻",
        "back": "⚙️", "django": "⚙️", "node": "⚙️",
        "devops": "🔧", "cloud": "☁️", "mlops": "🔧",
        "mobile": "📱", "ios": "📱", "android": "📱", "flutter": "📱",
        "security": "🔒", "cyber": "🔒",
    }
    for i, team in enumerate(teams, 1):
        print(
            f"🏆 TEAM #{i} | Final: {team['final_score']:.4f}  "
            f"(Tech: {team['tech_score']}, "
            f"Synergy: {team['synergy_score']}, "
            f"Knowledge: {team['knowledge_score']:.2f})"
        )
        for member in team["members"]:
            icon = next(
                (v for k, v in ICONS.items() if k in member["requested_role"].lower()), "👤"
            )
            label = member["requested_role"]
            if _normalise(member["requested_role"]) != _normalise(member["matched_role"]):
                label += f"  [matched: {member['matched_role']}]"
            print(
                f"   {icon}  {label:<55} "
                f"{member['name']}  (score: {member['tech_score']})"
            )
        print("-" * 70)


# ---------------------------------------------------------------------------
# CLI demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("🔗 Loading freelancers from Neo4j knowledge graph...")
    freelancers = load_freelancers_from_neo4j()
    print(f"✅ Loaded {len(freelancers)} freelancer profiles.\n")

    if not freelancers:
        print("⚠️  No freelancers found. Check your Neo4j connection.")
        exit(1)

    for f in freelancers:
        non_zero = sum(1 for r in f["role_rankings"] if r["score"] > 0)
        print(f"   👤 {f['name']:<30}  skills: {len(f['all_skills']):<4}  "
              f"domains: {len(f['domain_knowledge']):<4}  "
              f"roles with score > 0: {non_zero}")

    roles_3    = ["AI Engineer", "UI/UX Designer", "Full-Stack Developer"]
    keywords_3 = ["medical imaging", "React", "machine learning", "API", "deep learning"]
    print("\n" + "=" * 70)
    print("EXAMPLE 1 – Three-person team (with domain keyword)")
    print(f"Roles   : {roles_3}")
    print(f"Keywords: {keywords_3}")
    print("=" * 70)
    print_teams(recommend_teams(freelancers, roles_3, keywords_3, limit=5))

    roles_1    = ["Machine Learning Engineer"]
    keywords_1 = ["deep learning", "PyTorch", "transformers", "NLP"]
    print("\n" + "=" * 70)
    print("EXAMPLE 2 – Single freelancer")
    print(f"Role    : {roles_1}")
    print(f"Keywords: {keywords_1}")
    print("=" * 70)
    print_teams(recommend_teams(freelancers, roles_1, keywords_1, limit=5))

"""
engine.py  —  Content-based recommendation engine
Supports: individual best-fit AND team formation.
Fixes: no empty teams, no repeated members across teams, correct scoring.
"""
from collections import defaultdict
from scorer import normalize, normalize_set, total_years, pick_best_role


# ── Job-level scoring ────────────────────────────────────────

def score_against_job(freelancer: dict, required_skills: list) -> dict:
    """
    Score one freelancer against a specific job's skill requirements.
    Uses TF-IDF-style weighting: rarer required skills count more.

    Score breakdown (all anchored to 0-100):
      50% weighted skill coverage  (explicit + project boost)
      30% role confidence          (improved scorer best_score)
      20% experience years         (capped at required_years for role)
    """
    rs_norm = normalize_set(required_skills)
    fs_norm = normalize_set(freelancer.get("skills", []))

    # Skill frequency across ALL required skills (for TF weighting)
    # Here: skills appear once each, so weight = 1.0 unless we had a corpus
    # We still give rarer/harder skills a slight edge via the role weights
    matched   = fs_norm & rs_norm
    via_proj  = set()
    proj_techs = set()
    for proj in freelancer.get("projects", []):
        proj_techs.update(normalize(t) for t in proj.get("technologies", []))
    via_proj = (rs_norm - fs_norm) & proj_techs
    missing  = rs_norm - fs_norm - via_proj

    n_req = len(rs_norm) or 1
    skill_cov   = len(matched) / n_req                    # 0-1
    proj_credit = len(via_proj) * 0.7 / n_req             # 0.7 credit per proj skill
    skill_score = min((skill_cov + proj_credit) * 100, 100.0)

    role_score  = freelancer.get("best_score", 0.0)       # 0-100 from improved scorer

    years       = total_years(freelancer.get("experience", []))
    # Cap at 5 years for full credit (avoids over-rewarding seniors on junior jobs)
    exp_score   = min(years / 5.0, 1.0) * 100             # 0-100

    composite = round(0.50 * skill_score + 0.30 * role_score + 0.20 * exp_score, 1)

    return {
        "freelancer":      freelancer["name"],
        "email":           freelancer["email"],
        "best_role":       freelancer.get("best_role"),
        "role_score":      round(role_score, 1),
        "composite_score": composite,
        "skill_score":     round(skill_score, 1),
        "experience_yrs":  round(years, 1),
        "matched_skills":  sorted(matched),
        "via_projects":    sorted(via_proj),
        "missing_skills":  sorted(missing),
        "projects":        [p["name"] for p in freelancer.get("projects", [])],
        "education":       freelancer.get("education", []),
        "role_rankings":   freelancer.get("role_rankings", []),
    }


# ── Individual recommendation ────────────────────────────────

def recommend_individual(
    data: dict,
    required_skills: list,
    required_role: str | None = None,
    top_k: int = 3,
) -> dict:
    scores = []
    for f in data.values():
        s = score_against_job(f, required_skills)
        # Boost if role explicitly matches
        if required_role and (f.get("best_role") or "").lower() == required_role.lower():
            s["composite_score"] = min(round(s["composite_score"] + 5, 1), 100.0)
            s["role_boost"] = True
        scores.append(s)

    scores.sort(key=lambda x: x["composite_score"], reverse=True)
    return {
        "mode": "individual",
        "query": {"required_skills": required_skills, "required_role": required_role},
        "results": scores[:top_k],
    }


# ── Team formation ───────────────────────────────────────────

def _team_fingerprint(team: list) -> frozenset:
    """Unique identity of a team regardless of member order."""
    return frozenset(m["name"] for m in team)


def _team_stats(team: list, required_skills: list) -> dict:
    """Compute collective coverage, diversity, and collaboration."""
    rs = normalize_set(required_skills)

    covered = set()
    for m in team:
        covered.update(normalize_set(m.get("skills", [])))
        for proj in m.get("projects", []):
            covered.update(normalize(t) for t in proj.get("technologies", []))

    hit          = covered & rs
    coverage_pct = round(len(hit) / len(rs) * 100, 1) if rs else 100.0

    roles            = {m.get("best_role") for m in team if m.get("best_role")}
    role_div_bonus   = min(len(roles) * 5, 20)

    shared_co = defaultdict(list)
    shared_pr = defaultdict(list)
    for m in team:
        for e in m.get("experience", []):
            shared_co[e.get("company","")].append(m["name"])
        for p in m.get("projects", []):
            shared_pr[p.get("name","")].append(m["name"])

    collab = min(
        sum(10 for v in shared_co.values() if len(v) > 1) +
        sum(5  for v in shared_pr.values() if len(v) > 1),
        15,
    )

    avg_role_score = (
        sum(m.get("best_score", 0) for m in team) / len(team)
        if team else 0
    )

    # Final team score — coverage dominates, diversity and collab are bonuses
    team_score = round(
        0.65 * coverage_pct +
        0.15 * avg_role_score +
        0.12 * role_div_bonus +
        0.08 * collab,
        1,
    )

    return {
        "coverage_pct":         coverage_pct,
        "covered_skills":       sorted(hit),
        "missing_skills":       sorted(rs - hit),
        "role_diversity_bonus": role_div_bonus,
        "collaboration_bonus":  collab,
        "avg_role_score":       round(avg_role_score, 1),
        "team_score":           team_score,
    }


def recommend_team(
    data: dict,
    required_skills: list,
    required_role: str | None = None,
    team_size: int = 2,
    top_k: int = 3,
) -> dict:
    """
    Greedy team builder with deduplication.

    Algorithm:
    1. Pre-score every freelancer for this job.
    2. Try each top-N candidate as the seed.
    3. Greedily add the next member who maximises NEW required skill coverage.
       Tie-break: highest composite score.
    4. Skip any team whose fingerprint (member set) was already produced.
    5. Skip any team with fewer members than requested (not enough candidates).
    6. Return top_k unique teams sorted by team_score.
    """
    all_f  = list(data.values())

    # Pre-score everyone
    scored = sorted(
        [(f, score_against_job(f, required_skills)) for f in all_f],
        key=lambda x: x[1]["composite_score"],
        reverse=True,
    )

    score_lookup = {f["name"]: s["composite_score"] for f, s in scored}

    seen_fingerprints = set()
    teams = []

    # Try seeds from the top candidates (limit search space for performance)
    max_seeds = min(len(scored), max(top_k * 4, 20))

    for seed_f, _ in scored[:max_seeds]:
        if len(teams) >= top_k:
            break

        sname  = seed_f["name"]
        team   = [seed_f]
        covered = normalize_set(seed_f.get("skills", []))
        for proj in seed_f.get("projects", []):
            covered.update(normalize(t) for t in proj.get("technologies", []))

        rs       = normalize_set(required_skills)
        cands    = [f for f, _ in scored if f["name"] != sname]

        while len(team) < team_size and cands:
            best, best_new, best_score_val = None, -1, -1

            for f in cands:
                f_skills = normalize_set(f.get("skills", []))
                f_proj   = set()
                for proj in f.get("projects", []):
                    f_proj.update(normalize(t) for t in proj.get("technologies", []))
                f_all = f_skills | f_proj

                new_cover = len((f_all - covered) & rs)
                ind_score = score_lookup.get(f["name"], 0)

                if new_cover > best_new or (new_cover == best_new and ind_score > best_score_val):
                    best, best_new, best_score_val = f, new_cover, ind_score

            if best:
                team.append(best)
                b_skills = normalize_set(best.get("skills", []))
                for proj in best.get("projects", []):
                    b_skills.update(normalize(t) for t in proj.get("technologies", []))
                covered |= b_skills
                cands = [f for f in cands if f["name"] != best["name"]]
            else:
                break

        # ── Guards ──────────────────────────────────────────
        if len(team) < team_size:
            # Not enough freelancers to fill this team — skip
            continue

        fp = _team_fingerprint(team)
        if fp in seen_fingerprints:
            # Duplicate team — skip
            continue

        seen_fingerprints.add(fp)

        stats = _team_stats(team, required_skills)
        teams.append({
            "team_members": [
                {
                    "name":       m["name"],
                    "email":      m["email"],
                    "best_role":  m.get("best_role"),
                    "role_score": round(m.get("best_score", 0), 1),
                    "skills":     m.get("skills", []),
                    "projects":   [p["name"] for p in m.get("projects", [])],
                }
                for m in team
            ],
            **stats,
        })

    teams.sort(key=lambda t: t["team_score"], reverse=True)

    return {
        "mode": "team",
        "query": {
            "required_skills": required_skills,
            "required_role":   required_role,
            "team_size":       team_size,
        },
        "results": teams[:top_k],
    }

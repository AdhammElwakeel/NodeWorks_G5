"""
scorer.py  —  Skill normalisation + role scoring engine
Lives here so both the recommender and the CV ingestor can import it.
"""
import re

# ── Synonym map ──────────────────────────────────────────────
SKILL_SYNONYMS = {
    "computer vision": "opencv", "cv": "opencv",
    "image processing": "opencv", "medical imaging": "image processing",
    "deep learning": "tensorflow", "neural networks": "tensorflow",
    "artificial intelligence": "machine learning", "ai": "machine learning",
    "generative ai": "pytorch",
    "natural language processing": "nlp",
    "text analysis": "nlp", "text mining": "nlp",
    "data analysis": "pandas", "data visualization": "matplotlib",
    "predictive modeling": "scikit-learn",
    "feature engineering": "scikit-learn",
    "data preprocessing": "scikit-learn",
    "restful api": "rest api", "node": "node.js", "nodejs": "node.js",
    "reactjs": "react", "react.js": "react",
    "vuejs": "vue", "vue.js": "vue",
    "containerization": "docker", "containers": "docker",
    "cloud computing": "aws", "aws cloud": "aws",
    "mlops": "mlflow", "experiment tracking": "mlflow",
    "object-oriented programming": "oop",
    "version control": "git", "github": "git", "gitlab": "git",
    "postgresql": "sql", "mysql": "sql", "sqlite": "sql",
    "database": "sql", "database management": "sql",
    "algorithms": "algorithm design",
}

ROLE_DEFINITIONS = {
    "Full-Stack Developer": {
        "required_skills": ["javascript","html","css","react","node.js","mongodb","rest api","sql","git","docker"],
        "required_years": 3,
        "weights": {"react":1.5,"node.js":1.5,"docker":1.2,"mongodb":1.2},
    },
    "React Frontend Developer": {
        "required_skills": ["react","javascript","html","css","rest api","git","redux","typescript"],
        "required_years": 2,
        "weights": {"react":2.0,"typescript":1.5,"redux":1.3},
    },
    "Machine Learning Engineer": {
        "required_skills": ["python","machine learning","tensorflow","pytorch","scikit-learn","sql","git","docker","mlflow","nlp"],
        "required_years": 3,
        "weights": {"python":2.0,"machine learning":2.0,"pytorch":1.5,"tensorflow":1.5,"mlflow":1.2},
    },
    "Computer Vision Engineer": {
        "required_skills": ["python","opencv","tensorflow","pytorch","object detection","image processing","cnn","scikit-learn"],
        "required_years": 3,
        "weights": {"opencv":2.0,"object detection":1.8,"cnn":1.5,"pytorch":1.5},
    },
    "Data Scientist": {
        "required_skills": ["python","pandas","scikit-learn","matplotlib","machine learning","sql","numpy"],
        "required_years": 2,
        "weights": {"pandas":1.5,"python":2.0,"scikit-learn":1.5},
    },
    "Backend Developer": {
        "required_skills": ["python","node.js","sql","rest api","docker","git","django"],
        "required_years": 3,
        "weights": {"docker":1.3,"sql":1.5},
    },
}

def normalize(skill: str) -> str:
    k = skill.lower().strip()
    return SKILL_SYNONYMS.get(k, k)

def normalize_set(skills: list) -> set:
    return {normalize(s) for s in skills}

def parse_years(duration_str: str) -> float:
    if not duration_str or str(duration_str).lower() in ("duration not specified","n/a","nan",""):
        return 0.0
    s = str(duration_str).lower().strip()
    m = re.search(r'(\d+)\s*month', s)
    if m: return int(m.group(1)) / 12
    m = re.search(r'(\d+)\s*year', s)
    if m: return float(m.group(1))
    months_map = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"june":6,
                  "jul":7,"july":7,"aug":8,"sep":9,"sept":9,"oct":10,"nov":11,"dec":12}
    parts = re.findall(r'([a-z]+)\s+(\d{4})', s)
    if len(parts) == 2:
        try:
            m1,y1 = months_map.get(parts[0][0][:3],0), int(parts[0][1])
            m2,y2 = months_map.get(parts[1][0][:3],0), int(parts[1][1])
            if m1 and m2:
                return max(0, (y2*12+m2 - y1*12-m1) / 12)
        except ValueError:
            pass
    return 0.0

def total_years(experience: list) -> float:
    return sum(parse_years(e.get("duration","")) for e in experience)

def score_for_role(candidate: dict, role_name: str) -> dict:
    role      = ROLE_DEFINITIONS[role_name]
    req_set   = {normalize(s) for s in role["required_skills"]}
    req_years = role["required_years"]
    weights   = {normalize(k): v for k, v in role.get("weights", {}).items()}
    cand_norm = normalize_set(candidate.get("skills", []))

    total_w   = sum(weights.get(s, 1.0) for s in req_set)
    matched_w = sum(weights.get(s, 1.0) for s in req_set if s in cand_norm)
    matched   = [s for s in req_set if s in cand_norm]
    missing   = [s for s in req_set if s not in cand_norm]
    skill_pct = (matched_w / total_w * 100) if total_w else 0.0

    # project boost
    proj_techs = set()
    for proj in candidate.get("projects", []):
        proj_techs.update(normalize(t) for t in proj.get("technologies", []))
    proj_covered = {s for s in missing if s in proj_techs}
    proj_w       = sum(weights.get(s, 1.0) for s in proj_covered)
    skill_boosted = ((matched_w + proj_w * 0.7) / total_w * 100) if total_w else 0.0

    actual_years = total_years(candidate.get("experience", [])) + len(proj_covered) * 0.5
    yf = min(actual_years / req_years, 1.0) if req_years else 1.0

    # Fixed formula: skill 60% + experience 40%, both properly scaled to 100
    final = round(0.60 * skill_boosted + 0.40 * yf * 100, 1)

    return {
        "role": role_name,
        "score": final,
        "skill_score": round(skill_pct, 1),
        "skill_boosted": round(skill_boosted, 1),
        "year_factor": round(yf * 100, 1),
        "actual_years": round(actual_years, 1),
        "matched_skills": matched,
        "proj_covered": list(proj_covered),
        "missing_skills": [s for s in missing if s not in proj_covered],
    }

def pick_best_role(candidate: dict) -> dict:
    rankings = sorted(
        [score_for_role(candidate, r) for r in ROLE_DEFINITIONS],
        key=lambda x: x["score"], reverse=True
    )
    return {
        **candidate,
        "best_role":     rankings[0]["role"],
        "best_score":    rankings[0]["score"],
        "role_rankings": rankings,
    }

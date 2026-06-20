from .config import TECH_ROLES
import re

# Max years that gives full experience bonus (beyond this = same bonus)
MAX_EXPERIENCE_YEARS = 3

# How much of the final score comes from skills vs experience
# 80% skill match + 20% experience bonus
SKILL_WEIGHT = 0.80
EXPERIENCE_WEIGHT = 0.20


def _parse_years(years_of_experience: str) -> float:
    """
    Robustly parse the LLM's years-of-experience string into a float (years).

    Handles all formats the LLM might return:
        "4 months"        → 0.333
        "26 months"       → 2.166
        "2 years"         → 2.0
        "2 years 3 months"→ 2.25
        "0 months"        → 0.0
        ""  / None        → 0.0
    """
    if not years_of_experience:
        return 0.0

    text = years_of_experience.lower()
    numbers = re.findall(r'\d+', text)

    if not numbers:
        return 0.0

    # If "year" appears, first number = years; if "month" also appears, second = months
    if 'year' in text:
        years = int(numbers[0])
        months = int(numbers[1]) if len(numbers) > 1 and 'month' in text else 0
        return years + months / 12

    # Only months mentioned (most common for students)
    if 'month' in text:
        return int(numbers[0]) / 12

    # Bare number with no unit — assume months (LLM usually says "N months")
    return int(numbers[0]) / 12


def calculate_role_scores(cv_data: dict) -> dict:
    """
    Score a candidate against all TECH_ROLES.

    Formula (replaces the old multiplicative approach):
    ────────────────────────────────────────────────────
        skill_score  = (matched / total_required) × 100
        exp_bonus    = min(years / MAX_EXPERIENCE_YEARS, 1.0) × 100
        final_score  = skill_score × SKILL_WEIGHT
                     + exp_bonus   × EXPERIENCE_WEIGHT

    Why additive instead of multiplicative?
    • Old formula: score × (years / max_years)
      → 0 years  = 0%  for EVERYONE, regardless of skills  ← the bug
    • New formula: skills contribute 80%, experience adds up to 20%
      → 0 years student with perfect skills → 80%   ✅
      → 3+ years expert with perfect skills → 100%  ✅
    """
    if "error" in cv_data:
        return cv_data

    extracted_skills = cv_data.get("all_skills", [])
    years_raw = cv_data.get("years of experience", "0 months")
    years = _parse_years(years_raw)

    print(f"  parsed experience: {years:.2f} years  (raw: '{years_raw}')")

    # Experience bonus: 0 → 0%, MAX_EXPERIENCE_YEARS+ → 100%
    exp_ratio = min(years / MAX_EXPERIENCE_YEARS, 1.0)

    user_skills_lower = {s.lower() for s in extracted_skills}

    rankings = []

    for role, required_skills in TECH_ROLES.items():
        matched_skills = []
        missing_skills = []

        for req in required_skills:
            if req.lower() in user_skills_lower:
                matched_skills.append(req)
            else:
                missing_skills.append(req)

        total_reqs = len(required_skills)
        skill_pct = (len(matched_skills) / total_reqs * 100) if total_reqs > 0 else 0

        final_score = (skill_pct * SKILL_WEIGHT) + (exp_ratio * 100 * EXPERIENCE_WEIGHT)

        rankings.append({
            "role":           role,
            "score":          round(final_score, 1),
            "skill_score":    round(skill_pct, 1),
            "exp_bonus":      round(exp_ratio * 100 * EXPERIENCE_WEIGHT, 1),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
        })

    rankings.sort(key=lambda x: x["score"], reverse=True)

    cv_data["best_role"]     = rankings[0]["role"]
    cv_data["best_score"]    = rankings[0]["score"]
    cv_data["role_rankings"] = rankings

    return cv_data
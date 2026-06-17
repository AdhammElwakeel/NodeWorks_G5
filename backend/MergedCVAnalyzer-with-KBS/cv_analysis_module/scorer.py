from .config import TECH_ROLES
import re

MIN_ROLE_CONFIDENCE = 35.0
MIN_MATCHED_ROLE_SKILLS = 2


def calculate_role_scores(cv_data: dict) -> dict:
    """
    Takes the AI extracted data and calculates matches for specific job roles.
    """
    if "error" in cv_data:
        return cv_data

    # 1. Get skills (Gemini has already normalized them now!)
    extracted_skills = cv_data.get("all_skills", [])
    # Convert to lowercase set for fast matching
    user_skills_lower = {s.lower() for s in extracted_skills}
    
    rankings = []
    
    for role, required_skills in TECH_ROLES.items():
        match_count = 0
        missing = []
        matched_skills = []
        
        for req in required_skills:
            # Simple direct check because Gemini did the hard work
            if req.lower() in user_skills_lower:
                match_count += 1
                matched_skills.append(req)
            else:
                missing.append(req)
        
        # Calculate Percentage Score
        total_reqs = len(required_skills)
        score = match_count / total_reqs if total_reqs > 0 else 0
        rankings.append({
            "role": role,
            "score": round(score * 100, 1), # Percentage
            "matched_skills": matched_skills,
            "missing_skills": missing
            })
    
    # Sort by highest score
    rankings.sort(key=lambda x: x['score'], reverse=True)

    # Add rankings to the original data
    best_ranking = rankings[0] if rankings else None
    has_confident_role = (
        best_ranking is not None
        and best_ranking["score"] >= MIN_ROLE_CONFIDENCE
        and len(best_ranking.get("matched_skills", [])) >= MIN_MATCHED_ROLE_SKILLS
    )

    cv_data["best_role"] = best_ranking['role'] if has_confident_role else None
    cv_data["best_score"] = best_ranking['score'] if best_ranking else 0
    cv_data["role_confidence_threshold"] = MIN_ROLE_CONFIDENCE
    cv_data["role_confidence_status"] = "confident" if has_confident_role else "needs_user_input"
    cv_data["role_rankings"] = rankings
    
    return cv_data

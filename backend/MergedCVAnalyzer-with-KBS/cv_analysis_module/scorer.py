from .config import TECH_ROLES
import re

REQUIRED_YEARS_OF_EPERIENCE=5
def calculate_role_scores(cv_data: dict) -> dict:
    """
    Takes the AI extracted data and calculates matches for specific job roles.
    """
    if "error" in cv_data:
        return cv_data

    # 1. Get skills (Gemini has already normalized them now!)
    extracted_skills = cv_data.get("all_skills", [])
    years_of_experience = cv_data.get("years of experience") or ""
    matches = re.findall(r'\d+', str(years_of_experience))
    raw_months = int(matches[0]) if matches else 0
    # If the string contains "year", treat the number as years → convert to months
    years = (raw_months * 12 if re.search(r'year', str(years_of_experience), re.I) else raw_months) / 12
    years = max(years, 0)  # Safety clamp
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
        # Apply experience multiplier — skip if years is unknown (defaults to neutral 1.0)
        if years > 0:
            score *= min(REQUIRED_YEARS_OF_EPERIENCE, years) / REQUIRED_YEARS_OF_EPERIENCE
        # else: unknown experience → don't penalize, leave score as-is
        rankings.append({
            "role": role,
            "score": round(score * 100, 1), # Percentage
            "matched_skills": matched_skills,
            "missing_skills": missing
            })
    
    # Sort by highest score
    rankings.sort(key=lambda x: x['score'], reverse=True)
    
    # Add rankings to the original data
    cv_data["best_role"] = rankings[0]['role']
    cv_data["best_score"] = rankings[0]['score']
    cv_data["role_rankings"] = rankings
    
    return cv_data
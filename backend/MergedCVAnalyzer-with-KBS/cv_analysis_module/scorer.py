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
    years_of_experience = str(cv_data.get("years of experience") or "0 months")
    year_numbers = re.findall(r'\d+', years_of_experience)
    years = int(year_numbers[0]) / 12 if year_numbers else 0
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
        score *= min(REQUIRED_YEARS_OF_EPERIENCE,years)/REQUIRED_YEARS_OF_EPERIENCE
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

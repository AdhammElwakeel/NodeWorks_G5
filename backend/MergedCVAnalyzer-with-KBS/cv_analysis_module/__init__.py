from .pdf_utils import extract_text_from_pdf
from .scorer import calculate_role_scores
from .config import CV_ANALYSIS_PROVIDER, TECH_ROLES
import re


def _extract_with_provider(text: str) -> dict:
    if CV_ANALYSIS_PROVIDER == "gemini":
        from .gemini_client import get_gemini_extraction

        return get_gemini_extraction(text)
    if CV_ANALYSIS_PROVIDER == "grok":
        from .grok_client import get_grok_extraction

        return get_grok_extraction(text)
    if CV_ANALYSIS_PROVIDER == "opencode_go":
        from .opencode_go_client import get_opencode_go_extraction

        return get_opencode_go_extraction(text)

    return {"error": f"Unsupported CV_ANALYSIS_PROVIDER: {CV_ANALYSIS_PROVIDER}"}


def _unique(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        text = str(value).strip()
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            result.append(text)
    return result


def _local_fallback_extraction(text: str, provider_error: dict | None = None) -> dict:
    compact_text = re.sub(r"[ \t]+", " ", text or "").strip()
    if len(compact_text) < 20:
        return {"error": "No extractable CV text found in PDF. It may be scanned or image-only."}

    lines = [line.strip() for line in compact_text.splitlines() if line.strip()]
    email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", compact_text, re.I)
    phone_match = re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", compact_text)
    year_ranges = re.findall(r"(20\d{2}|19\d{2})\s*(?:-|–|to)\s*(20\d{2}|19\d{2}|present|current|now)", compact_text, re.I)
    max_months = 0
    for start, end in year_ranges:
        end_year = 2026 if end.lower() in {"present", "current", "now"} else int(end)
        max_months = max(max_months, max(0, end_year - int(start)) * 12)

    lower_text = compact_text.lower()
    skills = []
    for role_skills in TECH_ROLES.values():
        for skill in role_skills:
            if skill.lower() in lower_text:
                skills.append(skill)

    data = {
        "name": lines[0] if lines else "",
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0).strip() if phone_match else "",
        "years of experience": f"{max_months} months",
        "all_skills": _unique(skills),
        "experience": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "Publications": [],
        "_analysis_warnings": [
            "AI provider returned empty/invalid JSON; used local fallback extraction from PDF text."
        ],
        "_debug": {
            "providerError": provider_error,
            "extractedTextLength": len(compact_text),
            "extractedTextPreview": compact_text[:500],
        },
    }
    return data

def process_cv(file_input) -> dict:
    """
    Main function: Text Extraction -> configured AI provider -> Role Scoring
    """
    # 1. Extract Text
    text = extract_text_from_pdf(file_input)
    if text.startswith("Error"):
        return {"error": text}

    # 2. Extract Data with configured AI provider
    ai_data = _extract_with_provider(text)
    if "error" in ai_data:
        ai_data = _local_fallback_extraction(text, ai_data)
        if "error" in ai_data:
            return ai_data
    else:
        ai_data.setdefault("_debug", {})
        ai_data["_debug"]["extractedTextLength"] = len(text.strip())

    # 3. Calculate Scores
    final_result = calculate_role_scores(ai_data)
    
    return final_result

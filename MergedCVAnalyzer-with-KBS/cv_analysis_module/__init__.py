from .pdf_utils import extract_text_from_pdf
from .opencode_go_client import get_opencode_go_extraction as get_gemini_extraction
from .scorer import calculate_role_scores

def process_cv(file_input) -> dict:
    """
    Main function: Text Extraction -> Gemini AI -> Role Scoring
    """
    # 1. Extract Text
    text = extract_text_from_pdf(file_input)
    if text.startswith("Error"):
        return {"error": text}

    # 2. Extract Data with Gemini
    ai_data = get_gemini_extraction(text)
    if "error" in ai_data:
        return ai_data
    
    print(f"🔍 RAW LLM OUTPUT → years of experience: '{ai_data.get('years of experience')}' | skills count: {len(ai_data.get('all_skills', []))}")

    # 3. Calculate Scores
    final_result = calculate_role_scores(ai_data)
    
    return final_result
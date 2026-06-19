from .pdf_utils import extract_text_from_pdf
from .gemini_client import get_gemini_extraction
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

    # 3. Calculate Scores
    final_result = calculate_role_scores(ai_data)
    
    return final_result
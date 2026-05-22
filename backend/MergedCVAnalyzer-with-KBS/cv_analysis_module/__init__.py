from .pdf_utils import extract_text_from_pdf
from .gemini_client import get_gemini_extraction
from .glm_client import get_glm_extraction
from .openrouter_client import get_openrouter_extraction
from .scorer import calculate_role_scores
from .config import MODEL_NAME

def process_cv(file_input) -> dict:
    """
    Main function: Text Extraction -> AI Extraction -> Role Scoring
    """
    # 1. Extract Text
    text = extract_text_from_pdf(file_input)
    if text.startswith("Error"):
        return {"error": text}

    if MODEL_NAME == "missing-api-key":
        return {
            "error": (
                "Missing AI provider API key. Set one of OPENROUTER_API_KEY, "
                "GEMINI_API_KEY, or ZHIPUAI_API_KEY in the root .env file, "
                "then restart the CV API."
            )
        }

    # 2. Extract Data with AI
    if "/" in MODEL_NAME:  # OpenRouter uses provider/model format
        ai_data = get_openrouter_extraction(text)
    elif MODEL_NAME.startswith("glm"):
        ai_data = get_glm_extraction(text)
    else:
        ai_data = get_gemini_extraction(text)

    if "error" in ai_data:
        return ai_data

    # 3. Calculate Scores
    final_result = calculate_role_scores(ai_data)
    
    return final_result

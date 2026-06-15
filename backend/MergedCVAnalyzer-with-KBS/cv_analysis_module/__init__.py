from .pdf_utils import extract_text_from_pdf
from .gemini_client import get_gemini_extraction
from .glm_client import get_glm_extraction
from .opencode_go_client import get_opencode_go_extraction
from .openrouter_client import get_openrouter_extraction
from .scorer import calculate_role_scores
from .config import MODEL_NAME, PROVIDER_NAME

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
                "Missing AI provider API key. Set one of OPENCODE_GO_API_KEY, "
                "OPENROUTER_API_KEY, GEMINI_API_KEY, ZHIPUAI_API_KEY, or GLM_API_KEY "
                "in the root .env file, then restart the backend."
            )
        }

    if MODEL_NAME == "missing-model":
        return {"error": "Missing CV_ANALYSIS_MODEL in .env file"}

    # 2. Extract Data with AI
    if PROVIDER_NAME == "opencode_go":
        ai_data = get_opencode_go_extraction(text)
    elif PROVIDER_NAME == "openrouter":
        ai_data = get_openrouter_extraction(text)
    elif PROVIDER_NAME == "glm":
        ai_data = get_glm_extraction(text)
    else:
        ai_data = get_gemini_extraction(text)

    if "error" in ai_data:
        return ai_data

    # 3. Calculate Scores
    final_result = calculate_role_scores(ai_data)
    
    return final_result

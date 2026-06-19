import google.generativeai as genai
import json
from .config import API_KEY, MODEL_NAME, CV_PARSER_PROMPT

def get_gemini_extraction(cv_text: str) -> dict:
    """
    Sends CV text to Google Gemini and returns a Python Dictionary.
    """
    if not API_KEY:
        return {"error": "Missing GEMINI_API_KEY in .env file"}

    try:
        genai.configure(api_key=API_KEY)
        
        generation_config = {
            "temperature": 0.4,
            "response_mime_type": "application/json",
        }

        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=generation_config,
            system_instruction=CV_PARSER_PROMPT
        )

        response = model.generate_content(cv_text)
        
        return json.loads(response.text)

    except Exception as e:
        return {"error": f"Gemini API Error: {str(e)}"}
import json
from openai import OpenAI
from .config import OPENROUTER_API_KEY, MODEL_NAME, CV_PARSER_PROMPT

def get_openrouter_extraction(cv_text: str) -> dict:
    """
    Sends CV text to OpenRouter and returns a Python Dictionary.
    """
    if not OPENROUTER_API_KEY:
        return {"error": "Missing OPENROUTER_API_KEY in .env file"}

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
        
        print(f"🚀 Sending CV to OpenRouter ({MODEL_NAME})...")
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": CV_PARSER_PROMPT},
                {"role": "user", "content": cv_text}
            ],
            response_format={"type": "json_object"},
            temperature=0.4
        )
        
        content = response.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        return {"error": f"OpenRouter API Error: {str(e)}"}

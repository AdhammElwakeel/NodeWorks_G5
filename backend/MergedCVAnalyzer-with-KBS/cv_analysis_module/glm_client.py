from zhipuai import ZhipuAI
import json
from .config import ZHIPUAI_API_KEY, MODEL_NAME, CV_PARSER_PROMPT

def get_glm_extraction(cv_text: str) -> dict:
    """
    Sends CV text to Zhipu AI GLM and returns a Python Dictionary.
    """
    if not ZHIPUAI_API_KEY:
        return {"error": "Missing ZHIPUAI_API_KEY in .env file"}

    try:
        client = ZhipuAI(api_key=ZHIPUAI_API_KEY)
        
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
        return {"error": f"GLM API Error: {str(e)}"}

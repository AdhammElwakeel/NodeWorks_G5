import os
import json
from openai import OpenAI
from .config import API_KEY, MODEL_NAME, CV_PARSER_PROMPT

def get_grok_extraction(cv_text: str) -> dict:
    """
    Sends CV text to Grok (xAI) for extraction.
    Grok has real-time knowledge capabilities built-in.
    """
    if not API_KEY:
        return {"error": "Missing XAI_API_KEY in .env file"}

    try:
        # Initialize xAI Client (It uses the OpenAI SDK structure)
        client = OpenAI(
            api_key=API_KEY,
            base_url="https://api.x.ai/v1"
        )

        # Send request
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": CV_PARSER_PROMPT},
                {"role": "user", "content": f"Analyze this resume content:\n\n{cv_text}"}
            ],
            # Grok supports JSON mode, but sometimes requires prompting. 
            # We set temperature low for consistency.
            temperature=0.1,
            # stream=False
        )

        # Extract content
        content = response.choices[0].message.content
        
        # Clean up Markdown if Grok wraps it (e.g. ```json ... ```)
        clean_content = content.replace("```json", "").replace("```", "").strip()

        return json.loads(clean_content)

    except Exception as e:
        return {"error": f"Grok API Error: {str(e)}"}
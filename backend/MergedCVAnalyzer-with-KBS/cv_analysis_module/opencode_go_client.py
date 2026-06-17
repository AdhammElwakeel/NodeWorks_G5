import json
import re

from openai import OpenAI

from .config import CV_PARSER_PROMPT, MODEL_NAME, OPENCODE_GO_API_KEY, OPENCODE_GO_BASE_URL


FALLBACK_PROMPT = """
Extract resume data from the provided text. Return a non-empty JSON object only.
If a field is unknown, use an empty string or empty list. Never return {}.
Required shape:
{
  "name": "",
  "email": "",
  "phone": "",
  "years of experience": "0 months",
  "all_skills": [],
  "experience": [{"role": "", "company": "", "years": ""}],
  "education": [{"degree": "", "institution": "", "technologies": []}],
  "projects": [{"name": "", "technologies": []}],
  "certifications": [],
  "Publications": []
}
"""


def _extract_json_object(text: str) -> dict:
    cleaned = text.replace("```json", "```").replace("```", "").strip()
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return {}
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}


def _request_extraction(client: OpenAI, cv_text: str, system_prompt: str, max_tokens: int) -> tuple[dict, str]:
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Analyze this resume content:\n\n{cv_text}"},
        ],
        max_tokens=max_tokens,
        temperature=0.1,
    )
    content = response.choices[0].message.content or "{}"
    return _extract_json_object(content), content


def get_opencode_go_extraction(cv_text: str) -> dict:
    """Extract CV data using Opencode Go's OpenAI-compatible API."""
    if not OPENCODE_GO_API_KEY:
        return {"error": "Missing OPENCODE_GO_API_KEY in .env file"}

    try:
        client = OpenAI(
            api_key=OPENCODE_GO_API_KEY,
            base_url=OPENCODE_GO_BASE_URL.rstrip("/"),
            timeout=45,
        )
        data, content = _request_extraction(
            client,
            cv_text,
            CV_PARSER_PROMPT + "\nReturn only the JSON object. Do not return markdown, prose, or an empty object.",
            4000,
        )
        if not data:
            data, content = _request_extraction(client, cv_text[:12000], FALLBACK_PROMPT, 2500)
        if not data:
            return {
                "error": "Opencode Go returned an empty or invalid JSON response",
                "provider": "opencode_go",
                "model": MODEL_NAME,
                "response_preview": content[:500],
            }
        return data
    except Exception as exc:
        return {"error": f"Opencode Go API Error: {exc}", "provider": "opencode_go", "model": MODEL_NAME}

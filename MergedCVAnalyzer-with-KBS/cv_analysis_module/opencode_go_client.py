import json

from openai import OpenAI

from .config import CV_PARSER_PROMPT, MODEL_NAME, OPENCODE_GO_API_KEY, OPENCODE_GO_BASE_URL


OPENCODE_GO_TIMEOUT_SECONDS = 120


def _base_url() -> str:
    return OPENCODE_GO_BASE_URL.rstrip("/").removesuffix("/chat/completions")


def _model_id() -> str:
    return MODEL_NAME.removeprefix("opencode-go/")


def get_opencode_go_extraction(cv_text: str) -> dict:
    """
    Sends CV text to the Opencode Go AI API and returns a Python dictionary.

    This assumes the Opencode Go API exposes an OpenAI-compatible chat completions
    endpoint at OPENCODE_GO_BASE_URL, for example https://.../v1.
    """
    if not OPENCODE_GO_API_KEY:
        return {"error": "Missing OPENCODE_GO_API_KEY in .env file"}

    if not OPENCODE_GO_BASE_URL:
        return {"error": "Missing OPENCODE_GO_BASE_URL in .env file"}

    try:
        client = OpenAI(
            base_url=_base_url(),
            api_key=OPENCODE_GO_API_KEY,
            timeout=OPENCODE_GO_TIMEOUT_SECONDS,
        )

        response = client.chat.completions.create(
            model=_model_id(),
            messages=[
                {"role": "system", "content": CV_PARSER_PROMPT},
                {"role": "user", "content": cv_text},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        return {"error": f"Opencode Go API Error: {str(e)}"}

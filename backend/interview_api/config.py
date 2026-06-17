import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
_ = load_dotenv(ROOT_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_OPENCODE_GO_API_KEY = os.getenv("OPENCODE_GO_API_KEY")
OPENCODE_GO_API_KEY = _OPENCODE_GO_API_KEY or GEMINI_API_KEY
OPENCODE_GO_BASE_URL = os.getenv("OPENCODE_GO_BASE_URL") or (
    "https://opencode.ai/zen/go/v1"
    if _OPENCODE_GO_API_KEY
    else "https://generativelanguage.googleapis.com/v1beta/openai/"
)
OPENROUTER_BASE_URL = OPENCODE_GO_BASE_URL

# ── Interview configuration ───────────────────────────────────────────────────
NUM_SKILLS = 5  # How many skills to test per interview
QUESTIONS_PER_SKILL = 1  # 1 main question + FOLLOW_UPS follow-up questions
FOLLOW_UPS_PER_SKILL = 3  # Follow-up questions after the main one
DIFFICULTY = "easy"  # easy | medium | hard

# Total questions per skill = 1 main + 3 follow-ups = 4
# Total questions = 5 × 4 = 20

VERIFICATION_THRESHOLD = 65  # Score percentage to be considered verified

INTERVIEW_MODEL = os.getenv("INTERVIEW_MODEL") or (
    "deepseek-v4-pro" if _OPENCODE_GO_API_KEY else "gemini-2.5-flash"
)

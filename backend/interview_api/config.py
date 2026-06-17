import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
_ = load_dotenv(ROOT_DIR / ".env")
_ = load_dotenv(Path(__file__).resolve().parent / ".env")
_ = load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENCODE_GO_API_KEY = os.getenv("OPENCODE_GO_API_KEY") or GEMINI_API_KEY
OPENCODE_GO_BASE_URL = (
    os.getenv("OPENCODE_GO_BASE_URL")
    or os.getenv("OPENROUTER_BASE_URL")
    or "https://generativelanguage.googleapis.com/v1beta/openai/"
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

# Using the free Gemini model via OpenAI compatibility API by default.
INTERVIEW_MODEL = os.getenv("INTERVIEW_MODEL", "gemini-2.5-flash")

import os
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ── Interview configuration ───────────────────────────────────────────────────
NUM_SKILLS = 5             # How many skills to test per interview
QUESTIONS_PER_SKILL = 1   # 1 main question + FOLLOW_UPS follow-up questions
FOLLOW_UPS_PER_SKILL = 3  # Follow-up questions after the main one
DIFFICULTY = "easy"      # easy | medium | hard

# Total questions per skill = 1 main + 3 follow-ups = 4
# Total questions = 5 × 4 = 20

VERIFICATION_THRESHOLD = 65  # Score percentage to be considered verified

# ── Model ─────────────────────────────────────────────────────────────────────
# Using the free Nemotron model via OpenRouter
INTERVIEW_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

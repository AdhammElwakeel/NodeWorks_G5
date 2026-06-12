import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ── Interview configuration ───────────────────────────────────────────────────
NUM_SKILLS = 5             # How many skills to test per interview
QUESTIONS_PER_SKILL = 1   # 1 main question + FOLLOW_UPS follow-up questions
FOLLOW_UPS_PER_SKILL = 3  # Follow-up questions after the main one
DIFFICULTY = "easy"      # easy | medium | hard

# Total questions per skill = 1 main + 3 follow-ups = 4
# Total questions = 5 × 4 = 20

VERIFICATION_THRESHOLD = 65  # Score percentage to be considered verified

# Using the free Gemini model via OpenAI compatibility API
INTERVIEW_MODEL = "gemini-2.5-flash"
OPENROUTER_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

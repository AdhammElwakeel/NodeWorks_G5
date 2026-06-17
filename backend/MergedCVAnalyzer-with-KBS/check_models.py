import os
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=ROOT_DIR / ".env")

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ Error: GEMINI_API_KEY not found in .env")
else:
    genai.configure(api_key=api_key)
    print("🔍 Checking available models for your API key...\n")
    try:
        for m in genai.list_models():
            if "generateContent" in m.supported_generation_methods:
                print(f"✅ Available: {m.name}")
    except Exception as e:
        print(f"❌ Error listing models: {e}")

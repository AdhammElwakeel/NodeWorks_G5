# Interview API

A FastAPI-based AI technical interview microservice.

## Features
- **5 skills** tested per interview (from the candidate's CV)  
- **1 main question** + **3 follow-up questions** per skill = **20 total questions**  
- **Medium difficulty** by default (configurable in `config.py`)  
- Powered by **OpenRouter** (Nvidia Nemotron 120B free tier)  
- Anti-cheat detection via answer grading

## Running

```bash
cd graduation_project/backend/interview_api
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

The frontend proxies to this server via `/api/interview/*`.

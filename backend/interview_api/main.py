from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import interview
import os

app = FastAPI(
    title="AI Interviewer API",
    description="AI-powered technical interview system using OpenRouter",
    version="2.0.0"
)

_allow_origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview.router)

@app.get("/")
async def root():
    return {"message": "AI Interviewer API v2", "docs": "/docs"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

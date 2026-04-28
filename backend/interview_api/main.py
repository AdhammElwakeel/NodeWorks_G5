from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import interview

app = FastAPI(
    title="AI Interviewer API",
    description="AI-powered technical interview system using OpenRouter",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

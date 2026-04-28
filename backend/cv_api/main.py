"""
CV Analysis API Server
Wraps the MergedCVAnalyzer-with-KBS module and exposes it as a REST API.
Endpoint: POST /api/analyze-cv
"""

import sys
import os
from pathlib import Path

# Make the sibling cv_analysis_module importable
sys.path.insert(0, str(Path(__file__).parent.parent / "MergedCVAnalyzer-with-KBS"))

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load env vars from the root .env (two levels up from backend/cv_api/)
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

from cv_analysis_module import process_cv  # noqa: E402  (import after sys.path patch)

app = FastAPI(
    title="CV Analysis API",
    description="Analyzes a CV PDF with Gemini or GLM AI and returns structured profile data.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the Next.js dev server (port 3000) and any localhost origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "cv-analysis"}


# ---------------------------------------------------------------------------
# CV Analysis Endpoint
# POST /api/analyze-cv
# Body: multipart/form-data  { file: <PDF binary> }
# Returns: the full JSON produced by process_cv()
# ---------------------------------------------------------------------------
@app.post("/api/analyze-cv")
async def analyze_cv(file: UploadFile = File(...)):
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )

    # Read bytes
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Run the CV analysis pipeline
    result = process_cv(pdf_bytes)

    # The module returns {"error": "..."} on failure
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return JSONResponse(content=result)

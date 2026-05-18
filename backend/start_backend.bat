@echo off
echo ===================================================
echo Starting Graduation Project Backend Services...
echo ===================================================

echo.
echo [1/2] Launching CV API on Port 8000...
start "CV API (Port 8000)" cmd /k "cd cv_api && title CV API (Port 8000) && python -m uvicorn main:app --reload --port 8000"

echo [2/2] Launching Interview API on Port 8001...
start "Interview API (Port 8001)" cmd /k "cd interview_api && title Interview API (Port 8001) && python -m uvicorn main:app --reload --port 8001"

echo.
echo All backend services launched!
echo - CV API Docs: http://localhost:8000/docs
echo - Interview API Docs: http://localhost:8001/docs
echo.
echo NOTE: To stop the servers, just close the newly opened terminal windows.
pause

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 && \
    pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend /app/backend
COPY MergedCVAnalyzer-with-KBS /app/MergedCVAnalyzer-with-KBS
COPY Recommender-System /app/Recommender-System

WORKDIR /app/backend/ai_api

EXPOSE 8010

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]

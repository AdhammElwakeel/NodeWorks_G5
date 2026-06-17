FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/api ./backend/api
COPY backend/MergedCVAnalyzer-with-KBS ./backend/MergedCVAnalyzer-with-KBS

EXPOSE 8010

CMD ["uvicorn", "main:app", "--app-dir", "backend/api", "--host", "0.0.0.0", "--port", "8010"]

FROM python:3.14-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/logging \
    DDGS_LOG_FILE=/logs/ddgs.log

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY logging/ ./logging/

EXPOSE 8000
CMD ["ddgs", "api", "--host", "0.0.0.0", "--port", "8000"]

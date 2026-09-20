FROM python:3.12-slim AS base

# Install system dependencies (including FFmpeg for video transcoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Production image ─────────────────────────────────────────
FROM deps AS production
COPY . .

# Non-root user for security
RUN addgroup --system swiped && adduser --system --ingroup swiped swiped
USER swiped

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

##########
# Stage 1: builder (installs dependencies into a wheel cache layer)
##########
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1 \
  PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=1 \
  PIP_DEFAULT_TIMEOUT=100

WORKDIR /app

# System build deps (removed later)
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

##########
# Stage 2: runtime
##########
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1

WORKDIR /app

# Minimal runtime packages (curl for healthcheck only)
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user early to own files
RUN useradd -m -u 1000 appuser

COPY --from=builder /wheels /wheels
COPY --from=builder /usr/local/bin /usr/local/bin
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy only necessary application files (adjust patterns if large)
# Copy application source (including alembic.ini)
COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health/ready || exit 1

# (Optional) Allow overriding the module via APP_MODULE
ENV APP_MODULE=main:app \
  HOST=0.0.0.0 \
  PORT=8000 \
  UVICORN_WORKERS=1

CMD ["bash", "-c", "uvicorn ${APP_MODULE} --host ${HOST} --port ${PORT} --workers ${UVICORN_WORKERS}"]

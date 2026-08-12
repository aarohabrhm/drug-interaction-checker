# syntax=docker/dockerfile:1
#
# SafeMeds backend image.
# Build context is `backend/`; see .dockerignore for what is excluded (.env,
# local databases, virtualenvs, the CSV dataset).

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# --------------------------------------------------------------------------- #
# Builder -- compile wheels so the runtime image needs no toolchain.
# --------------------------------------------------------------------------- #
FROM base AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Copied alone so the layer caches until requirements.txt actually changes.
COPY requirements.txt .
# setuptools is upgraded too: the version bundled with the stdlib venv module
# carries its own advisories.
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip setuptools \
    && /opt/venv/bin/pip install -r requirements.txt

# --------------------------------------------------------------------------- #
# Runtime
# --------------------------------------------------------------------------- #
FROM base AS runtime

# libpq5 is the psycopg2 runtime dependency; curl backs the healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 safemeds

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY --chown=safemeds:safemeds . .

# Collect static assets at build time. `settings.py` treats collectstatic as a
# lenient command, so this works without production secrets present.
RUN DJANGO_DEBUG=false python manage.py collectstatic --noinput \
    && chown -R safemeds:safemeds /app/staticfiles

# Never run as root.
USER safemeds

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

# Exec form so gunicorn is PID 1 and receives SIGTERM directly -- that is what
# makes `docker stop` drain in-flight requests instead of killing them.
CMD ["gunicorn", "backend.wsgi:application", "-c", "gunicorn.conf.py"]

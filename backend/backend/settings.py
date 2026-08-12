"""
Django settings for the SafeMeds backend.

Configuration comes from the environment, not from this file. Nothing secret is
hardcoded here. Required values have no fallback -- `_require()` raises at import
time so a misconfigured deploy dies on startup with a clear message instead of
failing in a confusing way on the first request.

Local development: copy `.env.example` to `.env` and fill it in.
"""

import os
import sys
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load `backend/.env` if present. Real environment variables always win, so a
# platform-injected value is never clobbered by a stale local file.
load_dotenv(BASE_DIR / ".env", override=False)


# --------------------------------------------------------------------------- #
# Environment helpers
# --------------------------------------------------------------------------- #

# Management commands that must run without a full production config (e.g. in a
# Docker build layer, or `collectstatic` before secrets are attached).
_LENIENT_COMMANDS = {"collectstatic", "makemigrations", "help", "version"}
_IS_LENIENT = len(sys.argv) > 1 and sys.argv[1] in _LENIENT_COMMANDS


def _require(name, *, lenient_default=None):
    """Return env var `name`, or abort startup if it is missing/blank."""
    value = os.environ.get(name, "").strip()
    if value:
        return value
    if _IS_LENIENT and lenient_default is not None:
        return lenient_default
    raise ImproperlyConfigured(
        f"Required environment variable {name} is missing or empty. "
        f"See backend/.env.example for what it should contain."
    )


def _bool(name, default):
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name, default):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        raise ImproperlyConfigured(f"{name} must be an integer, got {raw!r}.")


def _csv(name, default=()):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #

DEBUG = _bool("DJANGO_DEBUG", False)

SECRET_KEY = _require("DJANGO_SECRET_KEY", lenient_default="build-time-placeholder")

if not DEBUG and SECRET_KEY.startswith("django-insecure-"):
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY is still a Django-generated 'django-insecure-' key. "
        "Generate a fresh one before running with DEBUG=false."
    )

ALLOWED_HOSTS = _csv("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1"] if DEBUG else [])

if not DEBUG and not ALLOWED_HOSTS and not _IS_LENIENT:
    raise ImproperlyConfigured(
        "DJANGO_ALLOWED_HOSTS must be set when DJANGO_DEBUG=false."
    )

CSRF_TRUSTED_ORIGINS = _csv("DJANGO_CSRF_TRUSTED_ORIGINS")


# --------------------------------------------------------------------------- #
# Applications
# --------------------------------------------------------------------------- #

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "interactions",
    "authentication",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"


# --------------------------------------------------------------------------- #
# REST framework
# --------------------------------------------------------------------------- #

REST_FRAMEWORK = {
    # Expiring wrapper around DRF's TokenAuthentication -- plain DRF tokens
    # are valid forever.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "authentication.authentication.ExpiringTokenAuthentication",
    ],
    # Deny by default. Endpoints opt in to public access explicitly.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    # Uniform, non-leaky error bodies.
    "EXCEPTION_HANDLER": "backend.exceptions.safemeds_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": "1000/hour",
        "anon": "60/hour",
        "login": "10/min",
        "signup": "5/hour",
        "interaction_check": "60/hour",
    },
    # No browsable API in production -- it advertises the whole surface.
    "DEFAULT_RENDERER_CLASSES": (
        [
            "rest_framework.renderers.JSONRenderer",
            "rest_framework.renderers.BrowsableAPIRenderer",
        ]
        if DEBUG
        else ["rest_framework.renderers.JSONRenderer"]
    ),
}

# Hours an auth token stays valid; consumed by ExpiringTokenAuthentication.
AUTH_TOKEN_TTL_HOURS = _int("AUTH_TOKEN_TTL_HOURS", 12)


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #

# `conn_max_age` bounds connection reuse instead of opening a fresh connection
# per request; `conn_health_checks` discards connections killed server-side.
DATABASES = {
    "default": dj_database_url.parse(
        _require("DATABASE_URL", lenient_default="sqlite:///build-placeholder.sqlite3"),
        conn_max_age=_int("DATABASE_CONN_MAX_AGE", 60),
        conn_health_checks=True,
    )
}

if DATABASES["default"].get("ENGINE", "").endswith("postgresql"):
    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"].update(
        {
            "connect_timeout": _int("DATABASE_CONNECT_TIMEOUT", 5),
        }
    )


# --------------------------------------------------------------------------- #
# Authentication / passwords
# --------------------------------------------------------------------------- #

# Django's default hasher is PBKDF2-SHA256 with a per-install iteration count;
# listed explicitly so the choice is visible rather than implied.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --------------------------------------------------------------------------- #
# Internationalization
# --------------------------------------------------------------------------- #

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# --------------------------------------------------------------------------- #
# Static files
# --------------------------------------------------------------------------- #

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #

# Explicit allowlist only. A wildcard is rejected outright: this API returns
# patient data and accepts credentialed requests.
CORS_ALLOWED_ORIGINS = _csv(
    "CORS_ALLOWED_ORIGINS",
    ["http://localhost:5173", "http://127.0.0.1:5173"] if DEBUG else [],
)

if "*" in CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS must not contain '*'. This API serves patient "
        "data over credentialed requests; list exact origins instead."
    )

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True


# --------------------------------------------------------------------------- #
# Cookies / HTTPS
# --------------------------------------------------------------------------- #

# Secure cookies are on whenever we are not in local debug. `SameSite=Lax`
# keeps the session cookie off cross-site requests while allowing top-level
# navigation back into the app.
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = False  # readable by JS so the SPA can echo the token
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

if DEBUG:
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
else:
    SECURE_SSL_REDIRECT = _bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = _int("DJANGO_SECURE_HSTS_SECONDS", 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # Trust the reverse proxy's forwarded scheme (Heroku/Render/Fly/nginx).
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# --------------------------------------------------------------------------- #
# Gemini interaction lookup
# --------------------------------------------------------------------------- #

# Optional on purpose: without a key the service answers from the local
# interaction database and logs a warning, rather than refusing to boot.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash").strip()
GEMINI_TIMEOUT_SECONDS = _int("GEMINI_TIMEOUT_SECONDS", 10)

# Request fan-out caps: N new meds x M current meds pairs, each potentially an
# external call. Without a ceiling one request can hang the worker.
MAX_NEW_MEDICATIONS = _int("MAX_NEW_MEDICATIONS", 25)
MAX_CURRENT_MEDICATIONS = _int("MAX_CURRENT_MEDICATIONS", 50)


# --------------------------------------------------------------------------- #
# Caching
# --------------------------------------------------------------------------- #

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "safemeds-default",
        "TIMEOUT": 300,
    }
}


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #

LOG_LEVEL = os.environ.get("DJANGO_LOG_LEVEL", "INFO").strip().upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
        # Unhandled view exceptions -- always want these, at ERROR.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "interactions": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "authentication": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}

"""External drug-interaction lookup (Google Gemini).

Extracted from `views.py`, where the API key lived in a module-level constant
and the outbound request had no timeout -- a slow upstream would pin a Gunicorn
worker indefinitely.
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_ENDPOINT = "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent"

_PROMPT = (
    "What are the clinically significant interactions between {drug_1} and "
    "{drug_2}? Answer in one line. If there are none, reply exactly: "
    "There are no known significant interactions."
)

# Logged once rather than per pair, so a missing key does not flood the logs.
_warned_missing_key = False


def lookup_interaction_externally(drug_1, drug_2):
    """Ask Gemini about a drug pair.

    Returns the answer text, or `None` if the lookup could not be performed
    (no API key, network error, unexpected payload). `None` means "unknown",
    never "no interaction" -- callers must not cache it as a negative result.
    """
    global _warned_missing_key

    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        if not _warned_missing_key:
            logger.warning(
                "GEMINI_API_KEY is not set -- interaction checks will only use "
                "the local dataset. External lookups are disabled."
            )
            _warned_missing_key = True
        return None

    url = _ENDPOINT.format(model=settings.GEMINI_MODEL)
    payload = {
        "contents": [
            {"parts": [{"text": _PROMPT.format(drug_1=drug_1, drug_2=drug_2)}]}
        ]
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            # The key goes in the query string as the API requires, but via
            # params so it is never formatted into a logged URL string.
            params={"key": api_key},
            timeout=settings.GEMINI_TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        logger.warning(
            "Gemini lookup timed out after %ss for pair (%s, %s)",
            settings.GEMINI_TIMEOUT_SECONDS,
            drug_1,
            drug_2,
        )
        return None
    except requests.RequestException:
        # No API key or response body in the log line.
        logger.exception("Gemini lookup failed for pair (%s, %s)", drug_1, drug_2)
        return None

    if response.status_code != 200:
        logger.warning(
            "Gemini lookup returned HTTP %s for pair (%s, %s)",
            response.status_code,
            drug_1,
            drug_2,
        )
        return None

    try:
        candidates = response.json().get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
        text = parts[0].get("text", "").strip() if parts else ""
    except (ValueError, AttributeError, IndexError, TypeError):
        logger.exception("Unexpected Gemini payload for pair (%s, %s)", drug_1, drug_2)
        return None

    return text or None

"""External drug-interaction lookups.

Two sources sit behind the curated dataset, tried in descending order of
trustworthiness:

1. **openFDA drug labels** -- the FDA's own prescribing information. Free, no
   auth, real provenance.
2. **Google Gemini** -- an LLM. Opt-in, off unless a key is configured, and
   always tagged `ai_unverified` so the UI can mark it as unverified. An LLM
   answering a drug-safety question is a genuine risk; it is a last resort, not
   a peer of the curated data.

Every lookup has a timeout. The original code called Gemini with no timeout at
all, so a slow upstream would pin a worker indefinitely.
"""

import logging
from dataclasses import dataclass, field

import requests
from django.conf import settings

from .models import InteractionSource, Severity

logger = logging.getLogger(__name__)

NO_INTERACTION_SENTINEL = "There are no known significant interactions"

_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent"
)
_OPENFDA_ENDPOINT = "https://api.fda.gov/drug/label.json"

_GEMINI_PROMPT = (
    "What are the clinically significant interactions between {drug_1} and "
    "{drug_2}? Answer in one line. If there are none, reply exactly: "
    "There are no known significant interactions."
)

# Logged once each rather than per pair, so a missing key or a dead endpoint
# does not flood the logs during a large check.
_warned = set()


def _warn_once(key, message, *args):
    if key not in _warned:
        _warned.add(key)
        logger.warning(message, *args)


@dataclass
class InteractionFinding:
    """One resolved interaction, with where it came from."""

    description: str
    severity: str = Severity.UNKNOWN
    source: str = InteractionSource.DATASET
    management: str = ""
    # False means "checked, nothing significant found" -- distinct from a
    # failed lookup, which yields no finding at all.
    has_interaction: bool = True

    @classmethod
    def none_found(cls, source):
        return cls(
            description="", severity=Severity.UNKNOWN, source=source, has_interaction=False
        )


def _timeout(name, default):
    return getattr(settings, name, default)


# --------------------------------------------------------------------------- #
# openFDA
# --------------------------------------------------------------------------- #


def _openfda_enabled():
    return getattr(settings, "OPENFDA_ENABLED", True)


def lookup_openfda(drug_1, drug_2):
    """Search openFDA labels for a mention of `drug_2` in `drug_1`'s label.

    openFDA has no interaction endpoint; the interactions live as free text in
    the label's `drug_interactions` section. This looks up one drug's label and
    checks whether the other is named in it.

    Returns an `InteractionFinding`, or `None` if the lookup failed.
    """
    if not _openfda_enabled():
        return None

    try:
        response = requests.get(
            _OPENFDA_ENDPOINT,
            params={
                "search": f'openfda.generic_name:"{drug_1}" AND drug_interactions:"{drug_2}"',
                "limit": 1,
            },
            timeout=_timeout("OPENFDA_TIMEOUT_SECONDS", 8),
        )
    except requests.Timeout:
        _warn_once("openfda_timeout", "openFDA lookup timed out; skipping label checks.")
        return None
    except requests.RequestException:
        _warn_once("openfda_error", "openFDA lookup failed; skipping label checks.")
        return None

    # openFDA returns 404 for "no documents matched", which is a definite
    # negative rather than an error.
    if response.status_code == 404:
        return InteractionFinding.none_found(InteractionSource.OPENFDA)
    if response.status_code != 200:
        _warn_once(
            "openfda_status", "openFDA returned HTTP %s; skipping.", response.status_code
        )
        return None

    try:
        results = response.json().get("results") or []
        if not results:
            return InteractionFinding.none_found(InteractionSource.OPENFDA)
        sections = results[0].get("drug_interactions") or []
        text = " ".join(sections).strip()
    except (ValueError, AttributeError, TypeError):
        logger.warning("Unexpected openFDA payload for (%s, %s)", drug_1, drug_2, exc_info=True)
        return None

    if not text:
        return InteractionFinding.none_found(InteractionSource.OPENFDA)

    # Label text is long; keep the portion that names the other drug.
    excerpt = _excerpt_mentioning(text, drug_2)
    return InteractionFinding(
        description=excerpt,
        # Labels describe interactions but rarely grade them on a scale we can
        # map reliably, so severity stays UNKNOWN rather than being invented.
        severity=Severity.UNKNOWN,
        source=InteractionSource.OPENFDA,
    )


def _excerpt_mentioning(text, needle, window=400):
    """Return the sentence-ish span around the first mention of `needle`."""
    lowered = text.lower()
    index = lowered.find(needle.lower())
    if index == -1:
        return text[:window].strip()
    start = max(0, index - window // 2)
    end = min(len(text), index + window // 2)
    excerpt = text[start:end].strip()
    if start > 0:
        excerpt = "…" + excerpt
    if end < len(text):
        excerpt = excerpt + "…"
    return excerpt


# --------------------------------------------------------------------------- #
# Gemini (opt-in, always labelled unverified)
# --------------------------------------------------------------------------- #


def lookup_gemini(drug_1, drug_2):
    """Ask Gemini about a drug pair.

    Returns an `InteractionFinding` tagged `ai_unverified`, or `None` if the
    lookup could not be performed. `None` means "unknown", never "no
    interaction" -- callers must not cache it as a negative.
    """
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        _warn_once(
            "gemini_key",
            "GEMINI_API_KEY is not set -- interaction checks will use the local "
            "dataset and openFDA only. AI fallback is disabled.",
        )
        return None

    try:
        response = requests.post(
            _GEMINI_ENDPOINT.format(model=settings.GEMINI_MODEL),
            json={
                "contents": [
                    {"parts": [{"text": _GEMINI_PROMPT.format(drug_1=drug_1, drug_2=drug_2)}]}
                ]
            },
            headers={"Content-Type": "application/json"},
            # Key passed via params so it is never formatted into a logged URL.
            params={"key": api_key},
            timeout=settings.GEMINI_TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        logger.warning(
            "Gemini lookup timed out after %ss for (%s, %s)",
            settings.GEMINI_TIMEOUT_SECONDS,
            drug_1,
            drug_2,
        )
        return None
    except requests.RequestException:
        logger.exception("Gemini lookup failed for (%s, %s)", drug_1, drug_2)
        return None

    if response.status_code != 200:
        logger.warning(
            "Gemini returned HTTP %s for (%s, %s)", response.status_code, drug_1, drug_2
        )
        return None

    try:
        candidates = response.json().get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
        text = parts[0].get("text", "").strip() if parts else ""
    except (ValueError, AttributeError, IndexError, TypeError):
        logger.exception("Unexpected Gemini payload for (%s, %s)", drug_1, drug_2)
        return None

    if not text:
        return None

    if NO_INTERACTION_SENTINEL.lower() in text.lower():
        return InteractionFinding.none_found(InteractionSource.AI_UNVERIFIED)

    return InteractionFinding(
        description=text,
        # Deliberately not graded: asking an LLM to assign a clinical severity
        # would dress a guess up as a triage decision.
        severity=Severity.UNKNOWN,
        source=InteractionSource.AI_UNVERIFIED,
    )


# --------------------------------------------------------------------------- #
# Layered entry point
# --------------------------------------------------------------------------- #


def lookup_interaction_externally(drug_1, drug_2):
    """Resolve a pair the curated dataset could not answer.

    Tries openFDA first, then the LLM. Returns an `InteractionFinding`
    (which may be a definite "nothing found"), or `None` if no source could be
    reached -- in which case the caller must not record a negative.
    """
    finding = lookup_openfda(drug_1, drug_2)
    if finding is not None and finding.has_interaction:
        return finding

    ai_finding = lookup_gemini(drug_1, drug_2)
    if ai_finding is not None:
        return ai_finding

    # openFDA's definite "no match" is the best answer available if the LLM is
    # unavailable or disabled.
    return finding

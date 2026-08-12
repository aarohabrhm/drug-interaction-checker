"""Drug name normalization via the NIH RxNorm API.

Why this exists: interaction datasets are keyed on ingredient names, but doctors
type brand names. Without normalization, "Tylenol + warfarin" finds nothing
while "acetaminophen + warfarin" does -- a silent false negative, which in a
drug-safety tool is worse than an error.

Design constraints:

* **Never blocks a check.** If RxNorm is slow, down, or the machine is offline,
  resolution falls back to the name as typed. A degraded lookup is acceptable;
  a hung request is not.
* **Cached permanently.** A brand's ingredient does not change, so each distinct
  name costs at most one network call ever, including names RxNorm cannot
  resolve (cached as a negative so they are not retried forever).

RxNorm is used rather than the old RxNav interaction API, which NLM
discontinued in January 2024.
"""

import logging

import requests
from django.conf import settings
from django.db import IntegrityError

from .models import DrugNameAlias, normalize_drug_name

logger = logging.getLogger(__name__)

_RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"

_network_unavailable = False


def _timeout():
    return getattr(settings, "RXNORM_TIMEOUT_SECONDS", 5)


def _enabled():
    return getattr(settings, "RXNORM_ENABLED", True)


def _fetch_ingredient(name):
    """Ask RxNorm for the ingredient behind `name`.

    Returns `(ingredient, rxcui)`, `("", "")` when RxNorm has no match, or
    `None` when the lookup could not be performed at all. The distinction
    matters: only a definite "no match" is worth caching.
    """
    try:
        # Step 1: name -> RxCUI. `search=2` allows normalized/approximate
        # matching so minor spelling differences still resolve.
        response = requests.get(
            f"{_RXNORM_BASE}/rxcui.json",
            params={"name": name, "search": 2},
            timeout=_timeout(),
        )
        if response.status_code != 200:
            return None
        ids = (response.json().get("idGroup") or {}).get("rxnormId") or []
        if not ids:
            return "", ""
        rxcui = ids[0]

        # Step 2: RxCUI -> its ingredient(s). A brand maps to one or more
        # ingredients; the first is used for single-ingredient products, which
        # is the case this normalization is aimed at.
        related = requests.get(
            f"{_RXNORM_BASE}/rxcui/{rxcui}/related.json",
            params={"tty": "IN"},
            timeout=_timeout(),
        )
        if related.status_code != 200:
            return None

        groups = (related.json().get("relatedGroup") or {}).get("conceptGroup") or []
        for group in groups:
            for concept in group.get("conceptProperties") or []:
                ingredient = normalize_drug_name(concept.get("name"))
                if ingredient:
                    return ingredient, concept.get("rxcui", rxcui)

        # Resolved to a concept that is already an ingredient.
        return "", rxcui
    except requests.Timeout:
        logger.warning("RxNorm lookup timed out for %r", name)
        return None
    except requests.RequestException:
        logger.warning("RxNorm lookup failed for %r", name, exc_info=True)
        return None
    except (ValueError, AttributeError, TypeError):
        logger.warning("Unexpected RxNorm payload for %r", name, exc_info=True)
        return None


def _fetch_and_cache(queried):
    """Resolve one uncached name over the network and store the result.

    Assumes the caller has already checked the cache. Returns the ingredient,
    or "" when unresolved/unavailable.
    """
    global _network_unavailable

    if not _enabled() or _network_unavailable:
        return ""

    result = _fetch_ingredient(queried)
    if result is None:
        # Transient failure: do not cache, and stop hammering a dead endpoint
        # for the remainder of this process.
        _network_unavailable = True
        logger.warning(
            "RxNorm unavailable -- drug names will be matched exactly for the "
            "rest of this process. Brand names may not resolve to ingredients."
        )
        return ""

    ingredient, rxcui = result
    try:
        DrugNameAlias.objects.create(
            queried_name=queried, ingredient=ingredient, rxcui=rxcui or ""
        )
    except IntegrityError:
        # A concurrent request cached the same name first; harmless.
        pass

    return ingredient


def resolve_ingredient(name):
    """Return the ingredient name for `name`, or `name` itself if unresolvable.

    Always returns a usable name -- callers never have to handle a failure.
    """
    queried = normalize_drug_name(name)
    if not queried:
        return queried

    cached = DrugNameAlias.objects.filter(queried_name=queried).first()
    if cached is not None:
        return cached.ingredient or queried

    return _fetch_and_cache(queried) or queried


def resolve_many(names):
    """Resolve names to ingredients, preserving order **and length**.

    The returned list lines up one-to-one with `names` (an empty input yields an
    empty output in the same slot), so callers can safely slice the result back
    apart when they resolve several lists in one call.

    Every cached alias is read in a single query. Names not in the cache are
    resolved individually, but each is remembered for the rest of the batch, so
    a repeated name costs one lookup rather than one per occurrence. When
    RxNorm is disabled or unreachable this is exactly one query in total.
    """
    normalized = [normalize_drug_name(n) for n in names]
    wanted = {n for n in normalized if n}
    if not wanted:
        return ["" for _ in normalized]

    cached = dict(
        DrugNameAlias.objects.filter(queried_name__in=wanted).values_list(
            "queried_name", "ingredient"
        )
    )

    resolved = []
    for name in normalized:
        if not name:
            resolved.append("")
            continue
        if name not in cached:
            # Records "" for unresolved names too, so a name that RxNorm cannot
            # resolve is not retried for every other occurrence in this batch.
            cached[name] = _fetch_and_cache(name)
        resolved.append(cached[name] or name)
    return resolved

"""Patient and drug-interaction API.

Security note: every endpoint here now requires authentication. The previous
version marked all of them `@permission_classes([AllowAny])`, which meant
`GET /api/patients/` returned every patient's name, age, phone number, email,
medical condition and medication list to any unauthenticated caller on the
internet.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from drf_spectacular.utils import OpenApiParameter, extend_schema

from backend.schema import ERROR_RESPONSES, ErrorResponseSerializer

from .models import (
    SEVERITY_RANK,
    DrugInteraction,
    InteractionLookupCache,
    InteractionSource,
    PatientList,
    Prescription,
    SavedInteraction,
    TemporaryPrescription,
    normalize_drug_name,
)
from .normalization import resolve_many, unrecognized_names
from .serializers import (
    InteractionCheckRequestSerializer,
    InteractionCheckResponseSerializer,
    InteractionWarningSerializer,
    PatientSerializer,
    PrescriptionSerializer,
)
from .services import InteractionFinding, lookup_interaction_externally

logger = logging.getLogger(__name__)


class InteractionCheckThrottle(UserRateThrottle):
    """Interaction checks can trigger outbound API calls -- rate limit them."""

    scope = "interaction_check"


class PatientPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def _error(code, message, details=None, http_status=status.HTTP_400_BAD_REQUEST):
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return Response(body, status=http_status)


def _normalize_pair(drug_a, drug_b):
    """Order a pair deterministically so (a,b) and (b,a) share one cache row."""
    return tuple(sorted([normalize_drug_name(drug_a), normalize_drug_name(drug_b)]))


def _patients_for(user):
    """Patients owned by `user`.

    Single source of truth for patient scoping -- every patient read and write
    goes through this. Legacy rows with a NULL doctor match no one, which is the
    safe default for records whose owner is unknown.
    """
    return PatientList.objects.filter(doctor=user)


def _get_owned_patient(user, patient_id):
    """Fetch one of the user's patients, 404ing on anything else.

    A patient belonging to another doctor is reported as missing rather than
    forbidden, so the API cannot be used to enumerate patient ids.
    """
    return get_object_or_404(_patients_for(user), id=patient_id)


# --------------------------------------------------------------------------- #
# Patients
# --------------------------------------------------------------------------- #


@extend_schema(
    tags=["patients"],
    summary="List patients",
    description="Paginated, and scoped to the authenticated doctor.",
    parameters=[
        OpenApiParameter("search", str, description="Match name, phone or condition."),
        OpenApiParameter("page", int),
        OpenApiParameter("page_size", int, description="Max 100."),
    ],
    responses={200: PatientSerializer(many=True), 401: ErrorResponseSerializer},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_patients(request):
    """Paginated patient list, optionally filtered by `?search=`.

    Previously returned every patient in one unbounded, unauthenticated
    response.
    """
    queryset = _patients_for(request.user).order_by("-registered_date")

    search = (request.query_params.get("search") or "").strip()
    if search:
        # Parameterized ORM lookups -- no string interpolation into SQL.
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(phone_number__icontains=search)
            | Q(medical_condition__icontains=search)
        )

    paginator = PatientPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = PatientSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


@extend_schema(
    tags=["patients"],
    summary="Create a patient",
    description="The record is owned by the authenticated doctor; `doctor` is "
    "never read from the payload.",
    request=PatientSerializer,
    responses={201: PatientSerializer, **ERROR_RESPONSES},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_patient(request):
    """Create a patient record, owned by the requesting doctor.

    The `@csrf_exempt` decorator the original carried was both ineffective (DRF
    token auth is CSRF-exempt already) and misleading, so it is gone.
    """
    serializer = PatientSerializer(data=request.data, context={"doctor": request.user})
    if not serializer.is_valid():
        return _error(
            "validation_error",
            "The submitted data was invalid.",
            {"fields": serializer.errors},
        )
    # Ownership comes from the authenticated user, never the payload.
    patient = serializer.save(doctor=request.user)
    logger.info("Patient %s created by user %s", patient.id, request.user.username)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["patients"],
    summary="Read or update a patient",
    description="Another doctor's patient returns 404, not 403, so the endpoint "
    "cannot be used to enumerate patient ids.",
    request=PatientSerializer,
    responses={200: PatientSerializer, **ERROR_RESPONSES},
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def patient_detail(request, patient_id):
    """Read or update a single patient."""
    patient = _get_owned_patient(request.user, patient_id)

    if request.method == "GET":
        return Response(PatientSerializer(patient).data)

    serializer = PatientSerializer(
        patient, data=request.data, partial=True, context={"doctor": request.user}
    )
    if not serializer.is_valid():
        return _error(
            "validation_error",
            "The submitted data was invalid.",
            {"fields": serializer.errors},
        )
    serializer.save()
    logger.info("Patient %s updated by user %s", patient.id, request.user.username)
    return Response(serializer.data)


@extend_schema(
    tags=["patients"],
    summary="Interaction warnings previously raised for a patient",
    responses={200: InteractionWarningSerializer(many=True), **ERROR_RESPONSES},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_interaction_history(request, patient_id):
    """Warnings previously raised for this patient.

    `SavedInteraction` rows have been accumulating since the audit but no
    endpoint ever read them back; this is that endpoint.
    """
    patient = _get_owned_patient(request.user, patient_id)
    queryset = patient.saved_interactions.all().order_by("-checked_at")

    paginator = PatientPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(
        InteractionWarningSerializer(page, many=True).data
    )


# --------------------------------------------------------------------------- #
# Interaction checking
# --------------------------------------------------------------------------- #


def _resolve_known_pairs(pairs):
    """Bulk-resolve drug pairs against local tables.

    Returns `(resolved, unknown)` where `resolved` maps a normalized pair to its
    interaction text (or None for a cached "no interaction"), and `unknown` is
    the set of pairs no local table can answer.

    This replaces a nested loop that issued two queries per pair -- 25 new x 50
    current medications meant 2,500 queries plus up to 1,250 external API calls
    inside a single request. It is now two queries total.
    """
    if not pairs:
        return {}, set()

    names = {name for pair in pairs for name in pair}
    resolved = {}

    # The curated dataset is authoritative, so it is consulted first -- a
    # graded pharmacology record must not be shadowed by a cached AI answer for
    # the same pair. Lowercase both sides so one index-backed IN filter covers
    # every pair regardless of stored casing.
    dataset_rows = (
        DrugInteraction.objects.annotate(d1=Lower("drug_1"), d2=Lower("drug_2"))
        .filter(d1__in=names, d2__in=names)
        .values_list("d1", "d2", "interaction", "severity", "management_recommendation")
    )
    for drug_1, drug_2, interaction, severity, management in dataset_rows:
        key = tuple(sorted([drug_1, drug_2]))
        if key not in pairs:
            continue
        # A pair can legitimately have two rows: `unique_together` is ordered,
        # so a bulk dataset may state B+A where a curated file stated A+B. Take
        # the most specific grading rather than whichever the database returned
        # first, or a large ungraded import would silently downgrade a curated
        # "contraindicated" to "unknown".
        incumbent = resolved.get(key)
        if incumbent is not None and SEVERITY_RANK.get(
            incumbent.severity, 0
        ) >= SEVERITY_RANK.get(severity, 0):
            continue
        resolved[key] = InteractionFinding(
            description=interaction,
            severity=severity,
            source=InteractionSource.DATASET,
            management=management or "",
        )

    # One query for previously-cached external lookups.
    remaining = pairs - resolved.keys()
    if remaining:
        cache_rows = InteractionLookupCache.objects.filter(
            drug_1__in=names, drug_2__in=names
        ).values_list("drug_1", "drug_2", "interaction", "severity", "source")
        for drug_1, drug_2, interaction, severity, source in cache_rows:
            key = tuple(sorted([drug_1, drug_2]))
            if key not in remaining or key in resolved:
                continue
            resolved[key] = (
                InteractionFinding(
                    description=interaction, severity=severity, source=source
                )
                if interaction
                else InteractionFinding.none_found(source)
            )

    return resolved, pairs - resolved.keys()


def _unidentifiable_drugs(pairs):
    """Names in `pairs` that no source can identify as a drug at all.

    A name qualifies only when RxNorm positively rejected it *and* the curated
    dataset does not grade it either. The dataset takes precedence because it is
    the authoritative source here: an ingredient it knows is a real drug even if
    RxNorm was unhelpful about the spelling.
    """
    names = {name for pair in pairs for name in pair}
    if not names:
        return set()

    candidates = unrecognized_names(names)
    if not candidates:
        return set()

    # Anything the dataset grades on either side is a genuine drug. One query;
    # both columns are intersected with the candidates because a name may appear
    # as either side of a graded pair.
    known_to_dataset = set()
    for drug_1, drug_2 in (
        DrugInteraction.objects.annotate(d1=Lower("drug_1"), d2=Lower("drug_2"))
        .filter(Q(d1__in=candidates) | Q(d2__in=candidates))
        .values_list("d1", "d2")
    ):
        known_to_dataset.update(candidates.intersection((drug_1, drug_2)))

    return candidates - known_to_dataset


@extend_schema(
    tags=["prescriptions"],
    summary="Screen medications without issuing a prescription",
    description=(
        "Used to warn the prescriber before they commit. Always returns "
        "`screening_complete` and `unscreened_pairs`: a pair whose sources were "
        "all unreachable is reported as unscreened, never silently dropped."
    ),
    request=InteractionCheckRequestSerializer,
    responses={200: InteractionCheckResponseSerializer, **ERROR_RESPONSES},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([InteractionCheckThrottle])
def save_prescription_and_check_interactions(request):
    """Check newly prescribed medications against a patient's current ones."""
    patient_id = request.data.get("patient_id")
    new_medications = request.data.get("new_medications")

    if patient_id in (None, ""):
        return _error("validation_error", "patient_id is required.")

    try:
        patient_id = int(patient_id)
    except (TypeError, ValueError):
        return _error("validation_error", "patient_id must be an integer.")

    if not isinstance(new_medications, list) or not new_medications:
        return _error(
            "validation_error", "new_medications must be a non-empty list of names."
        )

    if not all(isinstance(item, str) for item in new_medications):
        return _error("validation_error", "new_medications must contain only strings.")

    # Bound the fan-out. Without this, a caller controls how many external API
    # calls one request makes.
    max_new = settings.MAX_NEW_MEDICATIONS
    if len(new_medications) > max_new:
        return _error(
            "too_many_medications",
            f"At most {max_new} new medications can be checked in one request.",
        )

    new_meds = []
    for raw in new_medications:
        name = normalize_drug_name(raw)
        if name and name not in new_meds:
            new_meds.append(name)

    if not new_meds:
        return _error("validation_error", "new_medications contained no usable names.")

    patient = _get_owned_patient(request.user, patient_id)
    current_meds = patient.medication_list()[: settings.MAX_CURRENT_MEDICATIONS]

    # Persist the in-flight draft, as before, but keyed on a real FK.
    TemporaryPrescription.objects.update_or_create(
        patient=patient,
        defaults={
            "new_medications": ",".join(new_meds),
            "current_medications": ",".join(current_meds),
        },
    )

    try:
        interactions, unscreened = _check_pairs(
            patient, new_meds, current_meds, request.user
        )
    finally:
        # Always clear the draft, even if the check raised -- otherwise a failed
        # request leaves a stale row that blocks the next update_or_create path
        # from reflecting reality.
        TemporaryPrescription.objects.filter(patient=patient).delete()

    # `unscreened` is always present so a client cannot mistake an incomplete
    # screen for a clean one by only reading `interactions`.
    body = {
        "interactions": interactions,
        "unscreened_pairs": unscreened,
        "screening_complete": not unscreened,
    }
    if not interactions and not unscreened:
        body["message"] = "No interactions found"
    return Response(body)


def _check_pairs(patient, new_meds, current_meds, user, prescription=None):
    """Resolve every new x current pair and record what was found.

    `prescription` links the recorded warnings to the prescription that raised
    them; it is None for a standalone check that issues nothing.
    """
    # Resolve brand names to ingredients before pairing. Datasets are keyed on
    # ingredients, so "Tylenol" would otherwise never match "acetaminophen".
    # The display name is kept so the doctor sees what they typed.
    # Both lists resolved in one call so the alias cache is read once, not
    # twice. `resolve_many` is length-preserving, so the split is exact.
    combined = resolve_many(list(new_meds) + list(current_meds))
    new_resolved = combined[: len(new_meds)]
    current_resolved = combined[len(new_meds) :]
    display_name = {}
    for typed, ingredient in list(zip(new_meds, new_resolved)) + list(
        zip(current_meds, current_resolved)
    ):
        display_name.setdefault(ingredient, typed)

    pairs = set()
    for new_med in new_resolved:
        for current_med in current_resolved:
            if new_med == current_med:
                continue  # same ingredient on both lists is not an interaction
            pairs.add(_normalize_pair(new_med, current_med))

    if not pairs:
        return [], []

    # A name RxNorm has never heard of cannot be screened at all. openFDA
    # answers "no documents matched" for a nonexistent drug exactly as it does
    # for a real drug with a clean label, so screening one would turn a typo
    # into a confident all-clear -- the precise false negative this whole layer
    # exists to prevent. The curated dataset overrides RxNorm: a name it grades
    # is a real drug whatever RxNorm thinks.
    #
    # This runs *before* any lookup, including the local cache. An earlier
    # release did screen these names, so a stale `InteractionLookupCache` row
    # can hold a "nothing found" verdict for a drug that does not exist;
    # consulting the cache first would hand that poisoned negative straight
    # back. Deciding identifiability up front means such rows are never read.
    unidentifiable = _unidentifiable_drugs(pairs)
    if unidentifiable:
        logger.warning(
            "Unrecognized drug name(s) %s -- affected pairs reported as unscreened.",
            ", ".join(sorted(unidentifiable)),
        )

    screenable = {pair for pair in pairs if not unidentifiable.intersection(pair)}
    unscreened = sorted(pairs - screenable)

    # `_resolve_known_pairs` handles an empty set, so no special case is needed
    # when every pair involves an unidentifiable name -- the flow below falls
    # through to the same display-name mapping the other paths use.
    resolved, unknown = _resolve_known_pairs(screenable)

    # Only pairs nothing local can answer reach an external source.
    newly_cached = []
    for pair in sorted(unknown):
        finding = lookup_interaction_externally(pair[0], pair[1])
        if finding is None:
            # No source could be reached. Do not cache -- a transient outage
            # must never be baked in as "no interaction" -- and record the pair
            # so the caller can say it went unchecked rather than reporting a
            # silent all-clear for a pair nobody looked at.
            unscreened.append(pair)
            continue
        resolved[pair] = finding
        newly_cached.append(
            InteractionLookupCache(
                drug_1=pair[0],
                drug_2=pair[1],
                interaction=finding.description if finding.has_interaction else None,
                severity=finding.severity,
                source=finding.source,
            )
        )

    if newly_cached:
        # ignore_conflicts guards against a concurrent request caching the same
        # pair between our read and this write.
        InteractionLookupCache.objects.bulk_create(newly_cached, ignore_conflicts=True)

    interactions = []
    audit_rows = []
    for pair, finding in resolved.items():
        if not finding.has_interaction or not finding.description:
            continue  # checked, nothing significant found
        drug_1 = display_name.get(pair[0], pair[0])
        drug_2 = display_name.get(pair[1], pair[1])
        interactions.append(
            {
                "drug_1": drug_1,
                "drug_2": drug_2,
                "interaction": finding.description,
                "severity": finding.severity,
                "source": finding.source,
                "management": finding.management,
            }
        )
        audit_rows.append(
            SavedInteraction(
                patient=patient,
                prescription=prescription,
                checked_by=user if user and user.is_authenticated else None,
                drug_1=drug_1,
                drug_2=drug_2,
                interaction_description=finding.description,
                severity=finding.severity,
                source=finding.source,
                management_recommendation=finding.management,
            )
        )

    if audit_rows:
        # The original called SavedInteraction.objects.create() without a
        # `patient`, which raises IntegrityError against a non-null FK -- the
        # caching path crashed every time it was reached.
        with transaction.atomic():
            SavedInteraction.objects.bulk_create(audit_rows)

    # Most dangerous first: a contraindication must never be buried under a
    # list of minor interactions.
    interactions.sort(
        key=lambda row: (
            -SEVERITY_RANK.get(row["severity"], 0),
            row["drug_1"],
            row["drug_2"],
        )
    )

    unscreened_display = [
        {
            "drug_1": display_name.get(pair[0], pair[0]),
            "drug_2": display_name.get(pair[1], pair[1]),
        }
        for pair in unscreened
    ]
    if unscreened_display:
        logger.warning(
            "%d drug pair(s) could not be screened for patient %s -- all "
            "lookup sources unavailable.",
            len(unscreened_display),
            patient.id,
        )
    return interactions, unscreened_display


# --------------------------------------------------------------------------- #
# Prescriptions
# --------------------------------------------------------------------------- #


def _prescriptions_for(user):
    """Prescriptions for patients owned by `user`.

    `select_related`/`prefetch_related` keep the list endpoint at a constant
    number of queries rather than one per prescription for the patient name,
    plus one each for items and warnings.
    """
    return (
        Prescription.objects.filter(patient__doctor=user)
        .select_related("patient", "prescribed_by")
        .prefetch_related("items", "warnings")
    )


@extend_schema(
    tags=["prescriptions"],
    summary="List prescriptions, or issue a new one",
    description=(
        "Issuing runs the interaction check and stores the prescription, its "
        "medication lines and any warnings in one transaction. Check "
        "`screening_complete` on the response: a prescription can be saved with "
        "some pairs unscreened, and that is not an all-clear."
    ),
    parameters=[OpenApiParameter("patient", int, description="Filter by patient id.")],
    request=PrescriptionSerializer,
    responses={
        200: PrescriptionSerializer(many=True),
        201: PrescriptionSerializer,
        **ERROR_RESPONSES,
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([InteractionCheckThrottle])
def prescriptions(request):
    """List prescriptions, or issue a new one.

    Creating a prescription runs the interaction check and stores the
    prescription, its medication lines and any warnings raised -- all in one
    transaction, so a prescription can never be recorded without the warnings
    that accompanied it, or vice versa.
    """
    if request.method == "GET":
        queryset = _prescriptions_for(request.user)

        patient_id = request.query_params.get("patient")
        if patient_id:
            try:
                queryset = queryset.filter(patient_id=int(patient_id))
            except (TypeError, ValueError):
                return _error("validation_error", "patient must be an integer id.")

        paginator = PatientPagination()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(
            PrescriptionSerializer(page, many=True).data
        )

    serializer = PrescriptionSerializer(
        data=request.data,
        context={"doctor": request.user, "max_items": settings.MAX_NEW_MEDICATIONS},
    )
    if not serializer.is_valid():
        return _error(
            "validation_error",
            "The submitted data was invalid.",
            {"fields": serializer.errors},
        )

    patient = serializer.validated_data["patient"]
    new_meds = []
    for item in serializer.validated_data["items"]:
        name = normalize_drug_name(item["drug_name"])
        if name and name not in new_meds:
            new_meds.append(name)

    current_meds = patient.medication_list()[: settings.MAX_CURRENT_MEDICATIONS]

    # The external lookups inside _check_pairs are deliberately outside the
    # transaction below -- holding a database transaction open across a network
    # call to Gemini would pin a connection for the length of that call.
    with transaction.atomic():
        prescription = serializer.save(prescribed_by=request.user)

    interactions, unscreened = _check_pairs(
        patient, new_meds, current_meds, request.user, prescription=prescription
    )

    if unscreened:
        # Recorded on the prescription so the incompleteness survives in the
        # clinical record, not just in this response.
        prescription.unscreened_pair_count = len(unscreened)
        prescription.save(update_fields=["unscreened_pair_count"])

    logger.info(
        "Prescription %s issued for patient %s by %s (%d warning(s), %d unscreened pair(s))",
        prescription.id,
        patient.id,
        request.user.username,
        len(interactions),
        len(unscreened),
    )

    # Re-serialize so the response carries the warnings just written.
    prescription.refresh_from_db()
    return Response(
        PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED
    )


@extend_schema(
    tags=["prescriptions"],
    summary="One prescription with its medications and warnings",
    responses={200: PrescriptionSerializer, **ERROR_RESPONSES},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def prescription_detail(request, prescription_id):
    """One prescription with its medications and warnings."""
    prescription = get_object_or_404(_prescriptions_for(request.user), id=prescription_id)
    return Response(PrescriptionSerializer(prescription).data)

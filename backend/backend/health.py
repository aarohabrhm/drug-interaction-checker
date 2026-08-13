"""Health endpoints for deployment platforms to poll.

Two levels, because platforms want different things:

* `/healthz`  -- liveness. Process is up. No dependency checks, so a database
                 blip does not cause the orchestrator to kill a healthy worker.
* `/readyz`   -- readiness. Also verifies the database answers, so a rolling
                 deploy does not send traffic to an instance that cannot serve.
"""

import logging

from django.db import connection
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .schema import HealthResponseSerializer, ReadinessResponseSerializer

logger = logging.getLogger(__name__)


@extend_schema(
    tags=["health"],
    summary="Liveness probe",
    description="Process is up. Deliberately touches no dependencies, so a "
    "database blip does not cause the orchestrator to kill a healthy worker.",
    auth=[],
    responses={200: HealthResponseSerializer},
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
# Probes must never be rate limited. A platform polls these every few seconds,
# far above the 60/hour anonymous allowance, so the default throttle would
# start answering 429 and the orchestrator would conclude a healthy service was
# unhealthy. In production the throttle counters also live in a database-backed
# cache that outlives the container, so an exhausted allowance would persist
# across restarts and fail every later deploy too.
#
# Clearing the throttles is also what makes the docstring true: DRF's throttle
# reads the cache, and a liveness probe that depends on the database is not a
# liveness probe.
@throttle_classes([])
def liveness(request):
    """Cheap 'am I running' probe. Never touches the database."""
    return Response({"status": "ok"})


@extend_schema(
    tags=["health"],
    summary="Readiness probe",
    description="Also verifies the database answers. Returns 503 when degraded.",
    auth=[],
    responses={200: ReadinessResponseSerializer, 503: ReadinessResponseSerializer},
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
# Polled on the same schedule as liveness, so it needs the same exemption.
@throttle_classes([])
def readiness(request):
    """Probe that also confirms the database is reachable."""
    checks = {}
    healthy = True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = "ok"
    except Exception:
        # Deliberately does not echo the driver error to the client -- it can
        # contain the host and username.
        logger.exception("Readiness probe failed: database unreachable")
        checks["database"] = "unavailable"
        healthy = False

    return Response(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
    )

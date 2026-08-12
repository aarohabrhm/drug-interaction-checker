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
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def liveness(request):
    """Cheap 'am I running' probe. Never touches the database."""
    return Response({"status": "ok"})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
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

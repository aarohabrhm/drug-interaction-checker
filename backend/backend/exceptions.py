"""Uniform, non-leaking API error responses.

Every error the API returns has the same shape:

    {"error": {"code": "<machine_code>", "message": "<human text>", "details": {...}}}

`details` is only present for validation errors, where the client needs to know
which field was rejected. Unexpected exceptions are logged in full server-side
and reduced to a generic message for the client, so stack traces, SQL, and
internal paths never reach the browser.
"""

import logging
import uuid

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# HTTP status -> stable machine-readable code for clients to branch on.
_CODE_BY_STATUS = {
    400: "bad_request",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    415: "unsupported_media_type",
    429: "rate_limited",
    500: "internal_error",
    502: "upstream_error",
    503: "service_unavailable",
}


def _envelope(code, message, details=None):
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return body


def safemeds_exception_handler(exc, context):
    """DRF EXCEPTION_HANDLER hook."""
    # Translate a few Django-native exceptions DRF does not handle by default.
    if isinstance(exc, Http404):
        return Response(
            _envelope("not_found", "The requested resource does not exist."),
            status=status.HTTP_404_NOT_FOUND,
        )
    if isinstance(exc, PermissionDenied):
        return Response(
            _envelope("forbidden", "You do not have permission to perform this action."),
            status=status.HTTP_403_FORBIDDEN,
        )
    if isinstance(exc, DjangoValidationError):
        return Response(
            _envelope(
                "validation_error",
                "The submitted data was invalid.",
                {"fields": exc.message_dict if hasattr(exc, "message_dict") else exc.messages},
            ),
            status=status.HTTP_400_BAD_REQUEST,
        )

    response = drf_exception_handler(exc, context)

    if response is None:
        # Genuinely unexpected. Log with a correlation id the user can quote to
        # support, and return nothing revealing.
        incident = uuid.uuid4().hex[:12]
        view = context.get("view").__class__.__name__ if context.get("view") else "unknown"
        logger.exception("Unhandled exception in %s (incident=%s)", view, incident)
        return Response(
            _envelope(
                "internal_error",
                "An unexpected error occurred. Quote this reference when reporting it.",
                {"incident": incident},
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = _CODE_BY_STATUS.get(response.status_code, "error")
    detail = response.data

    # DRF's default body varies: {"detail": "..."} for most errors, or a
    # field->errors mapping for validation. Normalise both into the envelope.
    if isinstance(detail, dict) and set(detail.keys()) == {"detail"}:
        message = str(detail["detail"])
        details = None
    elif isinstance(detail, dict):
        code = "validation_error" if response.status_code == 400 else code
        message = "The submitted data was invalid."
        details = {"fields": detail}
    elif isinstance(detail, list):
        code = "validation_error" if response.status_code == 400 else code
        message = "The submitted data was invalid."
        details = {"errors": detail}
    else:
        message = str(detail)
        details = None

    response.data = _envelope(code, message, details)
    return response

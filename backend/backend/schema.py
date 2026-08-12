"""Shared OpenAPI response shapes.

These serializers exist to describe the API to drf-spectacular. They are not
used for request validation -- the views validate by hand and return the
envelope from `backend.exceptions` -- so if you change a view's payload, update
the matching serializer here too.
"""

from drf_spectacular.utils import OpenApiExample, extend_schema_field
from rest_framework import serializers


class ErrorDetailSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="Stable machine-readable error code.")
    message = serializers.CharField(help_text="Human-readable description.")
    details = serializers.DictField(
        required=False,
        help_text="Present for validation errors (`fields`) and 500s (`incident`).",
    )


class ErrorResponseSerializer(serializers.Serializer):
    """The single error shape every endpoint returns."""

    error = ErrorDetailSerializer()


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class HealthResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok", "degraded"])


class ReadinessResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok", "degraded"])
    checks = serializers.DictField(
        child=serializers.CharField(),
        help_text='Per-dependency result, e.g. {"database": "ok"}.',
    )


VALIDATION_ERROR_EXAMPLE = OpenApiExample(
    "Validation error",
    value={
        "error": {
            "code": "validation_error",
            "message": "The submitted data was invalid.",
            "details": {"fields": {"age": ["Age must be between 0 and 130."]}},
        }
    },
    response_only=True,
    status_codes=["400"],
)

NOT_FOUND_EXAMPLE = OpenApiExample(
    "Not found",
    value={
        "error": {
            "code": "not_found",
            "message": "The requested resource does not exist.",
        }
    },
    response_only=True,
    status_codes=["404"],
)


# Common response map, spread into @extend_schema(responses=...) calls.
ERROR_RESPONSES = {
    400: ErrorResponseSerializer,
    401: ErrorResponseSerializer,
    404: ErrorResponseSerializer,
    429: ErrorResponseSerializer,
}

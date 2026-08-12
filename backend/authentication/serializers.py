"""Request/response shapes for the auth endpoints.

Documentation-only: `views.py` validates by hand so it can control the exact
error envelope and the deliberately-uniform "invalid credentials" response.
Keep these in step with the views -- they are what the OpenAPI schema publishes.
"""

from rest_framework import serializers


class SignupRequestSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="Checked against Django's AUTH_PASSWORD_VALIDATORS (min 10 chars).",
    )
    specialty = serializers.CharField(
        max_length=100, required=False, allow_blank=True
    )


class SignupResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    username = serializers.CharField()


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )


class LoginResponseSerializer(serializers.Serializer):
    token = serializers.CharField(
        help_text="Send as `Authorization: Token <token>`. Expires after "
        "AUTH_TOKEN_TTL_HOURS and is rotated on every login."
    )
    username = serializers.CharField()
    specialty = serializers.CharField()


class DoctorProfileSerializer(serializers.Serializer):
    username = serializers.CharField()
    specialty = serializers.CharField()

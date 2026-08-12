"""Doctor signup / login / logout / profile.

Rewritten from a set of bare `@csrf_exempt` Django views. The originals had
three concrete defects:

1. `get_user_details` carried DRF's `@authentication_classes` /
   `@permission_classes` decorators but was a plain Django view, so DRF never
   ran them -- the endpoint was effectively public and returned an empty
   username for anonymous callers.
2. `signup` returned `str(exception)` to the client, leaking internals, and
   called `create_user` directly, bypassing AUTH_PASSWORD_VALIDATORS entirely.
3. `login_view` returned `None` for non-POST requests (a 500) and had no
   throttling, so it was freely brute-forceable.
"""

import logging

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Doctor

logger = logging.getLogger(__name__)

USERNAME_MAX_LENGTH = 150
SPECIALTY_MAX_LENGTH = 100


class LoginRateThrottle(AnonRateThrottle):
    """Throttle login attempts per client IP (rate from DEFAULT_THROTTLE_RATES)."""

    scope = "login"


class SignupRateThrottle(AnonRateThrottle):
    scope = "signup"


def _error(code, message, details=None, http_status=status.HTTP_400_BAD_REQUEST):
    """Match the envelope produced by backend.exceptions."""
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return Response(body, status=http_status)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SignupRateThrottle])
def signup(request):
    """Register a doctor account."""
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    specialty = (request.data.get("specialty") or "").strip()

    field_errors = {}
    if not username:
        field_errors["username"] = ["This field is required."]
    elif len(username) > USERNAME_MAX_LENGTH:
        field_errors["username"] = [f"Must be at most {USERNAME_MAX_LENGTH} characters."]

    if not password:
        field_errors["password"] = ["This field is required."]

    if len(specialty) > SPECIALTY_MAX_LENGTH:
        field_errors["specialty"] = [f"Must be at most {SPECIALTY_MAX_LENGTH} characters."]

    if field_errors:
        return _error("validation_error", "The submitted data was invalid.", {"fields": field_errors})

    # Enforce AUTH_PASSWORD_VALIDATORS. `create_user` does not do this itself.
    try:
        validate_password(password, User(username=username))
    except ValidationError as exc:
        return _error(
            "validation_error",
            "The submitted data was invalid.",
            {"fields": {"password": list(exc.messages)}},
        )

    try:
        # Username uniqueness is enforced by the database, not a prior
        # `.exists()` check -- the check-then-insert pattern the original used
        # races under concurrent signups.
        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password)
            # The original discarded `specialty`, so every profile read back as
            # "Not Specified". Persist it.
            Doctor.objects.create(user=user, specialty=specialty or None)
    except IntegrityError:
        return _error(
            "username_taken",
            "That username is already registered.",
            http_status=status.HTTP_409_CONFLICT,
        )

    logger.info("New doctor account created: %s", username)
    return Response(
        {"message": "Account created successfully.", "username": user.username},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    """Exchange credentials for an auth token."""
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    if not username or not password:
        return _error(
            "validation_error",
            "Username and password are required.",
        )

    user = authenticate(request=request, username=username, password=password)

    if user is None or not user.is_active:
        # Deliberately identical response for "no such user", "wrong password"
        # and "disabled account" so the endpoint is not a username oracle.
        logger.warning("Failed login attempt for username=%s", username)
        return _error(
            "invalid_credentials",
            "Invalid username or password.",
            http_status=status.HTTP_401_UNAUTHORIZED,
        )

    # Rotate the token on every login so a stale token cannot be revived and
    # the TTL clock restarts from this login.
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)

    doctor = getattr(user, "doctor", None)
    return Response(
        {
            "token": token.key,
            "username": user.username,
            "specialty": (doctor.specialty if doctor and doctor.specialty else "Not Specified"),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Invalidate the caller's token server-side.

    The frontend previously "logged out" by navigating away, leaving the token
    valid until it expired.
    """
    Token.objects.filter(user=request.user).delete()
    return Response({"message": "Logged out."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_details(request):
    """Return the authenticated doctor's profile."""
    doctor = getattr(request.user, "doctor", None)
    return Response(
        {
            "username": request.user.username,
            "specialty": (doctor.specialty if doctor and doctor.specialty else "Not Specified"),
        }
    )

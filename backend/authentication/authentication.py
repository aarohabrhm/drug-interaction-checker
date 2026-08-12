"""Token authentication with an expiry.

DRF's stock `TokenAuthentication` issues tokens that are valid forever -- a
leaked token from a doctor's browser never stops working. This subclass rejects
tokens older than `settings.AUTH_TOKEN_TTL_HOURS` and deletes them, so the next
login mints a fresh one.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    keyword = "Token"

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)

        ttl_hours = getattr(settings, "AUTH_TOKEN_TTL_HOURS", 12)
        if ttl_hours > 0 and token.created < timezone.now() - timedelta(hours=ttl_hours):
            token.delete()
            raise AuthenticationFailed("Token has expired. Please log in again.")

        return user, token

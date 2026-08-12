"""Smoke tests for the auth fixes found during the readiness audit.

Narrow by design -- pins the specific defects, not a full auth suite.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Doctor


class SignupTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle state lives in the cache

    def test_weak_password_is_rejected(self):
        """Regression: create_user() bypasses AUTH_PASSWORD_VALIDATORS, so the
        old endpoint happily accepted '123'."""
        response = self.client.post(
            reverse("signup"), {"username": "dr1", "password": "123"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["error"]["details"]["fields"])
        self.assertFalse(User.objects.filter(username="dr1").exists())

    def test_specialty_is_persisted(self):
        """Regression: signup discarded `specialty`, so every profile read back
        as 'Not Specified'."""
        response = self.client.post(
            reverse("signup"),
            {"username": "dr2", "password": "correct-horse-battery", "specialty": "Cardiology"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        doctor = Doctor.objects.get(user__username="dr2")
        self.assertEqual(doctor.specialty, "Cardiology")

    def test_duplicate_username_returns_conflict_not_500(self):
        User.objects.create_user(username="dr3", password="correct-horse-battery")
        response = self.client.post(
            reverse("signup"),
            {"username": "dr3", "password": "another-good-passphrase"},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "username_taken")

    def test_missing_fields_return_validation_error(self):
        response = self.client.post(reverse("signup"), {}, format="json")
        self.assertEqual(response.status_code, 400)
        fields = response.data["error"]["details"]["fields"]
        self.assertIn("username", fields)
        self.assertIn("password", fields)


class LoginTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="dr4", password="correct-horse-battery")
        Doctor.objects.create(user=self.user, specialty="Neurology")

    def test_successful_login_returns_token_and_profile(self):
        response = self.client.post(
            reverse("login"),
            {"username": "dr4", "password": "correct-horse-battery"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["specialty"], "Neurology")

    def test_wrong_password_returns_401_not_400(self):
        response = self.client.post(
            reverse("login"), {"username": "dr4", "password": "wrong"}, format="json"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["error"]["code"], "invalid_credentials")

    def test_unknown_and_known_username_are_indistinguishable(self):
        """The endpoint must not work as a username oracle."""
        unknown = self.client.post(
            reverse("login"), {"username": "nobody", "password": "wrong"}, format="json"
        )
        known = self.client.post(
            reverse("login"), {"username": "dr4", "password": "wrong"}, format="json"
        )
        self.assertEqual(unknown.status_code, known.status_code)
        self.assertEqual(unknown.data, known.data)

    def test_get_is_rejected_not_a_500(self):
        """Regression: the old view fell through and returned None for non-POST,
        which Django surfaces as a 500."""
        response = self.client.get(reverse("login"))
        self.assertEqual(response.status_code, 405)

    def test_login_is_throttled(self):
        """Regression: the login endpoint had no rate limit at all."""
        statuses = [
            self.client.post(
                reverse("login"), {"username": "dr4", "password": "wrong"}, format="json"
            ).status_code
            for _ in range(15)
        ]
        self.assertIn(429, statuses, msg="login endpoint accepted 15 attempts unthrottled")

    def test_login_rotates_token(self):
        old = Token.objects.create(user=self.user)
        response = self.client.post(
            reverse("login"),
            {"username": "dr4", "password": "correct-horse-battery"},
            format="json",
        )
        self.assertNotEqual(response.data["token"], old.key)
        self.assertFalse(Token.objects.filter(key=old.key).exists())


class ProfileAndTokenTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="dr5", password="correct-horse-battery")
        Doctor.objects.create(user=self.user, specialty="Oncology")
        self.token = Token.objects.create(user=self.user)

    def test_profile_rejects_anonymous(self):
        """Regression: DRF's permission decorators were applied to a plain
        Django view, so they never ran and the endpoint was effectively public."""
        response = self.client.get(reverse("user-details"))
        self.assertEqual(response.status_code, 401)

    def test_profile_returns_authenticated_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get(reverse("user-details"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "dr5")
        self.assertEqual(response.data["specialty"], "Oncology")

    def test_expired_token_is_rejected_and_deleted(self):
        """Regression: DRF tokens never expire on their own."""
        self.token.created = timezone.now() - timedelta(hours=48)
        self.token.save(update_fields=["created"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get(reverse("user-details"))
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Token.objects.filter(key=self.token.key).exists())

    def test_logout_invalidates_token_server_side(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.assertEqual(self.client.post(reverse("logout")).status_code, 200)
        self.assertFalse(Token.objects.filter(key=self.token.key).exists())
        self.assertEqual(self.client.get(reverse("user-details")).status_code, 401)

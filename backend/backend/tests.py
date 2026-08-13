"""Deployment-posture tests.

These cover configuration that only takes effect with `DEBUG=false`, which is
exactly the configuration no one exercises locally and which therefore breaks
quietly. Each test here corresponds to a defect that shipped once.
"""

import os
import re
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from django.urls import reverse

from .settings import _origins, build_cache_config


class HealthProbeRedirectExemptionTests(SimpleTestCase):
    """Health probes must answer over plain HTTP.

    Docker's HEALTHCHECK, and Render/Fly/Kubernetes probes, call the container
    over internal HTTP. With SECURE_SSL_REDIRECT on and no exemption they get a
    301 -- and because `curl -f` does not treat a 3xx as a failure, the
    healthcheck passes without ever reaching the application. A probe that can
    only succeed is worse than none, so this pins both halves of the fix.
    """

    # Mirrors the production branch of settings.py, which is not active while
    # tests run (the suite speaks plain HTTP, so the redirect is disabled).
    EXEMPT_PATTERNS = [r"^healthz/?$", r"^readyz/?$"]

    def test_probe_urls_match_the_exemption_patterns(self):
        """Renaming a probe URL without updating the patterns must fail here."""
        for url_name in ("liveness", "readiness"):
            with self.subTest(url=url_name):
                path = reverse(url_name).lstrip("/")
                self.assertTrue(
                    any(re.search(p, path) for p in self.EXEMPT_PATTERNS),
                    f"{reverse(url_name)} is not covered by SECURE_REDIRECT_EXEMPT; "
                    f"the deployment health check will silently pass on a 301.",
                )

    def test_settings_expose_the_expected_patterns_under_ssl_redirect(self):
        from django.conf import settings

        with override_settings(
            SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=self.EXEMPT_PATTERNS
        ):
            self.assertEqual(settings.SECURE_REDIRECT_EXEMPT, self.EXEMPT_PATTERNS)

    @override_settings(
        SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=EXEMPT_PATTERNS
    )
    def test_liveness_is_not_redirected_over_plain_http(self):
        response = self.client.get(reverse("liveness"))
        self.assertEqual(response.status_code, 200)

    @override_settings(SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=[])
    def test_without_the_exemption_the_probe_is_redirected(self):
        """Proves the test above is actually testing something."""
        response = self.client.get(reverse("liveness"))
        self.assertEqual(response.status_code, 301)


class OriginNormalizationTests(SimpleTestCase):
    """CORS and CSRF need absolute origins; deployments supply bare hostnames.

    A blueprint can wire one service's hostname into another automatically, but
    only as a host with no scheme -- and CORS rejects that outright. Reading a
    scheme-less entry as https is what lets the deployment configure itself
    instead of relying on someone pasting URLs in by hand.
    """

    def test_bare_host_becomes_https(self):
        with patch.dict(os.environ, {"X_ORIGINS": "safemeds-web.onrender.com"}):
            self.assertEqual(
                _origins("X_ORIGINS"), ["https://safemeds-web.onrender.com"]
            )

    def test_explicit_scheme_is_preserved(self):
        """Local development must keep http, not be forced to https."""
        with patch.dict(os.environ, {"X_ORIGINS": "http://localhost:5173"}):
            self.assertEqual(_origins("X_ORIGINS"), ["http://localhost:5173"])

    def test_trailing_slash_is_stripped(self):
        """An origin with a path is not an origin, and CORS will not match it."""
        with patch.dict(os.environ, {"X_ORIGINS": "https://example.com/"}):
            self.assertEqual(_origins("X_ORIGINS"), ["https://example.com"])

    def test_mixed_list_is_normalized_per_entry(self):
        with patch.dict(
            os.environ, {"X_ORIGINS": "example.com, http://localhost:5173"}
        ):
            self.assertEqual(
                _origins("X_ORIGINS"),
                ["https://example.com", "http://localhost:5173"],
            )

    def test_unset_returns_the_default(self):
        os.environ.pop("X_ORIGINS", None)
        self.assertEqual(_origins("X_ORIGINS", ["http://localhost:5173"]),
                         ["http://localhost:5173"])


class ThrottleCacheBackendTests(SimpleTestCase):
    """DRF throttle counters live in the default cache.

    LocMemCache is per-process, so under gunicorn with N workers the effective
    login rate limit is N x the configured value and it resets on every deploy.
    That is a brute-force window, so production must use a shared backend.
    """

    def test_production_without_redis_uses_the_shared_database_cache(self):
        config = build_cache_config(redis_url="", debug=False)
        self.assertEqual(
            config["BACKEND"], "django.core.cache.backends.db.DatabaseCache"
        )

    def test_redis_is_preferred_when_available(self):
        config = build_cache_config(redis_url="redis://localhost:6379/0", debug=False)
        self.assertEqual(config["BACKEND"], "django.core.cache.backends.redis.RedisCache")
        self.assertEqual(config["LOCATION"], "redis://localhost:6379/0")

    def test_redis_wins_even_in_debug(self):
        config = build_cache_config(redis_url="redis://localhost:6379/0", debug=True)
        self.assertEqual(config["BACKEND"], "django.core.cache.backends.redis.RedisCache")

    def test_locmem_is_never_selected_for_a_real_deployment(self):
        """The regression that matters: per-process throttle counters in prod."""
        for redis_url in ("", None):
            with self.subTest(redis_url=redis_url):
                config = build_cache_config(
                    redis_url=redis_url or "", debug=False, testing=False
                )
                self.assertNotIn("locmem", config["BACKEND"])

    def test_locmem_is_still_used_for_local_development(self):
        config = build_cache_config(redis_url="", debug=True)
        self.assertEqual(
            config["BACKEND"], "django.core.cache.backends.locmem.LocMemCache"
        )

    def test_test_runs_use_locmem_whatever_else_is_configured(self):
        """CI runs with DEBUG=false, and `migrate` creates no cache table.

        Without this the suite would throttle against a table that does not
        exist, and would reach a real Redis if one were configured.
        """
        config = build_cache_config(
            redis_url="redis://localhost:6379/0", debug=False, testing=True
        )
        self.assertEqual(
            config["BACKEND"], "django.core.cache.backends.locmem.LocMemCache"
        )

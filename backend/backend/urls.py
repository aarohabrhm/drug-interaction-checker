"""Root URL configuration for the SafeMeds backend."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from . import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("auth/", include("authentication.urls")),
    path("api/", include("interactions.urls")),
    # Deployment probes -- unauthenticated by design, expose no data.
    path("healthz", health.liveness, name="liveness"),
    path("readyz", health.readiness, name="readiness"),
    # Machine-readable schema. Served in every environment so clients and CI can
    # diff it; the interactive UIs below are dev-only.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
]

if settings.DEBUG:
    # Swagger/ReDoc enumerate the entire API surface with try-it-out forms.
    # Useful locally, not something to expose publicly by default.
    urlpatterns += [
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="redoc",
        ),
    ]

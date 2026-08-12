"""Root URL configuration for the SafeMeds backend."""

from django.contrib import admin
from django.urls import include, path

from . import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("auth/", include("authentication.urls")),
    path("api/", include("interactions.urls")),
    # Deployment probes -- unauthenticated by design, expose no data.
    path("healthz", health.liveness, name="liveness"),
    path("readyz", health.readiness, name="readiness"),
]

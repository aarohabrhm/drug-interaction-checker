from django.contrib import admin

from .models import Doctor


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("user", "specialty")
    search_fields = ("user__username", "specialty")
    autocomplete_fields = ("user",)

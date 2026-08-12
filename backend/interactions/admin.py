from django.contrib import admin

from .models import (
    DrugInteraction,
    InteractionLookupCache,
    PatientList,
    Prescription,
    PrescriptionItem,
    SavedInteraction,
    TemporaryPrescription,
)


@admin.register(PatientList)
class PatientListAdmin(admin.ModelAdmin):
    list_display = ("name", "doctor", "age", "phone_number", "email", "registered_date")
    search_fields = ("name", "phone_number", "email")
    list_filter = ("registered_date", "doctor")
    readonly_fields = ("registered_date",)
    autocomplete_fields = ("doctor",)


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 0


class PrescriptionWarningInline(admin.TabularInline):
    """Warnings raised when this prescription was issued -- read-only record."""

    model = SavedInteraction
    extra = 0
    fields = ("drug_1", "drug_2", "interaction_description", "checked_at")
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "prescribed_by", "created_at")
    search_fields = ("patient__name", "diagnosis")
    list_filter = ("created_at",)
    readonly_fields = ("created_at",)
    inlines = (PrescriptionItemInline, PrescriptionWarningInline)


@admin.register(DrugInteraction)
class DrugInteractionAdmin(admin.ModelAdmin):
    list_display = ("drug_1", "drug_2")
    search_fields = ("drug_1", "drug_2")


@admin.register(InteractionLookupCache)
class InteractionLookupCacheAdmin(admin.ModelAdmin):
    list_display = ("drug_1", "drug_2", "has_interaction", "source", "checked_at")
    search_fields = ("drug_1", "drug_2")
    list_filter = ("source", "checked_at")
    readonly_fields = ("checked_at",)


@admin.register(SavedInteraction)
class SavedInteractionAdmin(admin.ModelAdmin):
    """Clinical audit trail: readable and deletable, but never editable.

    Allowing edits here would let someone silently rewrite the record of what a
    doctor was warned about. Deletion stays available for data-retention
    requests, and Django's admin already confirms it.
    """

    list_display = ("patient", "drug_1", "drug_2", "prescription", "checked_by", "checked_at")
    search_fields = ("patient__name", "drug_1", "drug_2")
    list_filter = ("checked_at",)
    readonly_fields = (
        "patient",
        "prescription",
        "checked_by",
        "drug_1",
        "drug_2",
        "interaction_description",
        "checked_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(TemporaryPrescription)
class TemporaryPrescriptionAdmin(admin.ModelAdmin):
    """Scratch table, exposed read-only for debugging stuck checks."""

    list_display = ("patient", "created_at")
    readonly_fields = ("patient", "new_medications", "current_medications", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

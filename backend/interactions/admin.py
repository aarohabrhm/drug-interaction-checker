from django.contrib import admin

from .models import (
    DrugInteraction,
    DrugNameAlias,
    InteractionLookupCache,
    InteractionSource,
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
    list_display = ("drug_1", "drug_2", "severity")
    search_fields = ("drug_1", "drug_2")
    list_filter = ("severity",)


@admin.register(InteractionLookupCache)
class InteractionLookupCacheAdmin(admin.ModelAdmin):
    list_display = ("drug_1", "drug_2", "has_interaction", "severity", "source", "checked_at")
    search_fields = ("drug_1", "drug_2")
    list_filter = ("source", "severity", "checked_at")
    readonly_fields = ("checked_at",)
    actions = ("clear_ai_answers",)

    @admin.action(description="Delete cached AI answers (forces re-lookup)")
    def clear_ai_answers(self, request, queryset):
        """AI answers are the least trustworthy cached rows; allow flushing them
        without touching openFDA-sourced entries."""
        deleted, _ = queryset.filter(source=InteractionSource.AI_UNVERIFIED).delete()
        self.message_user(request, f"Deleted {deleted} unverified AI cache entries.")


@admin.register(DrugNameAlias)
class DrugNameAliasAdmin(admin.ModelAdmin):
    list_display = ("queried_name", "ingredient", "rxcui", "resolved_at")
    search_fields = ("queried_name", "ingredient")
    readonly_fields = ("resolved_at",)


@admin.register(SavedInteraction)
class SavedInteractionAdmin(admin.ModelAdmin):
    """Clinical audit trail: readable and deletable, but never editable.

    Allowing edits here would let someone silently rewrite the record of what a
    doctor was warned about. Deletion stays available for data-retention
    requests, and Django's admin already confirms it.
    """

    list_display = (
        "patient", "drug_1", "drug_2", "severity", "source", "prescription", "checked_at"
    )
    search_fields = ("patient__name", "drug_1", "drug_2")
    list_filter = ("severity", "source", "checked_at")
    readonly_fields = (
        "patient",
        "prescription",
        "checked_by",
        "drug_1",
        "drug_2",
        "interaction_description",
        "severity",
        "source",
        "management_recommendation",
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

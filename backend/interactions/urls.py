from django.urls import path

from . import views

urlpatterns = [
    # Patients
    path("patients/", views.get_patients, name="get_patients"),
    path("patients/add/", views.add_patient, name="add_patient"),
    path("patients/<int:patient_id>/", views.patient_detail, name="patient_detail"),
    path(
        "patients/<int:patient_id>/interactions/",
        views.patient_interaction_history,
        name="patient_interaction_history",
    ),
    # Prescriptions
    path("prescriptions/", views.prescriptions, name="prescriptions"),
    path(
        "prescriptions/<int:prescription_id>/",
        views.prescription_detail,
        name="prescription_detail",
    ),
    # Standalone interaction check (no prescription issued). Kept because the
    # form uses it to warn the doctor *before* they commit to prescribing.
    path(
        "prescriptions/check/",
        views.save_prescription_and_check_interactions,
        name="check_prescription_interactions",
    ),
    # Reference data. Read-only -- the interaction table is loaded by
    # `import_interactions`, not edited through the API.
    path("drugs/search/", views.drug_search, name="drug_search"),
    path("interactions/", views.interaction_list, name="interaction_list"),
    path("stats/", views.stats, name="stats"),
]

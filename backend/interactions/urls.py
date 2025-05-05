from django.urls import path
from . import views
from .views import add_patient
from .views import save_prescription_and_check_interactions

urlpatterns = [
    path('patients/', views.get_patients, name='get_patients'),
    path('patients/add/', add_patient, name='add_patient'),
    path("prescriptions/check/", save_prescription_and_check_interactions, name="check_prescription_interactions"),
]
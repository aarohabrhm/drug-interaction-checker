from django.contrib import admin

# Register your models here.
from .models import PatientList, SavedInteraction, DrugInteraction, TemporaryPrescription

admin.site.register(PatientList)
admin.site.register(SavedInteraction)
admin.site.register(DrugInteraction)
admin.site.register(TemporaryPrescription)

from django.contrib.auth.models import User
from django.db import models


from django.db import models

class TemporaryPrescription(models.Model):
    patient_id = models.IntegerField(unique=True)  # Ensure one record per patient
    new_medications = models.TextField()  # Comma-separated new meds
    current_medications = models.TextField()  # Comma-separated current meds

    def __str__(self):
        return f"Patient {self.patient_id}"

# ✅ Patient Model (Accessible to all users)
class PatientList(models.Model):
    name = models.CharField(max_length=255)
    age = models.IntegerField()
    registered_date = models.DateTimeField(auto_now_add=True)
    medical_condition = models.TextField()
    remarks = models.TextField(blank=True, null=True)
    phone_number = models.CharField(max_length=15, unique=True)
    email = models.EmailField(unique=True)
    current_medications = models.TextField()  # Store as comma-separated values (or JSON)

    def __str__(self):
        return self.name

# ✅ Drug Interaction Model
class DrugInteraction(models.Model):
    drug_1 = models.CharField(max_length=255)
    drug_2 = models.CharField(max_length=255)
    interaction = models.TextField()

    class Meta:
        unique_together = ('drug_1', 'drug_2')

    def __str__(self):
        return f"{self.drug_1} & {self.drug_2} Interaction"

# ✅ Saved Interactions (For Future Use)
class SavedInteraction(models.Model):
    patient = models.ForeignKey(PatientList, on_delete=models.CASCADE, related_name="saved_interactions")
    drug_1 = models.CharField(max_length=255)
    drug_2 = models.CharField(max_length=255)
    interaction_description = models.TextField()
    checked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.drug_1} & {self.drug_2} ({self.patient.name})"

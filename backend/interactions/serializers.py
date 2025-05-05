from rest_framework import serializers
from .models import PatientList

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientList
        fields = '__all__'  # Includes all fields in the PatientList model

from rest_framework import serializers




# API Key for Gemini
GEMINI_API_KEY = ""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import PatientList
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .serializers import PatientSerializer
from .models import PatientList, DrugInteraction, SavedInteraction, TemporaryPrescription
from django.shortcuts import get_object_or_404
from django.utils import timezone
import json
import requests
from rest_framework.request import Request
from django.http import HttpRequest

@api_view(['GET'])
@permission_classes([AllowAny])  # ✅ Allow anyone to access this endpoint
def get_patients(request):
    patients = PatientList.objects.all()
    
    patient_data = [
        {
            'id': str(patient.id),
            'name': patient.name,
            'age': patient.age,
            'registered_date': patient.registered_date.isoformat(),
            'medical_condition': patient.medical_condition,
            'remarks': patient.remarks or '',
            'phone_number': patient.phone_number,
            'email': patient.email,
            'current_medications': patient.current_medications,
        }
        for patient in patients
    ]
    return Response(patient_data)


@csrf_exempt  # Disable CSRF protection for testing
@api_view(['POST'])
@permission_classes([AllowAny])  # ✅ Allow anyone to add patients (No authentication needed)
def add_patient(request):
    serializer = PatientSerializer(data=request.data)  # Validate incoming data
    if serializer.is_valid():
        serializer.save()  # Save to DB
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# Helper: Normalize drug pair order (alphabetical, case-insensitive)
def normalize_pair(drug1, drug2):
    return tuple(sorted([drug1.strip().lower(), drug2.strip().lower()]))

# Helper: Check for a saved interaction
def check_saved_interaction(drug1, drug2):
    pair = normalize_pair(drug1, drug2)
    saved = SavedInteraction.objects.filter(
        drug_1__iexact=pair[0],
        drug_2__iexact=pair[1]
    ).first()
    if saved:
        return saved.interaction_description
    return None

# Helper: Check the pre-loaded DrugInteraction model
def check_drug_interaction(drug1, drug2):
    pair = normalize_pair(drug1, drug2)
    interaction = DrugInteraction.objects.filter(
        drug_1__iexact=pair[0],
        drug_2__iexact=pair[1]
    ).first()
    if interaction:
        return interaction.interaction
    return None

# Helper: Query Gemini API for interaction between two drugs
def query_gemini_for_interaction(drug1, drug2):
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {"parts": [{"text": f"What are the interactions between {drug1} and {drug2}?. Respond in 1 line"}]}
        ]
    }
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            data = response.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
        return None
    except Exception as e:
        print("Gemini API error:", e)
        return None

@api_view(['POST'])
@permission_classes([AllowAny])
def save_prescription_and_check_interactions(request):
    """
    Saves newly prescribed medicines and current medications in TemporaryPrescription.
    Then, checks interactions.
    """
    patient_id = request.data.get("patient_id")
    new_medications = request.data.get("new_medications", [])  # List of new meds

    if not patient_id or not new_medications:
        return Response({"error": "Patient ID and new medications are required."}, status=400)

    # Fetch current medications of the patient
    patient = get_object_or_404(PatientList, id=patient_id)
    current_medications = patient.current_medications  # Stored as a comma-separated string

    # Save in temporary database
    TemporaryPrescription.objects.update_or_create(
        patient_id=patient_id,
        defaults={
            "new_medications": ",".join(new_medications),
            "current_medications": current_medications
        }
    )

    # Proceed to interaction checking
    return check_interactions(request, patient_id)

def check_interactions(request, patient_id):
    django_request = request._request
    """
    Compares new and current medications for interactions and returns all detected interactions.
    """
    temp_prescription = get_object_or_404(TemporaryPrescription, patient_id=patient_id)

    new_meds = temp_prescription.new_medications.split(",")
    current_meds = temp_prescription.current_medications.split(",")

    interactions = []  # Store all detected interactions

    for new_med in new_meds:
        for current_med in current_meds:
            drug1, drug2 = new_med.strip(), current_med.strip()

            # 1. Check SavedInteraction DB
            saved_interaction = check_saved_interaction(drug1, drug2)
            if saved_interaction and "There are no known significant interactions" not in saved_interaction:
                interactions.append({"drug_1": drug1, "drug_2": drug2, "interaction": saved_interaction})
                continue  # Skip further checks for this pair

            # 2. Check DrugInteraction DB
            db_interaction = check_drug_interaction(drug1, drug2)
            if db_interaction:
                interactions.append({"drug_1": drug1, "drug_2": drug2, "interaction": db_interaction})
                continue  # Skip further checks for this pair

            # 3. Check with Gemini API
            gemini_interaction = query_gemini_for_interaction(drug1, drug2)
            if gemini_interaction:
                if "There are no known significant interactions" not in gemini_interaction:
                    interactions.append({"drug_1": drug1, "drug_2": drug2, "interaction": gemini_interaction})
                    continue  # Skip further checks for this pair

                # Save non-significant interactions
                SavedInteraction.objects.create(
                    drug_1=drug1, drug_2=drug2, interaction_description="There are no known significant interactions"
                )

    # Clear temporary data after processing
    temp_prescription.delete()

    # Return all found interactions
    if interactions:
        return Response({"interactions": interactions})

    return Response({"message": "No interactions found"})

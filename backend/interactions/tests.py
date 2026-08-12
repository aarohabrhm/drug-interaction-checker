"""Smoke tests for the interaction API's security and correctness fixes.

Deliberately narrow: this is not a full suite. It pins the specific defects
found during the production-readiness audit so they cannot silently return.
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import (
    DrugInteraction,
    InteractionLookupCache,
    PatientList,
    Prescription,
    PrescriptionItem,
    SavedInteraction,
    TemporaryPrescription,
)


class PatientAccessControlTests(APITestCase):
    """Patient records contain PHI and must never be readable anonymously."""

    def setUp(self):
        self.user = User.objects.create_user(username="drwho", password="s3cure-passphrase")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="Jane Doe",
            age=41,
            medical_condition="Hypertension",
            phone_number="5551234567",
            email="jane@example.com",
            current_medications="warfarin, metformin",
        )
        self.token = Token.objects.create(user=self.user)

    def test_patient_list_rejects_anonymous(self):
        response = self.client.get(reverse("get_patients"))
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("Jane Doe", response.content.decode())

    def test_patient_create_rejects_anonymous(self):
        response = self.client.post(reverse("add_patient"), {"name": "Mallory"}, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(PatientList.objects.count(), 1)

    def test_patient_list_is_paginated_for_authenticated_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get(reverse("get_patients"))
        self.assertEqual(response.status_code, 200)
        # Paginated envelope, not a bare unbounded array.
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        self.assertEqual(response.data["results"][0]["name"], "Jane Doe")

    def test_patient_search_filters_results(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        hit = self.client.get(reverse("get_patients"), {"search": "Jane"})
        miss = self.client.get(reverse("get_patients"), {"search": "Nonexistent"})
        self.assertEqual(hit.data["count"], 1)
        self.assertEqual(miss.data["count"], 0)

    def test_invalid_patient_payload_returns_error_envelope(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post(
            reverse("add_patient"),
            {"name": "X", "age": 900, "phone_number": "abc", "email": "nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("age", response.data["error"]["details"]["fields"])


class InteractionCheckTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="drjones", password="s3cure-passphrase")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="John Roe",
            age=60,
            medical_condition="AFib",
            phone_number="5559876543",
            email="john@example.com",
            current_medications="Warfarin, Metformin",
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.url = reverse("check_prescription_interactions")

    def test_requires_authentication(self):
        self.client.credentials()
        response = self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["aspirin"]}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_finds_interaction_from_local_dataset_case_insensitively(self):
        # Stored with different casing than either input.
        DrugInteraction.objects.create(
            drug_1="ASPIRIN", drug_2="Warfarin", interaction="Increased bleeding risk."
        )
        response = self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["Aspirin"]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["interactions"]), 1)
        self.assertEqual(
            response.data["interactions"][0]["interaction"], "Increased bleeding risk."
        )

    @patch("interactions.views.lookup_interaction_externally")
    def test_writes_audit_row_with_patient_set(self, mock_lookup):
        """Regression: the old code called SavedInteraction.objects.create()
        without `patient`, raising IntegrityError against the non-null FK."""
        mock_lookup.return_value = "Serious interaction: avoid co-administration."
        response = self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["ibuprofen"]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        saved = SavedInteraction.objects.all()
        self.assertEqual(saved.count(), 2)  # ibuprofen x {warfarin, metformin}
        for row in saved:
            self.assertEqual(row.patient_id, self.patient.id)
            self.assertEqual(row.checked_by_id, self.user.id)

    @patch("interactions.views.lookup_interaction_externally")
    def test_negative_results_are_cached_and_not_reported(self, mock_lookup):
        mock_lookup.return_value = "There are no known significant interactions."
        response = self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["vitamin c"]}, format="json"
        )
        self.assertEqual(response.data["interactions"], [])
        # Cached as a negative so the same pair is never asked again.
        self.assertEqual(InteractionLookupCache.objects.count(), 2)
        self.assertTrue(all(row.interaction is None for row in InteractionLookupCache.objects.all()))

        mock_lookup.reset_mock()
        self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["vitamin c"]}, format="json"
        )
        mock_lookup.assert_not_called()

    @patch("interactions.views.lookup_interaction_externally")
    def test_failed_lookup_is_not_cached_as_negative(self, mock_lookup):
        mock_lookup.return_value = None  # upstream unavailable
        self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["rifampin"]}, format="json"
        )
        self.assertEqual(InteractionLookupCache.objects.count(), 0)

    def test_rejects_oversized_medication_list(self):
        response = self.client.post(
            self.url,
            {"patient_id": self.patient.id, "new_medications": [f"drug{i}" for i in range(500)]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "too_many_medications")

    def test_rejects_malformed_payloads(self):
        for payload in (
            {"new_medications": ["aspirin"]},                              # no patient_id
            {"patient_id": "abc", "new_medications": ["aspirin"]},          # bad id
            {"patient_id": self.patient.id, "new_medications": "aspirin"},  # not a list
            {"patient_id": self.patient.id, "new_medications": [1, 2]},     # not strings
            {"patient_id": self.patient.id, "new_medications": []},         # empty
        ):
            response = self.client.post(self.url, payload, format="json")
            self.assertEqual(response.status_code, 400, msg=f"payload={payload}")

    def test_unknown_patient_returns_404_envelope(self):
        response = self.client.post(
            self.url, {"patient_id": 999999, "new_medications": ["aspirin"]}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"]["code"], "not_found")

    @patch("interactions.views.lookup_interaction_externally")
    def test_scratch_row_is_cleared_even_when_check_raises(self, mock_lookup):
        mock_lookup.side_effect = RuntimeError("boom")
        response = self.client.post(
            self.url, {"patient_id": self.patient.id, "new_medications": ["aspirin"]}, format="json"
        )
        # The global handler turns it into a generic 500 -- no traceback leaks.
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data["error"]["code"], "internal_error")
        self.assertNotIn("boom", response.content.decode())
        # ...and the `finally` block still cleared the scratch row.
        self.assertEqual(TemporaryPrescription.objects.count(), 0)


class DoctorScopingTests(APITestCase):
    """One doctor must never see or touch another doctor's patients."""

    def setUp(self):
        self.alice = User.objects.create_user(username="dralice", password="correct-horse-battery")
        self.bob = User.objects.create_user(username="drbob", password="correct-horse-battery")
        self.alice_patient = PatientList.objects.create(
            doctor=self.alice,
            name="Alice Patient",
            age=30,
            medical_condition="Asthma",
            phone_number="5551110000",
            email="ap@example.com",
            current_medications="salbutamol",
        )
        self.orphan = PatientList.objects.create(
            doctor=None,  # legacy row from before scoping existed
            name="Orphan Record",
            age=44,
            medical_condition="Unknown",
            phone_number="5552220000",
            email="orphan@example.com",
            current_medications="aspirin",
        )
        self.bob_token = Token.objects.create(user=self.bob)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.bob_token.key}")

    def test_list_excludes_other_doctors_patients(self):
        response = self.client.get(reverse("get_patients"))
        self.assertEqual(response.data["count"], 0)
        self.assertNotIn("Alice Patient", response.content.decode())

    def test_legacy_unowned_patients_are_invisible(self):
        response = self.client.get(reverse("get_patients"))
        self.assertNotIn("Orphan Record", response.content.decode())

    def test_detail_of_other_doctors_patient_is_404_not_403(self):
        """404 rather than 403 -- a 403 would confirm the id exists."""
        response = self.client.get(
            reverse("patient_detail", args=[self.alice_patient.id])
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_other_doctors_patient(self):
        response = self.client.patch(
            reverse("patient_detail", args=[self.alice_patient.id]),
            {"name": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.alice_patient.refresh_from_db()
        self.assertEqual(self.alice_patient.name, "Alice Patient")

    def test_cannot_check_interactions_for_other_doctors_patient(self):
        response = self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.alice_patient.id, "new_medications": ["aspirin"]},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_prescribe_for_other_doctors_patient(self):
        response = self.client.post(
            reverse("prescriptions"),
            {
                "patient": self.alice_patient.id,
                "diagnosis": "Attempted hijack",
                "items": [{"drug_name": "aspirin"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Prescription.objects.count(), 0)

    def test_created_patient_is_owned_by_requesting_doctor(self):
        response = self.client.post(
            reverse("add_patient"),
            {
                "name": "Bob Patient",
                "age": 22,
                "medical_condition": "Migraine",
                "phone_number": "5553330000",
                "email": "bp@example.com",
                "current_medications": "ibuprofen",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(PatientList.objects.get(name="Bob Patient").doctor, self.bob)

    def test_two_doctors_may_have_a_patient_with_the_same_phone(self):
        """Global uniqueness would leak that another doctor has this patient."""
        response = self.client.post(
            reverse("add_patient"),
            {
                "name": "Same Number",
                "age": 30,
                "medical_condition": "Asthma",
                "phone_number": "5551110000",  # identical to Alice's patient
                "email": "different@example.com",
                "current_medications": "salbutamol",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_same_doctor_cannot_duplicate_a_phone_number(self):
        PatientList.objects.create(
            doctor=self.bob,
            name="First",
            age=30,
            medical_condition="X",
            phone_number="5554440000",
            email="first@example.com",
            current_medications="none",
        )
        response = self.client.post(
            reverse("add_patient"),
            {
                "name": "Second",
                "age": 31,
                "medical_condition": "Y",
                "phone_number": "5554440000",
                "email": "second@example.com",
                "current_medications": "none",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone_number", response.data["error"]["details"]["fields"])


class PrescriptionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="drrx", password="correct-horse-battery")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="Rx Patient",
            age=55,
            medical_condition="AFib",
            phone_number="5556660000",
            email="rx@example.com",
            current_medications="Warfarin",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}")
        self.url = reverse("prescriptions")

    def _payload(self, **overrides):
        payload = {
            "patient": self.patient.id,
            "diagnosis": "Atrial fibrillation",
            "items": [
                {"drug_name": "Aspirin", "dosage": "75mg", "frequency": "OD", "duration": "30d"}
            ],
        }
        payload.update(overrides)
        return payload

    def test_requires_authentication(self):
        self.client.credentials()
        self.assertEqual(self.client.post(self.url, self._payload(), format="json").status_code, 401)

    def test_prescription_persists_with_items(self):
        """The core gap this phase closes: prescriptions used to vanish."""
        response = self.client.post(self.url, self._payload(), format="json")
        self.assertEqual(response.status_code, 201)
        prescription = Prescription.objects.get()
        self.assertEqual(prescription.patient, self.patient)
        self.assertEqual(prescription.prescribed_by, self.user)
        self.assertEqual(prescription.items.count(), 1)
        self.assertEqual(prescription.items.first().drug_name, "Aspirin")

    def test_warnings_are_linked_to_the_prescription(self):
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin", interaction="Increased bleeding risk."
        )
        response = self.client.post(self.url, self._payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["warnings"]), 1)

        prescription = Prescription.objects.get()
        warning = SavedInteraction.objects.get()
        self.assertEqual(warning.prescription, prescription)
        self.assertEqual(warning.patient, self.patient)

    def test_prescription_without_items_is_rejected(self):
        response = self.client.post(self.url, self._payload(items=[]), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Prescription.objects.count(), 0)

    def test_diagnosis_is_required(self):
        response = self.client.post(self.url, self._payload(diagnosis="  "), format="json")
        self.assertEqual(response.status_code, 400)

    def test_oversized_prescription_is_rejected(self):
        items = [{"drug_name": f"drug{i}"} for i in range(500)]
        response = self.client.post(self.url, self._payload(items=items), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Prescription.objects.count(), 0)

    def test_list_and_detail_round_trip(self):
        self.client.post(self.url, self._payload(), format="json")

        listing = self.client.get(self.url)
        self.assertEqual(listing.data["count"], 1)

        prescription_id = listing.data["results"][0]["id"]
        detail = self.client.get(reverse("prescription_detail", args=[prescription_id]))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["patient_name"], "Rx Patient")
        self.assertEqual(len(detail.data["items"]), 1)

    def test_list_filters_by_patient(self):
        other = PatientList.objects.create(
            doctor=self.user,
            name="Other",
            age=20,
            medical_condition="Z",
            phone_number="5557770000",
            email="other@example.com",
            current_medications="none",
        )
        self.client.post(self.url, self._payload(), format="json")
        self.client.post(self.url, self._payload(patient=other.id), format="json")

        filtered = self.client.get(self.url, {"patient": other.id})
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(filtered.data["results"][0]["patient"], other.id)

    def test_interaction_history_endpoint_reads_back_warnings(self):
        """SavedInteraction was write-only before this phase."""
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin", interaction="Increased bleeding risk."
        )
        self.client.post(self.url, self._payload(), format="json")

        history = self.client.get(
            reverse("patient_interaction_history", args=[self.patient.id])
        )
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data["count"], 1)
        self.assertEqual(history.data["results"][0]["drug_1"], "aspirin")

    def test_list_query_count_is_constant(self):
        """Nested items and warnings must not cause an N+1 on the list view."""
        for _ in range(5):
            self.client.post(self.url, self._payload(), format="json")

        # auth + count + page + prefetched items + prefetched warnings.
        # Constant regardless of how many prescriptions are listed.
        with self.assertNumQueries(5):
            response = self.client.get(self.url)
        self.assertEqual(response.data["count"], 5)


class InteractionQueryCountTests(APITestCase):
    """Pins the N+1 fix: pair resolution is a fixed number of queries."""

    def setUp(self):
        # 10 current medications x 10 new = 100 pairs.
        self.user = User.objects.create_user(username="drqc", password="correct-horse-battery")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="Query Count",
            age=50,
            medical_condition="Polypharmacy",
            phone_number="5550000001",
            email="qc@example.com",
            current_medications=",".join(f"current{i}" for i in range(10)),
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}")

    @patch("interactions.views.lookup_interaction_externally", return_value=None)
    def test_pair_resolution_does_not_scale_with_pair_count(self, _mock_lookup):
        new_meds = [f"new{i}" for i in range(10)]

        # The old nested loop issued 2 queries per pair (200) plus one external
        # call each. The two lookup queries are now independent of pair count;
        # the rest of the budget is auth, the patient fetch and scratch-row
        # bookkeeping.
        with self.assertNumQueries(11):
            response = self.client.post(
                reverse("check_prescription_interactions"),
                {"patient_id": self.patient.id, "new_medications": new_meds},
                format="json",
            )
        self.assertEqual(response.status_code, 200)


class HealthEndpointTests(APITestCase):
    def test_liveness_is_public(self):
        response = self.client.get(reverse("liveness"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")

    def test_readiness_reports_database(self):
        response = self.client.get(reverse("readiness"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["checks"]["database"], "ok")

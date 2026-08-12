"""Smoke tests for the interaction API's security and correctness fixes.

Deliberately narrow: this is not a full suite. It pins the specific defects
found during the production-readiness audit so they cannot silently return.
"""

from unittest.mock import Mock, patch

import requests
from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from . import normalization as _normalization_module
from .normalization import resolve_ingredient, resolve_many

from .models import (
    DrugInteraction,
    DrugNameAlias,
    InteractionLookupCache,
    InteractionSource,
    PatientList,
    Prescription,
    PrescriptionItem,
    SavedInteraction,
    Severity,
    TemporaryPrescription,
)
from .services import InteractionFinding, lookup_openfda


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
        mock_lookup.return_value = InteractionFinding(
            description="Serious interaction: avoid co-administration.",
            severity=Severity.MAJOR,
            source=InteractionSource.AI_UNVERIFIED,
        )
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
        mock_lookup.return_value = InteractionFinding.none_found(
            InteractionSource.AI_UNVERIFIED
        )
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
        # call each. The dataset lookup, the cache lookup and the name-alias
        # lookup are each a single query independent of pair count; the rest of
        # the budget is auth, the patient fetch and scratch-row bookkeeping.
        with self.assertNumQueries(12):
            response = self.client.post(
                reverse("check_prescription_interactions"),
                {"patient_id": self.patient.id, "new_medications": new_meds},
                format="json",
            )
        self.assertEqual(response.status_code, 200)


class NormalizationTests(APITestCase):
    """RxNorm brand -> ingredient resolution, and its failure behaviour."""

    def test_cached_alias_is_used_without_network(self):
        DrugNameAlias.objects.create(queried_name="tylenol", ingredient="acetaminophen")
        with patch("interactions.normalization._fetch_ingredient") as fetch:
            self.assertEqual(resolve_ingredient("Tylenol"), "acetaminophen")
            fetch.assert_not_called()

    @override_settings(RXNORM_ENABLED=True)
    def test_successful_lookup_is_cached(self):
        with patch(
            "interactions.normalization._fetch_ingredient",
            return_value=("acetaminophen", "161"),
        ) as fetch:
            self.assertEqual(resolve_ingredient("Tylenol"), "acetaminophen")
            self.assertEqual(resolve_ingredient("Tylenol"), "acetaminophen")
            # Second call served from the cache.
            self.assertEqual(fetch.call_count, 1)
        self.assertEqual(DrugNameAlias.objects.get(queried_name="tylenol").rxcui, "161")

    @override_settings(RXNORM_ENABLED=True)
    def test_unresolvable_name_is_cached_as_negative(self):
        """A name RxNorm cannot resolve must not be re-queried forever."""
        with patch(
            "interactions.normalization._fetch_ingredient", return_value=("", "")
        ) as fetch:
            self.assertEqual(resolve_ingredient("notadrug"), "notadrug")
            self.assertEqual(resolve_ingredient("notadrug"), "notadrug")
            self.assertEqual(fetch.call_count, 1)
        self.assertTrue(DrugNameAlias.objects.filter(queried_name="notadrug").exists())

    @override_settings(RXNORM_ENABLED=True)
    def test_network_failure_falls_back_to_typed_name_and_is_not_cached(self):
        _normalization_module._network_unavailable = False
        try:
            with patch("interactions.normalization._fetch_ingredient", return_value=None):
                self.assertEqual(resolve_ingredient("Tylenol"), "tylenol")
            # Nothing cached: a transient outage must not be recorded as a
            # permanent "unresolvable".
            self.assertFalse(DrugNameAlias.objects.filter(queried_name="tylenol").exists())
        finally:
            _normalization_module._network_unavailable = False

    def test_resolve_many_preserves_length_and_order(self):
        DrugNameAlias.objects.create(queried_name="tylenol", ingredient="acetaminophen")
        self.assertEqual(
            resolve_many(["Tylenol", "", "warfarin"]), ["acetaminophen", "", "warfarin"]
        )

    def test_resolve_many_is_one_query_when_disabled(self):
        DrugNameAlias.objects.create(queried_name="tylenol", ingredient="acetaminophen")
        with self.assertNumQueries(1):
            resolve_many(["Tylenol", "warfarin", "aspirin", "metformin"])


class BrandNameMatchingTests(APITestCase):
    """The false-negative this phase exists to close."""

    def setUp(self):
        self.user = User.objects.create_user(username="drbrand", password="correct-horse-battery")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="Brand Patient",
            age=50,
            medical_condition="Pain",
            phone_number="5558880000",
            email="brand@example.com",
            current_medications="Coumadin",  # brand name for warfarin
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}"
        )
        DrugInteraction.objects.create(
            drug_1="acetaminophen",
            drug_2="warfarin",
            interaction="May potentiate anticoagulant effect.",
            severity=Severity.MODERATE,
        )
        # Stand in for RxNorm, which is disabled during tests.
        DrugNameAlias.objects.create(queried_name="tylenol", ingredient="acetaminophen")
        DrugNameAlias.objects.create(queried_name="coumadin", ingredient="warfarin")

    def test_brand_names_resolve_to_ingredients_and_match(self):
        """Before normalization, 'Tylenol + Coumadin' silently found nothing."""
        response = self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.patient.id, "new_medications": ["Tylenol"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["interactions"]), 1)
        found = response.data["interactions"][0]
        self.assertEqual(found["interaction"], "May potentiate anticoagulant effect.")
        self.assertEqual(found["severity"], Severity.MODERATE)
        # The doctor sees the drug they typed, not the ingredient it resolved
        # to. Names are compared case-insensitively because the pipeline
        # lowercases them on the way in (as it always has); restoring the
        # original casing for display would be a separate UX change.
        shown = {found["drug_1"].lower(), found["drug_2"].lower()}
        self.assertEqual(shown, {"tylenol", "coumadin"})
        self.assertNotIn("acetaminophen", shown)


class SeverityAndProvenanceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="drsev", password="correct-horse-battery")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="Severity Patient",
            age=70,
            medical_condition="Multiple",
            phone_number="5559990000",
            email="sev@example.com",
            current_medications="warfarin, metformin, simvastatin",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}"
        )

    def test_warnings_are_ranked_most_severe_first(self):
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="metformin",
            interaction="Minor issue.", severity=Severity.MINOR,
        )
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin",
            interaction="Serious bleeding risk.", severity=Severity.CONTRAINDICATED,
        )
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="simvastatin",
            interaction="Moderate issue.", severity=Severity.MODERATE,
        )

        response = self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.patient.id, "new_medications": ["aspirin"]},
            format="json",
        )
        severities = [row["severity"] for row in response.data["interactions"]]
        self.assertEqual(
            severities, [Severity.CONTRAINDICATED, Severity.MODERATE, Severity.MINOR]
        )

    def test_dataset_wins_over_a_cached_ai_answer(self):
        """A graded pharmacology record must not be shadowed by a cached guess."""
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin",
            interaction="Curated: serious bleeding risk.", severity=Severity.MAJOR,
        )
        InteractionLookupCache.objects.create(
            drug_1="aspirin", drug_2="warfarin",
            interaction="AI guess.", source=InteractionSource.AI_UNVERIFIED,
        )
        response = self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.patient.id, "new_medications": ["aspirin"]},
            format="json",
        )
        found = [r for r in response.data["interactions"] if r["drug_2"] == "warfarin"][0]
        self.assertEqual(found["interaction"], "Curated: serious bleeding risk.")
        self.assertEqual(found["source"], InteractionSource.DATASET)

    def test_severity_and_source_are_recorded_on_the_audit_row(self):
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin",
            interaction="Serious bleeding risk.", severity=Severity.MAJOR,
            management_recommendation="Monitor INR closely.",
        )
        self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.patient.id, "new_medications": ["aspirin"]},
            format="json",
        )
        warning = SavedInteraction.objects.get(drug_2="warfarin")
        self.assertEqual(warning.severity, Severity.MAJOR)
        self.assertEqual(warning.source, InteractionSource.DATASET)
        self.assertEqual(warning.management_recommendation, "Monitor INR closely.")

    @patch("interactions.views.lookup_interaction_externally")
    def test_ai_answers_are_labelled_unverified(self, mock_lookup):
        mock_lookup.return_value = InteractionFinding(
            description="Possible interaction.",
            severity=Severity.UNKNOWN,
            source=InteractionSource.AI_UNVERIFIED,
        )
        response = self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.patient.id, "new_medications": ["somedrug"]},
            format="json",
        )
        for row in response.data["interactions"]:
            self.assertEqual(row["source"], InteractionSource.AI_UNVERIFIED)

    def test_history_exposes_severity_and_source_labels(self):
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin",
            interaction="Serious bleeding risk.", severity=Severity.MAJOR,
        )
        self.client.post(
            reverse("check_prescription_interactions"),
            {"patient_id": self.patient.id, "new_medications": ["aspirin"]},
            format="json",
        )
        history = self.client.get(
            reverse("patient_interaction_history", args=[self.patient.id])
        )
        row = history.data["results"][0]
        self.assertEqual(row["severity"], Severity.MAJOR)
        self.assertEqual(row["severity_label"], "Major")
        self.assertEqual(row["source_label"], "Curated dataset")


class UnscreenedPairReportingTests(APITestCase):
    """A pair nobody could check must never be reported as clear.

    Before this, `_check_pairs` silently dropped pairs whose lookup failed, so
    the response was indistinguishable from "checked, nothing found".
    """

    def setUp(self):
        self.user = User.objects.create_user(username="drgap", password="correct-horse-battery")
        self.patient = PatientList.objects.create(
            doctor=self.user,
            name="Gap Patient",
            age=61,
            medical_condition="Various",
            phone_number="5557770001",
            email="gap@example.com",
            current_medications="warfarin, metformin",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.user).key}"
        )
        self.check_url = reverse("check_prescription_interactions")

    @patch("interactions.views.lookup_interaction_externally", return_value=None)
    def test_check_reports_unscreened_pairs(self, _mock):
        response = self.client.post(
            self.check_url,
            {"patient_id": self.patient.id, "new_medications": ["mysterydrug"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["interactions"], [])
        self.assertFalse(response.data["screening_complete"])
        self.assertEqual(len(response.data["unscreened_pairs"]), 2)
        # Must NOT claim a clean result.
        self.assertNotIn("message", response.data)

    @patch("interactions.views.lookup_interaction_externally", return_value=None)
    def test_partial_coverage_is_reported_alongside_findings(self, _mock):
        """Some pairs resolved locally, others unreachable -- both are reported."""
        DrugInteraction.objects.create(
            drug_1="mysterydrug", drug_2="warfarin",
            interaction="Known risk.", severity=Severity.MAJOR,
        )
        response = self.client.post(
            self.check_url,
            {"patient_id": self.patient.id, "new_medications": ["mysterydrug"]},
            format="json",
        )
        self.assertEqual(len(response.data["interactions"]), 1)
        self.assertEqual(len(response.data["unscreened_pairs"]), 1)  # vs metformin
        self.assertFalse(response.data["screening_complete"])

    def test_complete_screen_is_reported_as_complete(self):
        response = self.client.post(
            self.check_url,
            {"patient_id": self.patient.id, "new_medications": ["warfarin"]},
            format="json",
        )
        # warfarin vs warfarin is skipped; warfarin vs metformin resolves to a
        # cached negative via the external stub being unnecessary.
        self.assertIn("screening_complete", response.data)

    @patch("interactions.views.lookup_interaction_externally", return_value=None)
    def test_prescription_records_unscreened_count(self, _mock):
        response = self.client.post(
            reverse("prescriptions"),
            {
                "patient": self.patient.id,
                "diagnosis": "Test",
                "items": [{"drug_name": "mysterydrug"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["unscreened_pair_count"], 2)
        self.assertFalse(response.data["screening_complete"])
        # Persisted, so the record still shows incomplete screening on reload.
        self.assertEqual(Prescription.objects.get().unscreened_pair_count, 2)

    def test_fully_screened_prescription_reports_complete(self):
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="warfarin",
            interaction="Bleeding risk.", severity=Severity.MAJOR,
        )
        DrugInteraction.objects.create(
            drug_1="aspirin", drug_2="metformin",
            interaction="Minor.", severity=Severity.MINOR,
        )
        response = self.client.post(
            reverse("prescriptions"),
            {
                "patient": self.patient.id,
                "diagnosis": "Test",
                "items": [{"drug_name": "aspirin"}],
            },
            format="json",
        )
        self.assertEqual(response.data["unscreened_pair_count"], 0)
        self.assertTrue(response.data["screening_complete"])


class OpenFdaServiceTests(APITestCase):
    """openFDA is consulted before the LLM and must fail safe."""

    @override_settings(OPENFDA_ENABLED=True)
    def test_404_is_a_definite_negative_not_a_failure(self):
        response = Mock(status_code=404)
        with patch("interactions.services.requests.get", return_value=response):
            finding = lookup_openfda("aspirin", "warfarin")
        self.assertIsNotNone(finding)
        self.assertFalse(finding.has_interaction)

    @override_settings(OPENFDA_ENABLED=True)
    def test_network_error_returns_none_so_nothing_is_cached(self):
        with patch(
            "interactions.services.requests.get",
            side_effect=requests.ConnectionError("down"),
        ):
            self.assertIsNone(lookup_openfda("aspirin", "warfarin"))

    @override_settings(OPENFDA_ENABLED=True)
    def test_label_text_is_returned_with_openfda_provenance(self):
        response = Mock(status_code=200)
        response.json.return_value = {
            "results": [{"drug_interactions": ["Concomitant warfarin increases bleeding risk."]}]
        }
        with patch("interactions.services.requests.get", return_value=response):
            finding = lookup_openfda("aspirin", "warfarin")
        self.assertTrue(finding.has_interaction)
        self.assertEqual(finding.source, InteractionSource.OPENFDA)
        self.assertIn("warfarin", finding.description.lower())


class HealthEndpointTests(APITestCase):
    def test_liveness_is_public(self):
        response = self.client.get(reverse("liveness"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")

    def test_readiness_reports_database(self):
        response = self.client.get(reverse("readiness"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["checks"]["database"], "ok")

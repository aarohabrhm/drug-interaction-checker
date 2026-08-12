from django.contrib.auth.models import User
from django.db import models
from django.db.models.functions import Lower


def normalize_drug_name(name):
    """Canonical form used for all interaction lookups: trimmed + lowercased."""
    return (name or "").strip().lower()


class Severity(models.TextChoices):
    """Clinical significance of an interaction.

    Ordered by how urgently a doctor needs to act. `UNKNOWN` is not a synonym
    for "safe" -- it means the source gave no grading, and the UI must not
    present it as an all-clear.
    """

    CONTRAINDICATED = "contraindicated", "Contraindicated"
    MAJOR = "major", "Major"
    MODERATE = "moderate", "Moderate"
    MINOR = "minor", "Minor"
    UNKNOWN = "unknown", "Unknown"


# Sort weight, highest first. Used to rank warnings so the most dangerous
# interaction is never buried below a minor one.
SEVERITY_RANK = {
    Severity.CONTRAINDICATED: 4,
    Severity.MAJOR: 3,
    Severity.MODERATE: 2,
    Severity.MINOR: 1,
    Severity.UNKNOWN: 0,
}


class InteractionSource(models.TextChoices):
    """Where an interaction statement came from.

    Provenance is surfaced to the doctor. An AI-generated answer is not
    equivalent to a curated pharmacology dataset and must never be displayed as
    though it were.
    """

    DATASET = "dataset", "Curated dataset"
    OPENFDA = "openfda", "openFDA drug label"
    AI_UNVERIFIED = "ai_unverified", "AI-generated (unverified)"


class PatientList(models.Model):
    """A patient record. Contains PHI -- every read path must be authenticated."""

    doctor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="patients",
        null=True,
        blank=True,
        help_text=(
            "Owning doctor. NULL marks a legacy row created before patients "
            "were scoped; those are visible to nobody through the API. Use "
            "`manage.py assign_patients` to adopt them."
        ),
    )
    name = models.CharField(max_length=255)
    age = models.PositiveIntegerField()
    registered_date = models.DateTimeField(auto_now_add=True)
    medical_condition = models.TextField()
    remarks = models.TextField(blank=True, null=True)
    # Not globally unique: once patients belong to a doctor, a global
    # constraint would both block two doctors from treating the same person and
    # leak that person's existence through the uniqueness error.
    phone_number = models.CharField(max_length=15)
    email = models.EmailField()
    current_medications = models.TextField()  # comma-separated

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "phone_number"], name="unique_patient_phone_per_doctor"
            ),
            models.UniqueConstraint(
                fields=["doctor", "email"], name="unique_patient_email_per_doctor"
            ),
        ]
        indexes = [
            # The patient list is scoped by doctor and sorted newest-first.
            models.Index(fields=["doctor", "-registered_date"], name="patient_doctor_time_idx"),
            models.Index(Lower("name"), name="patient_name_lower_idx"),
        ]

    def __str__(self):
        return self.name

    def medication_list(self):
        """`current_medications` split into normalized, de-duplicated names."""
        seen = []
        for raw in (self.current_medications or "").split(","):
            name = normalize_drug_name(raw)
            if name and name not in seen:
                seen.append(name)
        return seen


class DrugInteraction(models.Model):
    """Curated interaction dataset, loaded from CSV via `import_interactions`.

    Populate from DDInter 2.0 (CC BY-NC-SA 4.0), which supplies severity grading
    and management guidance alongside the interaction text.
    """

    drug_1 = models.CharField(max_length=255)
    drug_2 = models.CharField(max_length=255)
    interaction = models.TextField()
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.UNKNOWN
    )
    management_recommendation = models.TextField(
        blank=True,
        default="",
        help_text="What the prescriber should do about it, when the source says.",
    )

    class Meta:
        unique_together = ("drug_1", "drug_2")
        indexes = [
            # Lookups are case-insensitive on both columns. A plain b-tree index
            # cannot serve those, so index the lowercased expressions -- this is
            # the index that migration 0004 removed without a replacement.
            models.Index(
                Lower("drug_1"),
                Lower("drug_2"),
                name="drug_pair_lower_idx",
            ),
        ]

    def __str__(self):
        return f"{self.drug_1} & {self.drug_2} Interaction"


class InteractionLookupCache(models.Model):
    """Global cache of external (Gemini) lookup results.

    Exists so a drug pair is only ever sent to the external API once, including
    pairs that came back with *no* known interaction -- caching the negatives is
    what stops the same fruitless call repeating on every prescription.

    Stored pre-normalized (lowercased, alphabetically ordered pair) so lookups
    are exact-match and index-friendly.
    """

    drug_1 = models.CharField(max_length=255)
    drug_2 = models.CharField(max_length=255)
    # NULL means "checked, and no significant interaction is known".
    interaction = models.TextField(blank=True, null=True)
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.UNKNOWN
    )
    source = models.CharField(
        max_length=20,
        choices=InteractionSource.choices,
        default=InteractionSource.AI_UNVERIFIED,
    )
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("drug_1", "drug_2")
        verbose_name_plural = "interaction lookup cache"

    def __str__(self):
        return f"{self.drug_1} & {self.drug_2} ({self.source})"

    @property
    def has_interaction(self):
        return bool(self.interaction)


class DrugNameAlias(models.Model):
    """Maps a drug name as typed to its normalized ingredient name.

    Interaction datasets are keyed on ingredients ("acetaminophen") while
    doctors type brand names ("Tylenol"). Without this mapping the engine
    silently misses those pairs -- a false negative in a safety tool, which is
    the failure mode that matters most here.

    Resolution comes from the RxNorm API and is cached permanently: the mapping
    from a brand to its ingredient does not change, so one lookup per name ever.
    A row with `ingredient = ""` records a name RxNorm could not resolve, so a
    failed lookup is not retried on every prescription.
    """

    queried_name = models.CharField(
        max_length=255, unique=True, help_text="Normalized form of what was typed."
    )
    ingredient = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Resolved ingredient name; empty means RxNorm had no match.",
    )
    rxcui = models.CharField(max_length=32, blank=True, default="")
    resolved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "drug name aliases"

    def __str__(self):
        return f"{self.queried_name} -> {self.ingredient or '(unresolved)'}"


class Prescription(models.Model):
    """A prescription issued to a patient.

    Previously this was never stored: the form produced a PDF and the record was
    discarded when the request ended. It is the app's central artifact, so it is
    now persisted along with the interaction warnings raised at the time it was
    written -- which is what makes the warning history meaningful after the fact.
    """

    patient = models.ForeignKey(
        PatientList, on_delete=models.CASCADE, related_name="prescriptions"
    )
    prescribed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prescriptions",
        help_text="Kept as a record if the doctor's account is later deleted.",
    )
    diagnosis = models.TextField()
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    # How many drug pairs could not be screened when this was issued (all
    # sources unreachable for that pair). Recorded on the prescription itself,
    # because "this was issued with incomplete screening" is a fact about the
    # clinical record, not a transient detail of one API response.
    unscreened_pair_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["patient", "-created_at"], name="rx_patient_time_idx"),
        ]

    def __str__(self):
        return f"Prescription for {self.patient.name} on {self.created_at:%Y-%m-%d}"

    @property
    def screening_complete(self):
        """False when at least one drug pair went unscreened.

        An incomplete screen is NOT an all-clear: the pairs that failed were
        never evaluated, so nothing is known about them either way.
        """
        return self.unscreened_pair_count == 0


class PrescriptionItem(models.Model):
    """One prescribed medication line. Mirrors the frontend's medication rows."""

    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name="items"
    )
    drug_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100, blank=True, default="")
    frequency = models.CharField(max_length=100, blank=True, default="")
    duration = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        # Stable order so a prescription reads back the way it was entered.
        ordering = ["id"]

    def __str__(self):
        return f"{self.drug_name} ({self.dosage})"


class SavedInteraction(models.Model):
    """Per-patient audit record of an interaction surfaced to a doctor.

    This is a clinical audit trail, not a cache -- it is written once per
    detected interaction per check and is never used to answer later lookups
    (that is what `InteractionLookupCache` is for). Reading it across patients,
    as the previous lookup helper did, leaked one patient's data into another
    patient's result.
    """

    patient = models.ForeignKey(
        PatientList, on_delete=models.CASCADE, related_name="saved_interactions"
    )
    prescription = models.ForeignKey(
        "Prescription",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="warnings",
        help_text=(
            "Prescription that triggered this warning. NULL for standalone "
            "checks that were run without issuing a prescription."
        ),
    )
    checked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checked_interactions",
        help_text="Doctor who ran the check. Kept if the account is deleted.",
    )
    drug_1 = models.CharField(max_length=255)
    drug_2 = models.CharField(max_length=255)
    interaction_description = models.TextField()
    # Severity and source are copied onto the audit row rather than looked up
    # later: the dataset can be re-imported or the AI can change its answer, and
    # the record must reflect what the doctor was actually shown at the time.
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.UNKNOWN
    )
    source = models.CharField(
        max_length=20,
        choices=InteractionSource.choices,
        default=InteractionSource.DATASET,
    )
    management_recommendation = models.TextField(blank=True, default="")
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient", "-checked_at"], name="saved_patient_time_idx"),
        ]

    def __str__(self):
        return f"{self.drug_1} & {self.drug_2} ({self.patient.name})"


class TemporaryPrescription(models.Model):
    """Scratch row holding the medication set for an in-flight check.

    `patient` is a real foreign key now; it was a bare IntegerField, so rows
    could reference patients that did not exist and survived patient deletion.
    """

    patient = models.OneToOneField(
        PatientList, on_delete=models.CASCADE, related_name="temporary_prescription"
    )
    new_medications = models.TextField()
    current_medications = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return f"Prescription draft for patient {self.patient_id}"

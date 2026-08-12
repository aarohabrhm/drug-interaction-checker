from rest_framework import serializers

from .models import (
    SEVERITY_RANK,
    PatientList,
    Prescription,
    PrescriptionItem,
    SavedInteraction,
)


class PatientSerializer(serializers.ModelSerializer):
    """Patient read/write serializer.

    Fields are listed explicitly rather than using `__all__`: with `__all__`,
    any column added to the model later is exposed through the API and writable
    by clients without anyone revisiting this file.
    """

    class Meta:
        model = PatientList
        fields = [
            "id",
            "name",
            "age",
            "registered_date",
            "medical_condition",
            "remarks",
            "phone_number",
            "email",
            "current_medications",
        ]
        # `doctor` is deliberately absent: ownership comes from the request
        # user, never from the payload, or a client could file a patient under
        # another doctor's account.
        read_only_fields = ["id", "registered_date"]

    def validate_age(self, value):
        if value is None or not (0 <= value <= 130):
            raise serializers.ValidationError("Age must be between 0 and 130.")
        return value

    def validate_phone_number(self, value):
        cleaned = (value or "").strip()
        digits = cleaned.lstrip("+").replace(" ", "").replace("-", "")
        if not digits.isdigit() or not (7 <= len(digits) <= 15):
            raise serializers.ValidationError(
                "Enter a valid phone number (7-15 digits, optional leading '+')."
            )
        return cleaned

    def validate_name(self, value):
        cleaned = (value or "").strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        return cleaned

    def validate(self, attrs):
        """Enforce per-doctor uniqueness with a message that leaks nothing.

        The model's UniqueConstraint covers (doctor, phone_number) and
        (doctor, email), but DRF cannot check a constraint whose `doctor` half
        never appears in the payload -- so it is checked here against the
        requesting doctor only.
        """
        doctor = self.context.get("doctor")
        if doctor is None:
            return attrs

        for field in ("phone_number", "email"):
            value = attrs.get(field)
            if value is None:
                continue
            clashes = PatientList.objects.filter(doctor=doctor, **{field: value})
            if self.instance is not None:
                clashes = clashes.exclude(pk=self.instance.pk)
            if clashes.exists():
                label = "phone number" if field == "phone_number" else "email address"
                raise serializers.ValidationError(
                    {field: [f"You already have a patient with this {label}."]}
                )
        return attrs


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ["id", "drug_name", "dosage", "frequency", "duration"]
        read_only_fields = ["id"]

    def validate_drug_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Medication name is required.")
        return cleaned


class InteractionWarningSerializer(serializers.ModelSerializer):
    """Read-only view of a recorded warning.

    `severity` and `source` are exposed so the UI can rank warnings and mark
    which came from a curated dataset versus an unverified AI answer.
    """

    severity_label = serializers.CharField(source="get_severity_display", read_only=True)
    source_label = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = SavedInteraction
        fields = [
            "id",
            "drug_1",
            "drug_2",
            "interaction_description",
            "severity",
            "severity_label",
            "source",
            "source_label",
            "management_recommendation",
            "checked_at",
        ]
        read_only_fields = fields


class PrescriptionSerializer(serializers.ModelSerializer):
    """Prescription with its medication lines and the warnings it raised."""

    items = PrescriptionItemSerializer(many=True)
    warnings = serializers.SerializerMethodField()
    patient_name = serializers.CharField(source="patient.name", read_only=True)
    screening_complete = serializers.BooleanField(read_only=True)
    prescribed_by_username = serializers.CharField(
        source="prescribed_by.username", read_only=True, default=None
    )

    class Meta:
        model = Prescription
        fields = [
            "id",
            "patient",
            "patient_name",
            "prescribed_by_username",
            "diagnosis",
            "notes",
            "created_at",
            "items",
            "warnings",
            # Exposed so a client cannot read an empty `warnings` list as an
            # all-clear when screening was actually incomplete.
            "unscreened_pair_count",
            "screening_complete",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "warnings",
            "unscreened_pair_count",
            "screening_complete",
        ]

    def get_warnings(self, obj):
        """Warnings, most severe first.

        Sorted in Python over the prefetched rows rather than in SQL: severity
        is stored as a string, so a database ORDER BY would sort it
        alphabetically ("major" before "minor" before "moderate") -- which is
        not clinical order.
        """
        ordered = sorted(
            obj.warnings.all(),
            key=lambda w: (-SEVERITY_RANK.get(w.severity, 0), w.drug_1, w.drug_2),
        )
        return InteractionWarningSerializer(ordered, many=True).data

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "A prescription must contain at least one medication."
            )
        max_items = self.context.get("max_items")
        if max_items and len(value) > max_items:
            raise serializers.ValidationError(
                f"A prescription can contain at most {max_items} medications."
            )
        return value

    def validate_diagnosis(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Diagnosis is required.")
        return cleaned

    def validate_patient(self, value):
        """Reject a patient belonging to another doctor.

        Without this the FK would happily accept any patient id, letting one
        doctor write prescriptions into another doctor's records.
        """
        doctor = self.context.get("doctor")
        if doctor is not None and value.doctor_id != doctor.id:
            # Same message as a genuinely missing patient, so this cannot be
            # used to probe which patient ids exist.
            raise serializers.ValidationError("No such patient.")
        return value

    def create(self, validated_data):
        items = validated_data.pop("items")
        prescription = Prescription.objects.create(**validated_data)
        PrescriptionItem.objects.bulk_create(
            [PrescriptionItem(prescription=prescription, **item) for item in items]
        )
        return prescription

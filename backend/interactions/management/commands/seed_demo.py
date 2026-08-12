"""Populate a working demo: a doctor, patients, the demo dataset, brand aliases.

Turns a fresh clone into something you can actually log into and click through,
with patients whose medication lists deliberately collide with the demo
interaction dataset so warnings appear immediately.

    python manage.py seed_demo
    python manage.py seed_demo --password mypassword
    python manage.py seed_demo --reset      # wipe demo data and rebuild

Refuses to run with DEBUG=false unless --force is given: seeding a known account
into a production database would be handing out a login.
"""

import secrets

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from authentication.models import Doctor
from interactions.models import (
    DrugInteraction,
    DrugNameAlias,
    PatientList,
    normalize_drug_name,
)

DEMO_USERNAME = "demodoctor"

# Medication lists chosen to collide with sample_interactions.demo.csv, so the
# app has something to find the moment you open it. `Coumadin` and `Zocor` are
# brand names -- they only match via normalization, which demonstrates that
# layer working.
DEMO_PATIENTS = [
    {
        "name": "Margaret Hale",
        "age": 74,
        "medical_condition": "Atrial fibrillation, hyperlipidaemia",
        "remarks": "Lives alone; adherence generally good.",
        "phone_number": "5550100001",
        "email": "margaret.hale@example.com",
        "current_medications": "Coumadin, Zocor, metformin",
    },
    {
        "name": "Daniel Okafor",
        "age": 58,
        "medical_condition": "Depression, chronic back pain",
        "remarks": "Recently switched antidepressant.",
        "phone_number": "5550100002",
        "email": "daniel.okafor@example.com",
        "current_medications": "sertraline, omeprazole",
    },
    {
        "name": "Priya Raman",
        "age": 39,
        "medical_condition": "Rheumatoid arthritis",
        "remarks": "Methotrexate weekly, folic acid supplement.",
        "phone_number": "5550100003",
        "email": "priya.raman@example.com",
        "current_medications": "methotrexate, folic acid",
    },
    {
        "name": "Tomas Nilsson",
        "age": 66,
        "medical_condition": "Heart failure, hypertension",
        "remarks": "Renal function borderline; monitor electrolytes.",
        "phone_number": "5550100004",
        "email": "tomas.nilsson@example.com",
        "current_medications": "digoxin, furosemide, lisinopril",
    },
    {
        "name": "Grace Adeyemi",
        "age": 45,
        "medical_condition": "Bipolar disorder, hypertension",
        "remarks": "Stable on current regimen.",
        "phone_number": "5550100005",
        "email": "grace.adeyemi@example.com",
        "current_medications": "lithium, hydrochlorothiazide",
    },
]

# Brand -> ingredient mappings, pre-seeded so the demo shows brand-name matching
# even with no network (RxNorm would otherwise supply these on first use).
DEMO_ALIASES = {
    "coumadin": "warfarin",
    "zocor": "simvastatin",
    "tylenol": "acetaminophen",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "glucophage": "metformin",
    "zoloft": "sertraline",
    "prilosec": "omeprazole",
    "lanoxin": "digoxin",
    "lasix": "furosemide",
}

SAMPLE_DATASET = "interactions/data/sample_interactions.demo.csv"


class Command(BaseCommand):
    help = "Seed a demo doctor, patients, drug aliases and the demo dataset."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            help="Password for the demo account. Generated and printed if omitted.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo patients and the demo account first.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seeding even when DEBUG is false. Think first.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed demo data with DEBUG=false. This creates a "
                "known account and fake patient records. Re-run with --force if "
                "you are certain this is not a production database."
            )

        password = options["password"] or secrets.token_urlsafe(12)

        with transaction.atomic():
            if options["reset"]:
                self._reset()

            doctor_user = self._seed_doctor(password)
            created_patients = self._seed_patients(doctor_user)
            alias_count = self._seed_aliases()

        dataset_count = self._seed_dataset()

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"  Patients      : {created_patients} created")
        self.stdout.write(f"  Drug aliases  : {alias_count} created")
        self.stdout.write(f"  Interactions  : {dataset_count} in dataset")
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("  Log in with:"))
        self.stdout.write(f"    username: {DEMO_USERNAME}")
        self.stdout.write(f"    password: {password}")
        self.stdout.write("")
        self.stdout.write(
            "  Try prescribing 'clarithromycin' or 'aspirin' for Margaret Hale "
            "to see graded warnings."
        )
        if not options["password"]:
            self.stdout.write(
                self.style.WARNING(
                    "  This password was generated now and is not stored anywhere "
                    "else -- copy it before you lose this output."
                )
            )

    # ------------------------------------------------------------------ steps

    def _reset(self):
        deleted_patients, _ = PatientList.objects.filter(
            email__endswith="@example.com"
        ).delete()
        deleted_users, _ = User.objects.filter(username=DEMO_USERNAME).delete()
        self.stdout.write(
            self.style.WARNING(
                f"Reset: removed {deleted_patients} demo patient row(s) and "
                f"{deleted_users} demo account row(s)."
            )
        )

    def _seed_doctor(self, password):
        user, created = User.objects.get_or_create(username=DEMO_USERNAME)
        # Set the password every run so the printed credentials always work,
        # even when the account already existed.
        user.set_password(password)
        user.save()
        Doctor.objects.update_or_create(
            user=user, defaults={"specialty": "General Practice"}
        )
        self.stdout.write(
            f"Demo doctor {'created' if created else 'updated'}: {DEMO_USERNAME}"
        )
        return user

    def _seed_patients(self, doctor_user):
        created = 0
        for record in DEMO_PATIENTS:
            _, was_created = PatientList.objects.get_or_create(
                doctor=doctor_user,
                email=record["email"],
                defaults={**record, "doctor": doctor_user},
            )
            created += int(was_created)
        self.stdout.write(f"Demo patients: {created} created, {len(DEMO_PATIENTS) - created} already present")
        return created

    def _seed_aliases(self):
        existing = set(
            DrugNameAlias.objects.filter(
                queried_name__in=DEMO_ALIASES
            ).values_list("queried_name", flat=True)
        )
        to_create = [
            DrugNameAlias(queried_name=brand, ingredient=normalize_drug_name(ingredient))
            for brand, ingredient in DEMO_ALIASES.items()
            if brand not in existing
        ]
        DrugNameAlias.objects.bulk_create(to_create, ignore_conflicts=True)
        return len(to_create)

    def _seed_dataset(self):
        """Load the demo interactions if the table is empty.

        Never overwrites an existing dataset -- if someone has already imported
        DDInter, replacing it with 23 demo rows would be a destructive surprise.
        """
        if DrugInteraction.objects.exists():
            count = DrugInteraction.objects.count()
            self.stdout.write(
                f"Interaction dataset already populated ({count} rows); left untouched."
            )
            return count

        self.stdout.write("Interaction table empty; loading the demo dataset.")
        call_command("import_interactions", path=SAMPLE_DATASET)
        return DrugInteraction.objects.count()

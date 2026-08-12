"""Adopt legacy patient rows that have no owning doctor.

Patients created before per-doctor scoping have `doctor = NULL`. Those rows are
invisible through the API by design -- a record whose owner is unknown should
not be shown to an arbitrary doctor. This command assigns them deliberately.

    python manage.py assign_patients --to drsmith --dry-run
    python manage.py assign_patients --to drsmith
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from interactions.models import PatientList


class Command(BaseCommand):
    help = "Assign patients with no doctor to a named user."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            required=True,
            help="Username of the doctor who should own the unassigned patients.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )

    def handle(self, *args, **options):
        try:
            doctor = User.objects.get(username=options["to"])
        except User.DoesNotExist:
            raise CommandError(f"No user named {options['to']!r}.")

        orphans = PatientList.objects.filter(doctor__isnull=True)
        count = orphans.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No unassigned patients found."))
            return

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry run] would assign {count} patient(s) to {doctor.username}:"
                )
            )
            for patient in orphans[:20]:
                self.stdout.write(f"  - {patient.id}: {patient.name}")
            if count > 20:
                self.stdout.write(f"  ... and {count - 20} more")
            return

        updated = orphans.update(doctor=doctor)
        self.stdout.write(
            self.style.SUCCESS(f"Assigned {updated} patient(s) to {doctor.username}.")
        )

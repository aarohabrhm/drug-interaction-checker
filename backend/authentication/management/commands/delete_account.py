"""Remove doctor accounts, and everything scoped to them.

For clearing out test or abandoned accounts. Deliberately explicit: it names
what will go before it goes, and refuses to guess at a partial match, because
the patients scoped to an account go with it.

    python manage.py delete_account probe1786623617
    python manage.py delete_account alice bob --yes

Against a deployed database, `settings.py` still has to import, so the usual
production variables must be present even though none of them affect what is
written here. Django reports a missing one as `KeyError: 'delete_account'`
first -- it fails to find the command, then fails again while loading settings
to search harder -- so the real error is the second traceback, not the first:

    DJANGO_DEBUG=false \\
    DJANGO_SECRET_KEY=offline-task-key-not-used-for-serving \\
    DJANGO_ALLOWED_HOSTS=localhost \\
    DATABASE_URL='<external database url>' \\
    python manage.py delete_account <username>

`scripts/load-production-data.sh` sets these for the commands it runs.
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from interactions.models import PatientList, Prescription, SavedInteraction


class Command(BaseCommand):
    help = "Delete one or more accounts and the records scoped to them."

    def add_arguments(self, parser):
        parser.add_argument("usernames", nargs="+", help="Exact usernames.")
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt (for scripts).",
        )

    def handle(self, *args, **options):
        usernames = options["usernames"]

        users = list(User.objects.filter(username__in=usernames))
        found = {user.username for user in users}
        missing = [name for name in usernames if name not in found]

        if missing:
            # Not an error worth aborting for -- deleting something already
            # gone is the desired end state -- but say so rather than implying
            # it was removed.
            self.stdout.write(
                self.style.WARNING(f"No such account(s): {', '.join(missing)}")
            )

        if not users:
            self.stdout.write("Nothing to do.")
            return

        if any(user.is_superuser for user in users):
            raise CommandError(
                "Refusing to delete a superuser. Remove the flag in the admin "
                "first if that is really what you want."
            )

        self.stdout.write("This will delete:")
        for user in users:
            patients = PatientList.objects.filter(doctor=user)
            self.stdout.write(
                f"  {user.username}"
                f" -- {patients.count()} patient(s),"
                f" {Prescription.objects.filter(patient__doctor=user).count()} prescription(s),"
                f" {SavedInteraction.objects.filter(patient__doctor=user).count()} recorded warning(s)"
            )

        if not options["yes"]:
            reply = input("Continue? [y/N] ").strip().lower()
            if reply != "y":
                self.stdout.write("Aborted.")
                return

        deleted_names = sorted(user.username for user in users)

        with transaction.atomic():
            # `PatientList.doctor` is PROTECT, so the account cannot be removed
            # while patients reference it -- deliberately, so clinical records
            # cannot disappear as a side effect of tidying up a user. Removing
            # them is therefore an explicit step here, and it is why the counts
            # above are printed before anything is touched.
            #
            # Prescriptions, prescription items and recorded warnings are
            # CASCADE from the patient, so they go with it.
            PatientList.objects.filter(doctor__username__in=deleted_names).delete()
            User.objects.filter(username__in=deleted_names).delete()

        self.stdout.write(
            self.style.SUCCESS(f"Deleted: {', '.join(deleted_names)}")
        )

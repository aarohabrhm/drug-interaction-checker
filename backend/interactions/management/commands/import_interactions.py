"""Load the curated drug-interaction CSV into the database.

Replaces `interactions/import_interactions.py`, which ran `import_csv_to_db()`
at module import time -- so merely importing that module (a test collector, an
IDE, an accidental import) would start writing to the database. It also hardcoded
a relative path, printed one line per row, and inserted rows one at a time.

Usage:
    python manage.py import_interactions --path db_drug_interactions.csv
    python manage.py import_interactions --path data.csv --dry-run
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from interactions.models import DrugInteraction

BATCH_SIZE = 1000


class Command(BaseCommand):
    help = "Import drug interactions from a CSV file (drug_1, drug_2, interaction)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            required=True,
            help="Path to the CSV file. Expected columns: drug_1, drug_2, interaction.",
        )
        parser.add_argument(
            "--no-header",
            action="store_true",
            help="Treat the first row as data instead of a header.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report, but write nothing.",
        )

    def handle(self, *args, **options):
        path = Path(options["path"]).expanduser()
        if not path.is_file():
            raise CommandError(f"CSV file not found: {path}")

        dry_run = options["dry_run"]
        rows, skipped_malformed = self._read_rows(path, options["no_header"])

        if not rows:
            self.stdout.write(self.style.WARNING("No usable rows found; nothing to do."))
            return

        # One query to find what already exists, instead of get_or_create per row.
        existing = set(
            DrugInteraction.objects.filter(
                drug_1__in={r[0] for r in rows}
            ).values_list("drug_1", "drug_2")
        )

        to_create = [
            DrugInteraction(drug_1=d1, drug_2=d2, interaction=text)
            for d1, d2, text in rows
            if (d1, d2) not in existing
        ]

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"[dry run] would insert {len(to_create)} rows, "
                    f"skip {len(rows) - len(to_create)} duplicates, "
                    f"{skipped_malformed} malformed rows ignored."
                )
            )
            return

        with transaction.atomic():
            DrugInteraction.objects.bulk_create(
                to_create, batch_size=BATCH_SIZE, ignore_conflicts=True
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Inserted {len(to_create)} rows, "
                f"skipped {len(rows) - len(to_create)} duplicates, "
                f"{skipped_malformed} malformed rows ignored."
            )
        )

    def _read_rows(self, path, no_header):
        rows = []
        malformed = 0
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle)
            if not no_header:
                next(reader, None)
            for record in reader:
                if len(record) < 3:
                    malformed += 1
                    continue
                drug_1 = record[0].strip()
                drug_2 = record[1].strip()
                interaction = record[2].strip()
                if not drug_1 or not drug_2 or not interaction:
                    malformed += 1
                    continue
                rows.append((drug_1, drug_2, interaction))
        return rows, malformed

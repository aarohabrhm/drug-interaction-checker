"""Load a curated drug-interaction dataset into the database.

Supports two layouts, detected from the header row:

**DDInter 2.0** (recommended -- https://ddinter2.scbdd.com, CC BY-NC-SA 4.0)
    Columns include `Drug_A`, `Drug_B`, `Level` and a description/management
    column. `Level` grades the interaction (Major/Moderate/Minor), which is what
    lets the UI rank warnings by clinical significance.

**Legacy three-column CSV**
    `drug_1, drug_2, interaction` -- the shape the original project used.
    Imported with severity `unknown`.

Usage:
    python manage.py import_interactions --path ddinter_downloads_code_A.csv
    python manage.py import_interactions --path data.csv --dry-run

Replaces the old `interactions/import_interactions.py`, which executed
`import_csv_to_db()` at module import time -- so merely importing that module
started writing to the database.
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from interactions.models import DrugInteraction, Severity

BATCH_SIZE = 1000

# Column name -> canonical field, matched case-insensitively.
_DRUG_A_COLUMNS = ("drug_a", "drug_1", "drug1", "druga", "object", "precipitant")
_DRUG_B_COLUMNS = ("drug_b", "drug_2", "drug2", "drugb", "affected")
_LEVEL_COLUMNS = ("level", "severity", "significance")
_TEXT_COLUMNS = ("interaction", "description", "mechanism", "summary", "effect")
_MANAGEMENT_COLUMNS = ("management", "recommendation", "action", "advice")

# DDInter grades map onto our scale. "Unknown" is preserved as unknown rather
# than being silently downgraded to "minor" -- ungraded is not the same as mild.
_LEVEL_MAP = {
    "contraindicated": Severity.CONTRAINDICATED,
    "contraindication": Severity.CONTRAINDICATED,
    "major": Severity.MAJOR,
    "serious": Severity.MAJOR,
    "high": Severity.MAJOR,
    "moderate": Severity.MODERATE,
    "medium": Severity.MODERATE,
    "minor": Severity.MINOR,
    "low": Severity.MINOR,
    "unknown": Severity.UNKNOWN,
}


class Command(BaseCommand):
    help = "Import drug interactions from a DDInter or legacy CSV file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path", required=True, help="Path to the CSV file."
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing interactions first (full dataset refresh).",
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

        rows, skipped, layout = self._read_rows(path)
        self.stdout.write(f"Detected layout: {layout}")

        if ".demo" in path.name:
            self.stdout.write(
                self.style.WARNING(
                    "This is the DEMONSTRATION dataset: a couple of dozen pairs, "
                    "for exercising the UI only. Absence from it does NOT mean a "
                    "combination is safe. Load DDInter 2.0 for real use -- see "
                    "interactions/data/README.md."
                )
            )

        if not rows:
            self.stdout.write(self.style.WARNING("No usable rows found; nothing to do."))
            return

        by_severity = {}
        for row in rows:
            by_severity[row["severity"]] = by_severity.get(row["severity"], 0) + 1
        breakdown = ", ".join(f"{count} {name}" for name, count in sorted(by_severity.items()))

        if options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"[dry run] {len(rows)} usable rows ({breakdown}); "
                    f"{skipped} malformed rows ignored."
                )
            )
            return

        with transaction.atomic():
            if options["replace"]:
                deleted, _ = DrugInteraction.objects.all().delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing rows."))
                existing = set()
            else:
                existing = set(
                    DrugInteraction.objects.filter(
                        drug_1__in={r["drug_1"] for r in rows}
                    ).values_list("drug_1", "drug_2")
                )

            to_create = [
                DrugInteraction(
                    drug_1=row["drug_1"],
                    drug_2=row["drug_2"],
                    interaction=row["interaction"],
                    severity=row["severity"],
                    management_recommendation=row["management"],
                )
                for row in rows
                if (row["drug_1"], row["drug_2"]) not in existing
            ]

            DrugInteraction.objects.bulk_create(
                to_create, batch_size=BATCH_SIZE, ignore_conflicts=True
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Inserted {len(to_create)} rows ({breakdown}); "
                f"skipped {len(rows) - len(to_create)} duplicates; "
                f"{skipped} malformed rows ignored."
            )
        )

    # ----------------------------------------------------------------- parsing

    def _pick(self, fieldnames, candidates):
        """First header matching one of `candidates`, case-insensitively."""
        lowered = {(name or "").strip().lower(): name for name in fieldnames}
        for candidate in candidates:
            if candidate in lowered:
                return lowered[candidate]
        return None

    def _read_rows(self, path):
        rows = []
        skipped = 0

        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise CommandError("CSV file has no header row.")

            col_a = self._pick(reader.fieldnames, _DRUG_A_COLUMNS)
            col_b = self._pick(reader.fieldnames, _DRUG_B_COLUMNS)
            if not col_a or not col_b:
                raise CommandError(
                    "Could not find two drug-name columns. Expected something "
                    f"like Drug_A/Drug_B or drug_1/drug_2; got: {reader.fieldnames}"
                )

            col_level = self._pick(reader.fieldnames, _LEVEL_COLUMNS)
            col_text = self._pick(reader.fieldnames, _TEXT_COLUMNS)
            col_mgmt = self._pick(reader.fieldnames, _MANAGEMENT_COLUMNS)
            layout = "DDInter (graded)" if col_level else "legacy (ungraded)"

            for record in reader:
                drug_1 = (record.get(col_a) or "").strip()
                drug_2 = (record.get(col_b) or "").strip()
                if not drug_1 or not drug_2:
                    skipped += 1
                    continue

                severity = Severity.UNKNOWN
                if col_level:
                    severity = _LEVEL_MAP.get(
                        (record.get(col_level) or "").strip().lower(), Severity.UNKNOWN
                    )

                text = (record.get(col_text) or "").strip() if col_text else ""
                management = (record.get(col_mgmt) or "").strip() if col_mgmt else ""

                if not text:
                    # DDInter's per-pair files may carry only a grade. A graded
                    # interaction with no prose is still worth surfacing, so
                    # synthesize a minimal statement rather than dropping it.
                    if severity == Severity.UNKNOWN:
                        skipped += 1
                        continue
                    text = (
                        f"{severity.label if hasattr(severity, 'label') else severity} "
                        f"interaction reported between {drug_1} and {drug_2}."
                    )

                rows.append(
                    {
                        "drug_1": drug_1,
                        "drug_2": drug_2,
                        "interaction": text,
                        "severity": severity,
                        "management": management,
                    }
                )

        return rows, skipped, layout

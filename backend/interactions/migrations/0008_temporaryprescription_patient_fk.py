"""Replace TemporaryPrescription.patient_id (bare IntegerField) with a real FK.

The table holds only in-flight scratch rows for a prescription check that is
currently being processed -- a row's lifetime is a single request, and the view
deletes it in a `finally` block. There is therefore nothing to preserve, and no
sensible value to backfill a non-nullable FK with, so the model is dropped and
recreated rather than altered in place.

Deploy note: run this when no interaction check is mid-flight. Any scratch row
that does exist is discarded; the affected request would simply need retrying.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0007_temporaryprescription"),
    ]

    operations = [
        migrations.DeleteModel(name="TemporaryPrescription"),
        migrations.CreateModel(
            name="TemporaryPrescription",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("new_medications", models.TextField()),
                ("current_medications", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True, null=True)),
                (
                    "patient",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="temporary_prescription",
                        to="interactions.patientlist",
                    ),
                ),
            ],
        ),
    ]

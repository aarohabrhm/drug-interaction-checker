"""Drop cached lookups for drug names RxNorm could not identify.

Before this release, a name no source recognized was still sent to openFDA.
openFDA answers "no documents matched" for a drug that does not exist exactly
as it does for a real drug with a clean label, so the result was cached as a
definite "no interaction" -- a permanent false negative for a mistyped name.

The screening path no longer consults any lookup for such a name, but rows
written by the old code would otherwise sit in the cache indefinitely. This
removes them so they are re-derived under the new rules.

Only negative rows are deleted. A cached row that *found* an interaction is
evidence the name was real enough to match a label, and discarding a positive
finding is the one direction this migration must not err in.
"""

from django.db import migrations
from django.db.models import Q


def purge_unidentifiable_negatives(apps, schema_editor):
    DrugNameAlias = apps.get_model("interactions", "DrugNameAlias")
    DrugInteraction = apps.get_model("interactions", "DrugInteraction")
    InteractionLookupCache = apps.get_model("interactions", "InteractionLookupCache")

    # Names RxNorm positively rejected: it answered, and matched nothing at all.
    # An empty ingredient *with* an RxCUI means "this name is already an
    # ingredient", which is a successful resolution, not a rejection.
    unresolved = set(
        DrugNameAlias.objects.filter(ingredient="", rxcui="").values_list(
            "queried_name", flat=True
        )
    )
    if not unresolved:
        return

    # The curated dataset is authoritative: a name it grades is a real drug
    # regardless of what RxNorm made of the spelling.
    for drug_1, drug_2 in DrugInteraction.objects.values_list("drug_1", "drug_2"):
        unresolved.discard((drug_1 or "").strip().lower())
        unresolved.discard((drug_2 or "").strip().lower())

    if not unresolved:
        return

    # `interaction__isnull=True` is how this table records "checked, found
    # nothing" -- see the write in views._check_pairs.
    InteractionLookupCache.objects.filter(interaction__isnull=True).filter(
        Q(drug_1__in=unresolved) | Q(drug_2__in=unresolved)
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0012_prescription_unscreened_pair_count"),
    ]

    operations = [
        # Reverse is a no-op: the rows were wrong, and re-creating them on a
        # rollback would restore the false negatives this removes.
        migrations.RunPython(
            purge_unidentifiable_negatives, migrations.RunPython.noop
        ),
    ]

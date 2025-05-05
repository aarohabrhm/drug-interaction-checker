from interactions.models import DrugInteraction  # Ensure you import your model

def import_csv_to_db():
    import csv

    with open("db_drug_interactions.csv", newline="") as csvfile:
        reader = csv.reader(csvfile)
        next(reader)  # Skip the header row if it exists

        for row in reader:
            drug_1, drug_2, interaction = row

            # Use get_or_create to avoid duplicates
            obj, created = DrugInteraction.objects.get_or_create(
                drug_1=drug_1, drug_2=drug_2,
                defaults={"interaction": interaction}
            )

            if created:
                print(f"Inserted row: {row}")
            else:
                print(f"Skipped duplicate: {row}")

import_csv_to_db()

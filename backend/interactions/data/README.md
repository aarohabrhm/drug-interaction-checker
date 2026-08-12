# Interaction datasets

## `sample_interactions.demo.csv` — DEMONSTRATION ONLY

**This file is not a clinical dataset. Do not use it to make prescribing
decisions, and do not ship it to real users.**

It contains a couple of dozen widely-documented interaction pairs, included for
one reason: so the app has something to find out of the box, and so the severity
ranking, provenance badges and the interaction UI can be exercised without
anyone first having to download and register for a real dataset.

Its limitations are total and deliberate:

- It covers a handful of drugs out of thousands. **Absence from this file means
  nothing has been checked — it does not mean a combination is safe.**
- Severity grades are indicative, not a validated clinical grading.
- It carries no mechanism detail, no dose dependence, no patient context.

## Real data: DDInter 2.0

For anything beyond a demo, load DDInter 2.0:

- Site: <https://ddinter2.scbdd.com>
- Paper: *Nucleic Acids Research* (2025) — <https://academic.oup.com/nar/article/53/D1/D1356/7740584>
- Scale: ~2,310 drugs, ~302,516 interaction records, 8,398 mechanism descriptions
- Licence: **CC BY-NC-SA 4.0** — free for non-commercial and academic use, with
  attribution and share-alike. A commercial deployment needs a different source.

Download the CSV and import it:

```bash
python manage.py import_interactions --path ddinter_downloads_code_A.csv --replace
```

The importer detects DDInter's columns (`Drug_A`, `Drug_B`, `Level`, …)
automatically and maps `Level` onto the app's severity scale.

## Why the old NLM interaction API is not used

The NIH/NLM RxNav **Drug Interaction API was discontinued in January 2024**, and
DrugBank retired its free interaction checker in March 2026. Tutorials still
reference both. What remains free and live is RxNorm (name normalization, used
by `interactions/normalization.py`) and openFDA (label text, used as a fallback
evidence source in `interactions/services.py`).

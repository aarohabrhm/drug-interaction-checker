# SafeMeds

**A drug-to-drug interaction checker for prescribers.**

SafeMeds screens newly prescribed medicines against a patient's current
medications and reports the interactions it finds, graded by clinical severity
and labelled with where each answer came from.

[![CI](https://github.com/aarohabrhm/drug-interaction-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/aarohabrhm/drug-interaction-checker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Not a certified clinical tool.** SafeMeds is a demonstration project. It is
> not a substitute for a pharmacist, a clinical decision support system, or a
> maintained commercial interaction database.

**Built with** Django 5.2 · Django REST Framework · PostgreSQL · React 18 ·
Vite · TypeScript · Tailwind CSS

---

## Contents

- [Features](#features)
- [How screening works](#how-screening-works)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Interaction data](#interaction-data)
- [API](#api)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Severity-graded warnings** — contraindicated, major, moderate, minor. The
  most dangerous interaction is always shown first.
- **Brand-name resolution** — a prescription written as *Coumadin* matches a
  dataset keyed on *warfarin*, via RxNorm.
- **Explicit provenance** — every warning states its source. An AI-generated
  answer is never presented as though it came from curated pharmacology data.
- **Honest gaps** — when a pair cannot be checked, it is reported as unchecked
  rather than omitted. An empty result never silently means "safe".
- **Per-doctor patient scoping** — patients are visible only to the account
  that created them.
- **Prescription records** — issuing a prescription stores it with the warnings
  raised at the time, so the clinical record reflects what the prescriber saw.
- **Token auth with expiry**, rate limiting, and a generated OpenAPI schema.

## How screening works

Each new medicine is paired with each of the patient's current medicines, and
every pair is resolved through three layers in descending order of trust:

| Layer | Source | Grading |
| ----- | ------ | ------- |
| 1 | **Curated dataset** — the local interaction table | Severity-graded |
| 2 | **openFDA drug labels** — FDA prescribing information | Ungraded free text |
| 3 | **Gemini** *(optional, off by default)* | Ungraded, always flagged unverified |

Drug names are normalized to their active ingredient through the **RxNorm** API
before matching, because interaction datasets are keyed on ingredients while
prescribers type brand names. Resolutions are cached permanently, so each
distinct name costs at most one lookup and the app keeps working offline once
warm.

Results carry `screening_complete` and `unscreened_pairs`. A pair whose sources
were all unreachable — or one naming a drug no source recognises — is reported
as unscreened:

```json
{
  "interactions": [],
  "unscreened_pairs": [{ "drug_1": "methotrexate", "drug_2": "warfarrinn" }],
  "screening_complete": false
}
```

An empty `interactions` list is therefore not an all-clear on its own. Clients
must check `screening_complete`, and the interface renders "checked and clear",
"found something" and "could not check" as three visibly different states.

> The NLM RxNav interaction API was discontinued in January 2024, and DrugBank
> retired its free checker in March 2026. RxNorm and openFDA remain free.

## Quickstart

**Requirements:** Python 3.11+, Node.js 20+. PostgreSQL is used in production;
local development falls back to SQLite automatically.

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export DJANGO_SECRET_KEY=dev-only-key      # Windows: set DJANGO_SECRET_KEY=...
export DJANGO_DEBUG=true

python manage.py migrate
python manage.py seed_demo                 # demo account, patients, dataset
python manage.py runserver
```

```bash
# Frontend, in a second terminal
cd project
npm install
npm run dev                                # http://localhost:5173
```

`seed_demo` prints the credentials it created. Sign in, open **Margaret Hale**
and prescribe `clarithromycin`: you should see a *Contraindicated* warning
against her statin, and a *Major* one for `aspirin` against her anticoagulant.
Her medications are recorded under brand names, so this also exercises the
name-normalization layer.

```bash
python manage.py seed_demo --password mypassword   # choose the password
python manage.py seed_demo --reset                 # rebuild demo data
```

### With Docker

```bash
cp backend/.env.example backend/.env    # fill it in
export POSTGRES_PASSWORD=<pick one>
docker compose up --build
```

Migrations run automatically when the container starts.

## Configuration

All configuration comes from the environment. `backend/.env.example` documents
every variable; these are the ones required in production:

```env
DJANGO_SECRET_KEY=<generate one, see below>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=safemeds.example.com
DATABASE_URL=postgres://user:password@host:5432/drug_checker
CORS_ALLOWED_ORIGINS=https://safemeds.example.com
```

With `DJANGO_DEBUG=false` the app refuses to start unless each of these is set,
failing immediately and naming the missing variable rather than falling back to
an insecure default.

```bash
# Generate a secret key
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

Notable optional settings:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GEMINI_API_KEY` | *unset* | Enables the AI fallback layer. Without it the app uses the dataset and openFDA only. |
| `REDIS_URL` | *unset* | Shared cache for rate-limit counters. Falls back to a database cache table. |
| `AUTH_TOKEN_TTL_HOURS` | `12` | Token lifetime. Tokens rotate on every login. |
| `RXNORM_ENABLED` | `true` | Brand-name normalization. |
| `MAX_NEW_MEDICATIONS` | `25` | Caps how many pairs one request can fan out to. |

The frontend needs `VITE_API_BASE_URL` at **build** time — it is inlined into
the bundle, so changing it requires a rebuild:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

## Interaction data

A small demonstration dataset ships with the repository so the app finds
something out of the box:

```bash
python manage.py import_interactions --path interactions/data/sample_interactions.demo.csv
```

> It covers roughly two dozen pairs. **Absence from it means nothing has been
> checked — not that a combination is safe.**

### Loading a full dataset

```bash
python manage.py import_interactions --path <file>.csv --dry-run   # preview
python manage.py import_interactions --path <file>.csv             # merge
python manage.py import_interactions --path <file>.csv --replace    # replace all
```

Column names are detected case-insensitively. Recognised layouts:

| Layout | Columns |
| ------ | ------- |
| DDInter | `Drug_A`, `Drug_B`, `Level`, `Description`, `Management` |
| DrugBank exports | `Drug 1`, `Drug 2`, `Interaction Description` |
| Legacy | `drug_1`, `drug_2`, `interaction` |

**Grading is never lost to a bulk import.** Large datasets are often ungraded
and frequently restate pairs a curated file already grades, sometimes with the
two drugs in the opposite order. The importer compares pairs order-independently
and keeps the more specific grading, reporting what it kept:

```
Inserted 191116 rows (191541 unknown); skipped 406 duplicates
Kept the existing grading for 19 pair(s) where this file was less specific
```

A better grading still replaces a weaker one, so importing a graded dataset over
an ungraded one upgrades it. The same rule applies at lookup time.

Suitable public datasets include **DDInter 2.0** (~302k graded interactions) and
DrugBank-derived exports (~191k ungraded).

> **Licensing.** DDInter and DrugBank-derived datasets are CC BY-NC with
> redistribution restrictions. Do not commit them to a public repository — keep
> the file local and import it. `backend/db_drug_interactions.csv` is gitignored
> for this reason.

## API

All endpoints except the health probes require `Authorization: Token <token>`.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/auth/signup/` | Create an account |
| POST | `/auth/login/` | Exchange credentials for a token |
| POST | `/auth/logout/` | Invalidate the current token |
| GET | `/auth/user/` | Current user's profile |
| GET | `/api/patients/` | Paginated patient list (`?search=`) |
| POST | `/api/patients/add/` | Create a patient |
| GET/PATCH | `/api/patients/<id>/` | Read or update a patient |
| GET | `/api/patients/<id>/interactions/` | Warning history for a patient |
| GET/POST | `/api/prescriptions/` | List, or issue a prescription |
| GET | `/api/prescriptions/<id>/` | Prescription with items and warnings |
| POST | `/api/prescriptions/check/` | Screen medications without prescribing |
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Readiness (verifies the database) |

Issuing a prescription saves it and screens it in one call, returning the stored
record with any warnings attached.

Patients are scoped to the account that created them. Another account's patient
returns `404` rather than `403`, since a `403` would confirm the record exists.

Errors share one shape:

```json
{ "error": { "code": "validation_error", "message": "…", "details": { "fields": {} } } }
```

### Interactive documentation

The OpenAPI 3 schema is generated from the code, so it cannot drift from the
implementation.

| Path | What |
| ---- | ---- |
| `/api/schema/` | Machine-readable OpenAPI document |
| `/api/docs/` | Swagger UI *(development only)* |
| `/api/redoc/` | ReDoc *(development only)* |

The interactive pages enumerate the whole API surface with try-it-out forms, so
they are not served in production. Their assets are vendored locally — the docs
page loads nothing from a third-party CDN.

## Testing

```bash
cd backend && python manage.py test      # 90 tests

cd project
npm test                                 # 31 tests
npm run test:watch
npm run test:coverage
```

Backend tests cover authentication, patient scoping, prescriptions, interaction
resolution, name normalization and provenance. External services are disabled
automatically under `manage.py test` and covered with mocks instead, so the
suite never depends on a third-party API being reachable.

Frontend tests use Vitest and React Testing Library, concentrating on the
safety-critical rendering: "checked and clear", "found something" and "could not
check" must never be presented as one another.

CI runs on every push and pull request — backend against real PostgreSQL,
frontend lint/test/build, plus an advisory dependency audit.

## Deployment

A [Render](https://render.com) blueprint is included. In the dashboard choose
**New +** → **Blueprint** and point it at the repository; `render.yaml` creates
the database, the API and the static frontend.

The two services need each other's URL, and both are wired from the hostnames
Render assigns — including any suffix it adds when a service name is already
taken — so there is nothing to fill in. The secret key is generated and the
database password is issued by the platform.

The only prompt is `GEMINI_API_KEY`, which is optional: leave it blank and
interactions resolve from the curated dataset and openFDA.

Then seed an account from the API service's shell:

```bash
python manage.py seed_demo --password <choose one>
```

The Docker images are platform-agnostic — migrations and cache-table creation
run in the container entrypoint, so the same image works on Fly, Railway,
Kubernetes or plain `docker compose`.

Serve over HTTPS. With `DJANGO_DEBUG=false` the app enables HSTS, secure cookies
and an SSL redirect, and trusts `X-Forwarded-Proto` from the proxy in front of
it.

## Project structure

```
backend/               Django project
  backend/             settings, URLs, health probes, error handling
  authentication/      signup, login, expiring token auth
  interactions/        patients, prescriptions, screening, external sources
project/               React + Vite single-page app
  src/pages/           route components
  src/components/      shared UI
  utils/api.ts         API client
render.yaml            Render blueprint
docker-compose.yml     local full stack
```

## Contributing

Issues and pull requests are welcome.

```bash
cd backend && python manage.py test
cd project && npm run lint && npm test
```

Both suites and the linter should pass before opening a pull request. CI runs
the same checks, plus `makemigrations --check` and OpenAPI schema validation, so
a model change without a migration or an endpoint without annotation will fail
the build.

When changing screening behaviour, please add a test. The distinction between
"no interaction found" and "could not check" is the property this project cares
about most, and it is easy to erode by accident.

## License

[MIT](LICENSE).

Interaction datasets are licensed separately by their respective providers and
are not distributed with this repository.

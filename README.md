# SafeMeds — Drug-to-Drug Interaction Checker

A web app for doctors to screen newly prescribed medicines against a patient's
current medications. Interactions are resolved from a local dataset first, then
from a cached external lookup (Google Gemini) for pairs the dataset does not
cover.

> **Status: deployable, with one thing you must do first.** The credentials in
> this repository's git history still need rotating — everything else on the
> old blocking list is closed. See [Before you deploy](#before-you-deploy)
> and [Deploying to Render](#deploying-to-render).

## Tech stack

| Layer    | Actual stack                                                     |
| -------- | ---------------------------------------------------------------- |
| Backend  | Django 5.1 + Django REST Framework, PostgreSQL                    |
| Frontend | **React 18 + Vite** + TypeScript + Tailwind CSS (not Next.js)     |
| Auth     | DRF token auth with a server-enforced expiry                      |
| External | Google Gemini, for pairs missing from the local dataset           |

The frontend lives in `project/` and is a Vite single-page app. Earlier revisions
of this README described a Next.js app in a `frontend/` folder; neither has ever
existed here.

## Layout

```
backend/            Django project
  backend/          settings, urls, health probes, error handling
  authentication/   doctor signup/login/logout, expiring token auth
  interactions/     patients, interaction checking, Gemini service
  requirements.txt
project/            Vite + React SPA
  src/pages/        route components
  utils/api.ts      API client (auth header, error normalization)
docker-compose.yml  local full stack
```

## Prerequisites

- Python 3.11+
- Node.js 20+ (developed against 22)
- PostgreSQL 14+ — **only for production**. Local development falls back to
  SQLite automatically.

## Quickstart

No database to install, no API keys, no accounts to register:

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export DJANGO_SECRET_KEY=dev-only-key      # Windows: set DJANGO_SECRET_KEY=...
export DJANGO_DEBUG=true

python manage.py migrate
python manage.py seed_demo                 # demo doctor, patients, dataset
python manage.py runserver
```

```bash
# Frontend, in a second terminal
cd project
npm install
npm run dev                                # http://localhost:5173
```

`seed_demo` prints the login it created. Sign in, open **Margaret Hale**, and
prescribe `clarithromycin` — you should get a *Contraindicated* warning against
her statin, and a *Major* one for `aspirin` against her anticoagulant. Her
medications are recorded under brand names (*Coumadin*, *Zocor*), so this also
exercises the name-normalization layer.

Useful variations:

```bash
python manage.py seed_demo --password mypassword   # choose the password
python manage.py seed_demo --reset                 # wipe demo data and rebuild
```

## Configuration

With `DJANGO_DEBUG=true` and no `DATABASE_URL`, the app uses a local SQLite file
at `backend/db.sqlite3` and says so on startup. **With `DJANGO_DEBUG=false` it
refuses to start** unless the required variables are set — it fails immediately
naming the missing variable, rather than silently writing patient data to a
throwaway file.

Required in production:

```env
DJANGO_SECRET_KEY=<generate one, see below>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=safemeds.example.com
DATABASE_URL=postgres://user:password@host:5432/drug_checker
CORS_ALLOWED_ORIGINS=https://safemeds.example.com
```

Generate a secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

`GEMINI_API_KEY` is optional; without it the app uses the local dataset and
openFDA only, logs a warning, and does not crash. See `backend/.env.example`
for the full list.

### 2. Frontend

```bash
cd project
npm install
npm run dev          # http://localhost:5173
```

For a production build, `VITE_API_BASE_URL` is **required** — the build fails
without it, because the value is inlined into the bundle and would otherwise
silently point at `localhost:8000`:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

### 3. Or run everything with Docker

```bash
cp backend/.env.example backend/.env    # fill it in
export POSTGRES_PASSWORD=<pick one>
docker compose up --build
```

## Interaction data

Interactions resolve through three layers, in descending order of trust. Every
result records which layer answered, and that provenance is shown to the doctor.

| Layer | Source | Notes |
| ----- | ------ | ----- |
| 1 | **Curated dataset** | Local table. Graded by severity. The only authoritative source. |
| 2 | **openFDA drug labels** | FDA prescribing information. Free, no key. Ungraded free text. |
| 3 | **Gemini (optional)** | Off unless a key is set. Always labelled *AI · unverified*. |

Drug names are normalized through the **RxNorm** API first, so a prescription
written as *Coumadin* matches a dataset keyed on *warfarin*. Without that step
brand names silently fail to match — a false negative, which in a safety tool is
worse than an error. Resolutions are cached permanently in `DrugNameAlias`, so
each distinct name costs at most one lookup ever, and the app still works
offline once warm.

### Loading a dataset

A small **demonstration** dataset ships with the repo so the app has something to
find out of the box:

```bash
python manage.py import_interactions --path interactions/data/sample_interactions.demo.csv
```

> It covers ~23 pairs. **Absence from it means nothing has been checked, not that
> a combination is safe.** See `interactions/data/README.md`.

For real use, load **DDInter 2.0** (~302k interactions, severity-graded,
CC BY-NC-SA 4.0 — non-commercial):

```bash
python manage.py import_interactions --path ddinter_downloads_code_A.csv --replace
python manage.py import_interactions --path data.csv --dry-run   # preview
```

The importer auto-detects DDInter's columns (`Drug_A`, `Drug_B`, `Level`, …) and
the legacy `drug_1,drug_2,interaction` layout.

**The NLM RxNav Drug Interaction API is not used: NIH discontinued it in January
2024**, and DrugBank retired its free checker in March 2026. RxNorm
(normalization) and openFDA (labels) remain free and live.

## API

All endpoints except the health probes require `Authorization: Token <token>`.

| Method     | Path                                  | Purpose                                 |
| ---------- | ------------------------------------- | --------------------------------------- |
| POST       | `/auth/signup/`                       | Create a doctor account                 |
| POST       | `/auth/login/`                        | Exchange credentials for a token        |
| POST       | `/auth/logout/`                       | Invalidate the current token            |
| GET        | `/auth/user/`                         | Current doctor's profile                |
| GET        | `/api/patients/`                      | Paginated patient list (`?search=`)     |
| POST       | `/api/patients/add/`                  | Create a patient                        |
| GET/PATCH  | `/api/patients/<id>/`                 | Read or update a patient                |
| GET        | `/api/patients/<id>/interactions/`    | Warning history for a patient           |
| GET/POST   | `/api/prescriptions/`                 | List, or issue a prescription           |
| GET        | `/api/prescriptions/<id>/`            | Prescription with items and warnings    |
| POST       | `/api/prescriptions/check/`           | Screen medications without prescribing  |
| GET        | `/healthz`                            | Liveness (no dependency checks)         |
| GET        | `/readyz`                             | Readiness (verifies the database)       |

**Patients are scoped to the doctor who created them.** Another doctor's patient
returns `404`, not `403` — a `403` would confirm the record exists. Patient rows
created before scoping have no owner and are visible to nobody; adopt them with
`python manage.py assign_patients --to <username>`.

Issuing a prescription (`POST /api/prescriptions/`) saves it and screens it for
interactions in one call, returning the stored prescription with any warnings
attached.

Errors share one shape:

```json
{ "error": { "code": "validation_error", "message": "…", "details": { "fields": {} } } }
```

### Incomplete screening

Interaction responses always carry `screening_complete` and `unscreened_pairs`.
A pair whose sources were all unreachable is reported as **unscreened**, never
omitted:

```json
{
  "interactions": [],
  "unscreened_pairs": [{ "drug_1": "warfarin", "drug_2": "someunknowndrug" }],
  "screening_complete": false
}
```

An empty `interactions` list therefore does **not** mean "clear" on its own —
check `screening_complete` first. Prescriptions persist the same fact in
`unscreened_pair_count`, so the clinical record shows when a prescription was
issued without full screening. Treating "we could not check" as "nothing found"
is the most dangerous mistake this app could make, so it is surfaced everywhere:
API, prescribing screen, and history.

#### Unrecognized drug names

A name no source can identify as a drug is reported as **unscreened**, never as
clear. This closes a false negative that used to be reachable with a typo:

```bash
# 'warfarrinn' is a misspelling. Previously: {"message": "No interactions found"}
{"interactions": [],
 "unscreened_pairs": [{"drug_1": "methotrexate", "drug_2": "warfarrinn"}],
 "screening_complete": false}
```

openFDA answers "no documents matched" for a drug that does not exist in exactly
the same way it does for a real drug with a clean label, so a mistyped name used
to produce a confident green all-clear. Identifiability is now decided *before*
any lookup runs — including the local cache, since rows written by the older
code could otherwise hand the stale negative straight back. A name the curated
dataset grades is always treated as real, whatever RxNorm makes of the spelling,
and a name that simply could not be looked up (RxNorm unreachable) is never
mistaken for one that was positively rejected.

Tokens expire after `AUTH_TOKEN_TTL_HOURS` (default 12) and are rotated on every
login.

## API documentation

The OpenAPI 3 schema is generated from the code, so it cannot drift from the
implementation:

| Path           | What                                              |
| -------------- | ------------------------------------------------- |
| `/api/schema/` | Machine-readable OpenAPI document (all environments) |
| `/api/docs/`   | Swagger UI — **DEBUG only**                        |
| `/api/redoc/`  | ReDoc — **DEBUG only**                             |

The interactive UIs enumerate the whole API surface with try-it-out forms, so
they are not exposed outside development. UI assets are vendored locally
(`drf-spectacular-sidecar`) — the docs page loads no third-party CDN.

CI regenerates the schema with `--fail-on-warn`, so an endpoint added without
annotation breaks the build rather than silently degrading the docs.

## Tests

```bash
cd backend && python manage.py test          # 85 tests

cd project && npm test                       # 31 tests
npm run test:watch                           # watch mode
npm run test:coverage                        # coverage report
```

Backend tests cover auth, patient scoping, prescriptions, interaction
resolution, normalization and provenance. External sources (RxNorm, openFDA,
Gemini) are **disabled automatically under `manage.py test`** — a unit test that
silently depends on a third-party API being reachable is slow, flaky, and fails
on a plane. They are covered with mocks instead.

Frontend tests use Vitest + React Testing Library and concentrate on the
safety-critical rendering: that "checked and clear", "found something" and
"could not check" can never be presented as one another.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **Backend** — against real Postgres (not the SQLite dev fallback), with
  `makemigrations --check`, `check --deploy --fail-level WARNING`, the test
  suite, and OpenAPI schema validation.
- **Frontend** — `npm ci`, lint, tests, production build.
- **Dependency audit** — `pip-audit` and `npm audit`, advisory only
  (`continue-on-error`) so a newly published CVE does not turn an unrelated PR
  red. Read the output; do not ignore it.

## Before you deploy

**One blocking item remains:**

1. **Rotate the leaked credentials.** The Django `SECRET_KEY` and the Postgres
   password `sql@123` are present in every commit of this repository's history.
   Removing them from the working tree does not remove them from history.
   Rotate both, and purge history (or make the repo private) if it was ever
   public. `render.yaml` generates a fresh `SECRET_KEY` for you, so the leaked
   one is never reused — but treat the old values as burned regardless.

Handled automatically, previously manual:

- **Migrations** run in the container entrypoint (`backend/docker-entrypoint.sh`),
  so a fresh deploy no longer boots against an empty database.
- **The throttle cache** uses Redis when `REDIS_URL` is set, and a shared
  Postgres cache table otherwise. The per-process in-memory backend — under
  which N gunicorn workers meant N× the configured login rate limit — is now
  reachable only with `DJANGO_DEBUG=true`.
- **Health probes** are exempt from the SSL redirect, so container and platform
  checks reach the app instead of passing vacuously on a 301.

Still your responsibility:

2. **Set every required environment variable** in your platform's secret store
   (`backend/.env.example` is the full list).
3. **Serve over HTTPS.** `DJANGO_DEBUG=false` turns on HSTS, secure cookies and
   the SSL redirect; the app assumes TLS terminates in front of it and trusts
   `X-Forwarded-Proto`.
4. **Restrict `CORS_ALLOWED_ORIGINS`** to your real frontend origin. A `*` value
   is rejected at startup.
5. Review the remaining dependency advisories — `npm audit` in `project/`
   reports 4 (1 high, 3 moderate), all requiring major version bumps. The high
   one is a Vite **dev-server** path traversal: it is not present in the
   production bundle, but fixing it means moving to Vite 8. The react-router
   advisories need react-router-dom 7.x; `npm audit fix` alone will not take
   them, because the fixed range is outside the current major.

## Deploying to Render

`render.yaml` is a Blueprint covering the database, the Dockerized API and the
static frontend. In the Render dashboard: **New +** → **Blueprint** → point it
at this repository.

Two values cannot be wired automatically, because each service needs the
other's full URL and Render's `fromService` exposes only a bare hostname. Render
prompts for both on the first deploy:

| Service        | Variable               | Value                              |
| -------------- | ---------------------- | ---------------------------------- |
| `safemeds-api` | `CORS_ALLOWED_ORIGINS` | `https://safemeds-web.onrender.com` |
| `safemeds-api` | `DJANGO_CSRF_TRUSTED_ORIGINS` | same as above               |
| `safemeds-web` | `VITE_API_BASE_URL`    | `https://safemeds-api.onrender.com` |

Render appends a suffix when a service name is already taken globally, so copy
the real URLs from the dashboard rather than assuming those names.

`VITE_API_BASE_URL` is inlined into the bundle at **build** time, so changing it
requires a rebuild, not just a restart.

After the first deploy, seed a demo account to make the app explorable:

```bash
python manage.py seed_demo --password <choose one>
```

On Render's free tier the API sleeps after inactivity, so the first request
after an idle period takes a few seconds to wake it.

## Handling patient data

This app stores names, contact details, medical conditions and medication lists.
Every endpoint that touches those is authenticated, but authentication alone is
not a compliance posture. Before real patient data goes near this: encryption at
rest, backup policy, access logging and retention rules are all still to be
decided.

## License

MIT — see [LICENSE](LICENSE).

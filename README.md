# SafeMeds — Drug-to-Drug Interaction Checker

A web app for doctors to screen newly prescribed medicines against a patient's
current medications. Interactions are resolved from a local dataset first, then
from a cached external lookup (Google Gemini) for pairs the dataset does not
cover.

> **Status: not production-ready.** Credentials that were committed to this
> repository's git history still need rotating, and several items remain open.
> See [Before you deploy](#before-you-deploy).

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
- PostgreSQL 14+

## Running locally

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then edit it — see below
python manage.py migrate
python manage.py createsuperuser # optional, for /admin
python manage.py runserver
```

The app **will not start** until the required variables in `.env` are set. That
is deliberate — it fails immediately with a named variable instead of
misbehaving later. At minimum you need:

```env
DJANGO_SECRET_KEY=<generate one, see below>
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://user:password@localhost:5432/drug_checker
```

Generate a secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

`GEMINI_API_KEY` is optional. Without it the API answers from the local dataset
only and logs a warning; it does not crash.

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

## Loading the interaction dataset

The curated CSV (`drug_1,drug_2,interaction`) is imported with a management
command:

```bash
python manage.py import_interactions --path db_drug_interactions.csv
python manage.py import_interactions --path data.csv --dry-run   # preview
```

The CSV itself is gitignored and is not distributed with this repo.

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

Tokens expire after `AUTH_TOKEN_TTL_HOURS` (default 12) and are rotated on every
login.

## Tests

```bash
cd backend
python manage.py test
```

These cover the auth and interaction-checking paths only. There are **no
frontend tests**.

## Before you deploy

Blocking items, in order:

1. **Rotate the leaked credentials.** The Django `SECRET_KEY` and the Postgres
   password `sql@123` are present in every commit of this repository's history.
   Removing them from the working tree does not remove them from history.
   Rotate both, and purge history (or make the repo private) if it was ever
   public.
2. **Set every required environment variable** in your platform's secret store
   (`backend/.env.example` is the full list).
3. **Serve over HTTPS.** `DJANGO_DEBUG=false` turns on HSTS, secure cookies and
   the SSL redirect; the app assumes TLS terminates in front of it and trusts
   `X-Forwarded-Proto`.
4. **Restrict `CORS_ALLOWED_ORIGINS`** to your real frontend origin. A `*` value
   is rejected at startup.
5. Review the remaining dependency advisories — `npm audit` in `project/`
   currently reports 4, all requiring major version bumps.

## Handling patient data

This app stores names, contact details, medical conditions and medication lists.
Every endpoint that touches those is authenticated, but authentication alone is
not a compliance posture. Before real patient data goes near this: encryption at
rest, backup policy, access logging and retention rules are all still to be
decided.

## License

MIT — see [LICENSE](LICENSE).

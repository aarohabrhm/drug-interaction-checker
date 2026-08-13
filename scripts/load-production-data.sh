#!/usr/bin/env bash
#
# Load data into a deployed SafeMeds database from your own machine.
#
# Why this exists: the interaction dataset cannot ship inside the image (its
# licence forbids redistribution), and a free hosting tier usually has no shell
# to run management commands in. Connecting directly is the remaining way to get
# real data into a deployment.
#
# Usage:
#
#   export DATABASE_URL='<External Database URL from your host>'
#   ./scripts/load-production-data.sh                    # demo data only
#   ./scripts/load-production-data.sh path/to/file.csv   # demo data + dataset
#
# Run it from anywhere -- it locates the project relative to its own path.
# Set ASSUME_YES=1 to skip the confirmation where nothing can answer a prompt.
# Set SEED_PASSWORD to choose the demo account's password.
#
# DATABASE_URL is read from the environment and never echoed, so it does not end
# up in your shell history or in this script's output.

set -euo pipefail

CSV_PATH="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/backend"

# ---------------------------------------------------------------- interpreter
# Prefer a virtualenv in the repo, else whatever python is on PATH.
PY="python"
for candidate in "$REPO_ROOT/.auditvenv/Scripts/python.exe" \
                 "$REPO_ROOT/backend/.venv/Scripts/python.exe" \
                 "$REPO_ROOT/backend/.venv/bin/python"; do
    [ -x "$candidate" ] && { PY="$candidate"; break; }
done

# ------------------------------------------------------------------ preflight
if [ -z "${DATABASE_URL:-}" ]; then
    cat >&2 <<'EOF'
DATABASE_URL is not set.

Copy the *External* Database URL from your host's dashboard (the internal one
is only reachable from inside their network), then:

    export DATABASE_URL='postgres://user:password@host/dbname'

EOF
    exit 1
fi

case "$DATABASE_URL" in
    *localhost*|*127.0.0.1*)
        echo "Refusing to run: DATABASE_URL points at localhost." >&2
        echo "This script is for a remote deployment; use manage.py directly for local work." >&2
        exit 1
        ;;
esac

# These are required for settings.py to import at all. They do not affect the
# data written -- no web server is being started here.
export DJANGO_DEBUG=false
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-offline-task-key-not-used-for-serving}"
export DJANGO_ALLOWED_HOSTS="${DJANGO_ALLOWED_HOSTS:-localhost}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://example.invalid}"
# Nothing here should reach out to a third-party API.
export RXNORM_ENABLED=false
export OPENFDA_ENABLED=false

# Show which database, without the credentials.
SAFE_TARGET="$("$PY" - <<'PY'
import os, urllib.parse
u = urllib.parse.urlsplit(os.environ["DATABASE_URL"])
print(f"{u.hostname}/{(u.path or '/').lstrip('/')}")
PY
)"
echo "Target database: $SAFE_TARGET"
echo

if [ -n "$CSV_PATH" ] && [ ! -f "$CSV_PATH" ]; then
    echo "CSV not found: $CSV_PATH" >&2
    exit 1
fi

# ASSUME_YES lets this run where nothing can answer a prompt -- a CI step, or a
# shell with stdin closed, where `read` sees EOF and would abort every time.
if [ "${ASSUME_YES:-}" = "1" ]; then
    echo "ASSUME_YES=1 -- proceeding without confirmation."
elif [ ! -t 0 ]; then
    echo "Not an interactive terminal, and ASSUME_YES is not set." >&2
    echo "Re-run in a terminal, or prefix with ASSUME_YES=1 to skip the prompt." >&2
    exit 1
else
    read -r -p "Continue? [y/N] " reply
    [ "$reply" = "y" ] || [ "$reply" = "Y" ] || { echo "Aborted."; exit 1; }
fi
echo

# ------------------------------------------------------------------- schema
echo "==> Applying migrations"
"$PY" manage.py migrate --noinput
echo

echo "==> Ensuring the cache table exists"
# Rate-limit counters live here in production; a missing table fails open.
"$PY" manage.py createcachetable
echo

# ------------------------------------------------------------- demo content
echo "==> Seeding the demo account, patients and demo interactions"
if [ -n "${SEED_PASSWORD:-}" ]; then
    "$PY" manage.py seed_demo --password "$SEED_PASSWORD"
else
    "$PY" manage.py seed_demo
fi
echo

# ----------------------------------------------------------------- dataset
if [ -n "$CSV_PATH" ]; then
    echo "==> Importing the interaction dataset (this can take a few minutes)"
    # Not --replace: that would drop the curated, severity-graded rows and
    # leave only whatever this file provides. The importer keeps the more
    # specific grading for any pair present in both.
    "$PY" manage.py import_interactions --path "$CSV_PATH"
    echo
fi

# ------------------------------------------------------------------ summary
echo "==> Current contents"
"$PY" - <<'PY'
import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()
from django.contrib.auth.models import User
from interactions.models import DrugInteraction, PatientList
from django.db.models import Count

print(f"  accounts     : {User.objects.count()}")
print(f"  patients     : {PatientList.objects.count()}")
print(f"  interactions : {DrugInteraction.objects.count():,}")
for row in DrugInteraction.objects.values("severity").annotate(n=Count("id")).order_by("-n"):
    print(f"      {row['severity']:<16} {row['n']:,}")
PY

echo
echo "Done."

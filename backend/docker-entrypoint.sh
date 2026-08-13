#!/bin/sh
#
# Container entrypoint: bring the database up to date, then hand off to the
# process manager.
#
# Why this exists: the image previously ran gunicorn directly, so a fresh
# deploy booted against an unmigrated database and every request 500'd until
# someone remembered to run migrate by hand. Doing it here means the same
# image is correct on Render, Fly, Kubernetes and docker-compose alike,
# without depending on a platform-specific release-command feature (Render's
# preDeployCommand, for one, is not available on the free tier).
#
# `migrate` is idempotent and takes a database-level lock, so a redeploy that
# briefly runs two containers will not corrupt anything -- the second waits.

set -eu

echo "[entrypoint] Applying database migrations..."
python manage.py migrate --noinput

# The production cache backend is a Postgres table (see settings.CACHES), and
# DRF's throttle counters live in it. If the table is missing, throttling fails
# open -- an unthrottled login endpoint -- so this is a security step, not
# housekeeping. Idempotent: it is a no-op once the table exists.
echo "[entrypoint] Ensuring cache table exists..."
python manage.py createcachetable

echo "[entrypoint] Starting: $*"
# exec so the CMD process becomes PID 1 and receives SIGTERM directly, which is
# what lets gunicorn drain in-flight requests on shutdown.
exec "$@"

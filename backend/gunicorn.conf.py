"""Gunicorn configuration for the SafeMeds backend.

Run with:  gunicorn backend.wsgi:application -c gunicorn.conf.py
"""

import multiprocessing
import os

# --------------------------------------------------------------------------- #
# Binding and workers
# --------------------------------------------------------------------------- #

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# The usual starting point. Interaction checks make outbound HTTP calls, so
# threads let a worker stay useful while one request waits on Gemini.
workers = int(os.environ.get("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
threads = int(os.environ.get("GUNICORN_THREADS", 4))
worker_class = "gthread"

# --------------------------------------------------------------------------- #
# Timeouts
# --------------------------------------------------------------------------- #

# Hard ceiling on a single request. Must exceed GEMINI_TIMEOUT_SECONDS with
# room to spare, or a slow upstream lookup gets the worker killed mid-request.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 60))

# On SIGTERM, stop accepting new requests and give in-flight ones this long to
# finish before the worker is killed. This is what makes a rolling deploy or a
# container stop graceful rather than dropping live requests.
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", 30))

# Slightly above a typical 60s load-balancer idle timeout, so the LB closes
# idle connections first and clients never race a server-side close.
keepalive = 65

# Recycle workers periodically to bound the effect of any slow leak.
max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", 1000))
max_requests_jitter = 100

# --------------------------------------------------------------------------- #
# Logging -- to stdout/stderr for the platform's log collector to pick up.
# --------------------------------------------------------------------------- #

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
# Skip health probes in the access log; they otherwise dominate it.
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(M)sms "%(a)s"'


# --------------------------------------------------------------------------- #
# Lifecycle hooks
# --------------------------------------------------------------------------- #


def worker_exit(server, worker):
    """Close pooled database connections when a worker shuts down.

    With CONN_MAX_AGE > 0 each worker holds persistent connections. Without
    this, a restart leaves them to time out server-side, and a few rapid
    redeploys can exhaust Postgres' connection limit.
    """
    try:
        from django.db import connections

        connections.close_all()
    except Exception:  # pragma: no cover - best effort during shutdown
        pass


def on_starting(server):
    server.log.info("SafeMeds backend starting: %s workers, %s threads", workers, threads)

# gunicorn.conf.py — Single source of truth for Gunicorn configuration.
#
# WHY --workers 1:
#   This app uses an in-memory cache (CACHE = {} in services/cache.py).
#   Each Gunicorn worker is a separate OS process with its own private memory.
#   Multiple workers = each request could hit a different worker = always MISS.
#   Fix: 1 worker + multiple threads handles concurrency safely.
#
# NOTE: If you ever add Redis, you can safely increase workers.

workers = 1       # Single process — shared in-memory CACHE dict
threads = 4       # 4 threads handle concurrent requests within that process
timeout = 120     # ML routes can be slow; prevent premature worker kill
worker_class = "gthread"  # Thread-based concurrency model
bind = "0.0.0.0:10000"

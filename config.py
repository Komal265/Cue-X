"""
config.py — Centralized, class-based configuration for Cue-X.

All config values live here. New variables should always be added here with
sensible defaults so the app never crashes on a missing import.

Usage:
    from config import settings
    settings.OPTIMIZER_ENABLED
    getattr(settings, "SOME_NEW_KEY", default_value)   # safe fallback pattern
"""

import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Settings:
    # ── Paths ─────────────────────────────────────────────────────────────────
    BASE_DIR      = BASE_DIR
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MODEL_DIR     = os.path.join(BASE_DIR, "models")

    # Model file paths
    RFM_MODEL_PATH  = os.path.join(MODEL_DIR, "rfm_kmeans_model.joblib")
    RFM_SCALER_PATH = os.path.join(MODEL_DIR, "rfm_scaler.joblib")
    RFM_MAP_PATH    = os.path.join(MODEL_DIR, "rfm_segment_map.json")

    # ── Environment / Secrets ────────────────────────────────────────────────
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    BASE_URL       = os.getenv("BASE_URL", "http://localhost:10000")
    PORT           = int(os.getenv("PORT", 10000))
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "default-dev-secret-key")
    FRONTEND_URL   = os.getenv("FRONTEND_URL", "")

    # Normalize DATABASE_URL: Render may issue the legacy postgres:// scheme
    # which SQLAlchemy 1.4+ does not accept — fix it transparently.
    _raw_db_url    = os.getenv("DATABASE_URL", "")
    DATABASE_URL   = _raw_db_url.replace("postgres://", "postgresql://", 1) if _raw_db_url else ""

    # ── Clustering Optimizer ─────────────────────────────────────────────────
    OPTIMIZER_ENABLED    = True
    OPTIMIZER_MIN_K      = 2
    OPTIMIZER_MAX_K      = 10

    # Minimum composite-score improvement to accept a challenger model
    OPTIMIZER_IMPROVEMENT_THRESHOLD = 0.02

    # At least this fraction of points must be assigned (not noise)
    OPTIMIZER_MIN_COVERAGE = 0.70          # 70 %

    # Max fraction of points allowed in "tiny" clusters
    OPTIMIZER_MAX_TINY_CLUSTER_RATIO = 0.20   # 20 %

    # A cluster is "tiny" if it holds fewer than this fraction of all points
    OPTIMIZER_MIN_CLUSTER_SIZE_RATIO = 0.02   # 2 %

    # Bootstrap stability testing
    OPTIMIZER_BOOTSTRAP_REPEATS      = 3
    OPTIMIZER_BOOTSTRAP_SAMPLE_RATIO = 0.75

    # Sampling cap for large datasets (perf guard)
    OPTIMIZER_SAMPLE_SIZE = 10_000

    # Algorithms the optimizer may evaluate
    OPTIMIZER_ALGORITHMS = ["kmeans", "gmm", "agglomerative", "dbscan"]

    # ── DBSCAN defaults ───────────────────────────────────────────────────────
    DBSCAN_EPS         = 0.5
    DBSCAN_MIN_SAMPLES = 5

    # ── Scheduler ─────────────────────────────────────────────────────────────
    SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "false").lower() == "true"


settings = Settings()


# ── Backward-compatible module-level aliases ──────────────────────────────────
# Any existing code that does `from config import SOME_VAR` will still work.
BASE_URL                       = settings.BASE_URL
PORT                           = settings.PORT
DATABASE_URL                   = settings.DATABASE_URL
JWT_SECRET_KEY                 = settings.JWT_SECRET_KEY
GEMINI_API_KEY                 = settings.GEMINI_API_KEY
FRONTEND_URL                   = settings.FRONTEND_URL
UPLOAD_FOLDER                  = settings.UPLOAD_FOLDER
MODEL_DIR                      = settings.MODEL_DIR
RFM_MODEL_PATH                 = settings.RFM_MODEL_PATH
RFM_SCALER_PATH                = settings.RFM_SCALER_PATH
RFM_MAP_PATH                   = settings.RFM_MAP_PATH
OPTIMIZER_ENABLED              = settings.OPTIMIZER_ENABLED
OPTIMIZER_MIN_K                = settings.OPTIMIZER_MIN_K
OPTIMIZER_MAX_K                = settings.OPTIMIZER_MAX_K
OPTIMIZER_IMPROVEMENT_THRESHOLD= settings.OPTIMIZER_IMPROVEMENT_THRESHOLD
OPTIMIZER_MIN_COVERAGE         = settings.OPTIMIZER_MIN_COVERAGE
OPTIMIZER_MAX_TINY_CLUSTER_RATIO  = settings.OPTIMIZER_MAX_TINY_CLUSTER_RATIO
OPTIMIZER_MIN_CLUSTER_SIZE_RATIO  = settings.OPTIMIZER_MIN_CLUSTER_SIZE_RATIO
OPTIMIZER_BOOTSTRAP_REPEATS    = settings.OPTIMIZER_BOOTSTRAP_REPEATS
OPTIMIZER_BOOTSTRAP_SAMPLE_RATIO  = settings.OPTIMIZER_BOOTSTRAP_SAMPLE_RATIO
OPTIMIZER_SAMPLE_SIZE          = settings.OPTIMIZER_SAMPLE_SIZE
OPTIMIZER_ALGORITHMS           = settings.OPTIMIZER_ALGORITHMS
DBSCAN_EPS                     = settings.DBSCAN_EPS
DBSCAN_MIN_SAMPLES             = settings.DBSCAN_MIN_SAMPLES
SCHEDULER_ENABLED              = settings.SCHEDULER_ENABLED
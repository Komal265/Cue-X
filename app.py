from flask import Flask
from flask_cors import CORS
from config import settings
from routes.upload import upload_bp
from routes.charts import charts_bp
from routes.ai import ai_bp
from routes.workspaces import workspace_bp
from routes.auth import auth_bp
from routes.integrations import integrations_bp
from database import init_db
from scheduler import start_scheduler


# ── Startup config validation ─────────────────────────────────────────────────
def validate_config():
    """Warn loudly about any missing required settings — but never crash."""
    required = [
        "OPTIMIZER_ENABLED",
        "OPTIMIZER_MIN_K",
        "OPTIMIZER_MAX_K",
        "OPTIMIZER_IMPROVEMENT_THRESHOLD",
        "OPTIMIZER_MIN_COVERAGE",
        "OPTIMIZER_MAX_TINY_CLUSTER_RATIO",
        "OPTIMIZER_MIN_CLUSTER_SIZE_RATIO",
        "OPTIMIZER_BOOTSTRAP_REPEATS",
        "OPTIMIZER_BOOTSTRAP_SAMPLE_RATIO",
        "DATABASE_URL",
        "JWT_SECRET_KEY",
        "BASE_URL",
    ]
    missing = [k for k in required if not hasattr(settings, k)]
    if missing:
        for k in missing:
            print(f"[WARNING] Missing config key: {k} — using safe fallback")
    else:
        print(f"[OK] Config validated — {len(required)} keys present")

validate_config()


def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
    CORS(
        app,
        resources={
            r"/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ]
            }
        },
        supports_credentials=True,
    )
    app.register_blueprint(upload_bp)
    app.register_blueprint(charts_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(integrations_bp)

    @app.route('/api/cache/status', methods=['GET'])
    def cache_status():
        from services.cache import get_cache_status
        return get_cache_status()

    init_db()   # create / migrate tables
    start_scheduler(app)  # no-op unless SCHEDULER_ENABLED=true
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=settings.PORT, debug=True)
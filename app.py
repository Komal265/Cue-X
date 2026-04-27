# Render Start Command:
# gunicorn "app:create_app()" --workers 1 --threads 4 --bind 0.0.0.0:$PORT

from flask import Flask
from flask_cors import CORS
from config import settings
from routes.upload import upload_bp
from routes.charts import charts_bp
from routes.ai import ai_bp
from routes.workspaces import workspace_bp
from routes.auth import auth_bp
from routes.integrations import integrations_bp
from database import init_db, engine
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
    import os
    print("[BOOT] App starting...")
    print("[BOOT] Environment:", os.getenv("RENDER", "local"))
    
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

    # Build allowed origins: always include localhost for dev.
    # In production, set FRONTEND_URL to your deployed frontend domain.
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    if settings.FRONTEND_URL:
        allowed_origins.append(settings.FRONTEND_URL.rstrip("/"))

    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=True,
        expose_headers=["X-Cache"]
    )
    app.register_blueprint(upload_bp)
    app.register_blueprint(charts_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(integrations_bp)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Lightweight liveness + DB connectivity probe."""
        from flask import jsonify
        from sqlalchemy import text as _text
        db_status = "disconnected"
        if engine is not None:
            try:
                with engine.connect() as _conn:
                    _conn.execute(_text("SELECT 1"))
                db_status = "connected"
            except Exception as exc:
                db_status = f"error: {type(exc).__name__}"
        return jsonify({"status": "ok", "database": db_status})

    @app.route('/api/cache/status', methods=['GET'])
    def cache_status():
        from services.cache import get_cache_status, CACHE
        import os
        print(f"[CACHE DIAGNOSTICS] Worker PID: {os.getpid()} | CACHE id: {id(CACHE)} | Keys: {list(CACHE.keys())}")
        return get_cache_status()

    @app.route('/api/test-cache', methods=['GET'])
    def test_cache():
        """Diagnostic endpoint: first call MISS, every subsequent call HIT."""
        import os
        from flask import jsonify, make_response
        from services.cache import get_cache, set_cache, CACHE
        key = "test_key"
        print(f"[TEST-CACHE] PID={os.getpid()} | cache id={id(CACHE)} | keys={list(CACHE.keys())}")
        cached = get_cache(key)
        if cached:
            response = make_response(jsonify({'status': 'HIT', 'pid': os.getpid()}))
            response.headers['X-Cache'] = 'HIT'
            return response
        set_cache(key, {'ok': True}, ttl=600)
        response = make_response(jsonify({'status': 'MISS', 'pid': os.getpid()}))
        response.headers['X-Cache'] = 'MISS'
        return response

    init_db()   # create / migrate tables
    start_scheduler(app)  # no-op unless SCHEDULER_ENABLED=true
    return app

if __name__ == '__main__':
    app = create_app()
    # debug=False prevents the Werkzeug reloader from spawning a second
    # child process — which would give it a DIFFERENT copy of CACHE in memory.
    import os
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=PORT, debug=False)
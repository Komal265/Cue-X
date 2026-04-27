from flask import Flask
from flask_cors import CORS
from routes.upload import upload_bp
from routes.charts import charts_bp
from routes.ai import ai_bp
from routes.workspaces import workspace_bp
from routes.auth import auth_bp
from database import init_db

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
    init_db()   # create tables if they don't exist yet
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=10000, debug=True)
from flask import Flask
from flask_cors import CORS
from config import PORT
from routes.upload import upload_bp
from routes.charts import charts_bp
from routes.ai import ai_bp
from database import init_db

def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
    CORS(app, resources={r"/*": {"origins": "*"}})
    app.register_blueprint(upload_bp)
    app.register_blueprint(charts_bp)
    app.register_blueprint(ai_bp)
    init_db()   # create tables if they don't exist yet
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=PORT, debug=False)
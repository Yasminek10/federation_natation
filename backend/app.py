import os
from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from db import db
from flask_sqlalchemy import SQLAlchemy
from minimas import minimas_bp  
from login import auth_bp
from ocr import ocr_bp
from championnats import championnats_bp
from epreuves import epreuves_bp
from ingest import ingest_bp
from login import auth_bp
from eligibilite import swimmers_bp
from maxplaces import maxplaces_bp


load_dotenv()

def create_app():
    app = Flask(__name__)
    app.secret_key = "18163b14564fa75026205a9471dc10713226087a170655109c0af14671597160"
    # Allow frontend (React) to send cookies
    CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

    # Core config
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"  # "None" if using HTTPS cross-site
    # In dev on http://localhost, keep SECURE False. In prod, set True.
    app.config["SESSION_COOKIE_SECURE"] = False
    
    # --- DB connection (NO .env, as requested) ---
    # Single main DB:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:1234@localhost:5432/NatationDB'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    # CORS (allow cookie-based sessions from React)
    client_origin = os.getenv("CLIENT_ORIGIN", "http://localhost:3000")
    CORS(
        app,
        supports_credentials=True,
        resources={r"/api/*": {"origins": [client_origin]}},
    )

    # Blueprints (add more later, e.g., pages_bp)
    app.register_blueprint(auth_bp)

    app.register_blueprint(minimas_bp)  # ← register minimas blueprint
    app.register_blueprint(ocr_bp)
    app.register_blueprint(championnats_bp)
    app.register_blueprint(epreuves_bp)   
    

    app.register_blueprint(ingest_bp)
    app.register_blueprint(swimmers_bp)
    app.register_blueprint(maxplaces_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})
    return app
# For `flask run` and `python app.py`
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)

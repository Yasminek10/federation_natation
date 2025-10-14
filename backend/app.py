import os
from datetime import timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from db import db
from flask_sqlalchemy import SQLAlchemy
from minimas import minimas_bp  
#from ocr import ocr_bp
from championnats import championnats_bp
from epreuves import epreuves_bp
from ingest import ingest_bp
from login import auth_bp
from clubs import clubs_bp
from eligibilite import swimmers_bp
from maxplaces import maxplaces_bp
from account import account_bp
from admin_users import users_admin_bp
from categorie import categories_bp
from nageurs import nageurs_bp
from championnats import champ_bp
from result_api import results_yass_bp
from ocr_blueprint import ocr_bp
from nageurs import nageursDetails_bp  # ← import nageurs blueprint
from bilan import bilan_bp
from bilan_champ import bilan_clubs_bp  # ← import bilan_clubs blueprint

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.secret_key = "18163b14564fa75026205a9471dc10713226087a170655109c0af14671597160"
    

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

    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",  # OK en dev http://localhost:3000 -> http://localhost:5000
        SESSION_COOKIE_SECURE=False,     # en dev (HTTP). En prod HTTPS -> True et SAMESITE="None"
    )

    # Blueprints (add more later, e.g., pages_bp)
    app.register_blueprint(auth_bp)

    app.register_blueprint(minimas_bp)  # ← register minimas blueprint
    app.register_blueprint(ocr_bp)
    app.register_blueprint(championnats_bp)
    app.register_blueprint(epreuves_bp)   
    app.register_blueprint(results_yass_bp)   

    app.register_blueprint(ingest_bp)
    app.register_blueprint(swimmers_bp)

    app.register_blueprint(clubs_bp)
    app.register_blueprint(categories_bp)
   

    app.register_blueprint(maxplaces_bp)
    app.register_blueprint(account_bp)
    app.register_blueprint(users_admin_bp)
    app.register_blueprint(nageurs_bp)
    app.register_blueprint(nageursDetails_bp)  # ← register nageursDetails blueprint

    app.register_blueprint(champ_bp)
    app.register_blueprint(bilan_bp)
    app.register_blueprint(bilan_clubs_bp)  
    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})
    return app

# For `flask run` and `python app.py`
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)

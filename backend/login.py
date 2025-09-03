from flask import Blueprint, request, jsonify, session
import bcrypt

from werkzeug.security import generate_password_hash, check_password_hash
from db import db, User   # ✅ import SQLAlchemy + User model

auth_bp = Blueprint("auth", __name__, url_prefix="/api")


# POST /api/login
@auth_bp.post("/login")
def login():
    u = session.get("user")
    if u and u.get("id"):
        return jsonify({"status": "already_authenticated", "user": u}), 200
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"status": "error", "message": "Email et mot de passe requis"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401

    # mdp_hash should be a bcrypt string like "$2b$..."
    hashed = user.mdp_hash
    if not isinstance(hashed, (str, bytes)):
        return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401

    # ensure both args are bytes for bcrypt
    if isinstance(hashed, str):
        hashed_bytes = hashed.encode("utf-8")
    else:
        hashed_bytes = hashed

    try:
        ok = bcrypt.checkpw(password.encode("utf-8"), hashed_bytes)
    except ValueError:
        # Invalid salt / not a bcrypt hash -> treat as wrong credentials (don’t 500)
        return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401

    if not ok:
        return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401
    
    session.permanent = True
    session["user"] = {
        "id": user.user_id,
        "email": user.email,
        "role": user.role,
        "nom": user.nom,
        "prenom": user.prenom,
        "name": f"{user.prenom} {user.nom}".strip(),
    }
    return jsonify({"status": "success", "role": user.role, "user": session["user"]})


# POST /api/logout
@auth_bp.post("/logout")
def logout():
    session.pop("user", None)
    return jsonify({"status": "success"})


# GET /api/me  -> check current session
@auth_bp.get("/me")
def me():
    user = session.get("user")
    if not user:
        return jsonify({"authenticated": False}), 401
    return jsonify({"authenticated": True, "user": user})


# POST /api/register
@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    nom = (data.get("nom") or "").strip()
    prenom = (data.get("prenom") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "coach").strip()  # par défaut coach

    if not nom or not prenom or not email or not password:
        return jsonify({"status": "error", "message": "Tous les champs sont requis"}), 400

    # Vérifier si email existe déjà
    if User.query.filter_by(email=email).first():
        return jsonify({"status": "error", "message": "Email déjà utilisé"}), 409

    # Hasher le mot de passe
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    # Créer l’utilisateur
    new_user = User(
        nom=nom,
        prenom=prenom,
        email=email,
        mdp_hash=hashed.decode("utf-8"),  # stocker en str
        role=role
    )

    db.session.add(new_user)
    db.session.commit()

    return jsonify({"status": "success", "message": "Utilisateur créé avec succès"})
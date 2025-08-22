from flask import Blueprint, request, jsonify, session
import bcrypt
from db import db, User   # ✅ import SQLAlchemy + User model

auth_bp = Blueprint("auth", __name__, url_prefix="/api")


# POST /api/login
@auth_bp.post("/login")
def login():
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

    session["user"] = {"id": user.user_id, "email": user.email, "role": user.role}
    return jsonify({"status": "success", "role": user.role})


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
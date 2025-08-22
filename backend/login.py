from flask import Blueprint, request, jsonify, session
import bcrypt
from db import db, User

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

# POST /api/login
@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"status": "error", "message": "Email et mot de passe requis"}), 400

    row = fetch_one(
        "SELECT id, email, password, role FROM users WHERE email=%s",
        (email,)
    )
    if not row:
        return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401

    user_id, user_email, password_hash, role = row["id"], row["email"], row["mdp_hash"], row["role"]

    # password_hash stored as bcrypt hash string in DB
    ok = bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    if not ok:
        return jsonify({"status": "error", "message": "Email ou mot de passe incorrect"}), 401

    # Create session
    session["user"] = {"id": user_id, "email": user_email, "role": role}
    return jsonify({"status": "success", "role": role})

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
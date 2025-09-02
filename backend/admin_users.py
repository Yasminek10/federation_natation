from flask import Blueprint, request, jsonify, session
from db import db, User
import bcrypt

users_admin_bp = Blueprint("users_admin", __name__, url_prefix="/api/admin/users")

def is_admin() -> bool:
    try:
        return (session.get("user") or {}).get("role") == "admin"
    except Exception:
        return False

@users_admin_bp.post("")
def create_user():
    """
    Crée un utilisateur (admin uniquement).
    Payload attendu:
    {
      "nom": "...",
      "prenom": "...",
      "email": "ex@ample.com",
      "password": "******",
      "role": "coach" | "admin"   (par défaut: "coach")
    }
    """
    if not is_admin():
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    nom = (data.get("nom") or "").strip()
    prenom = (data.get("prenom") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "coach").strip().lower()

    if not nom or not prenom or not email or not password:
        return jsonify({"error": "missing_fields"}), 422
    if role not in ("admin", "coach"):
        return jsonify({"error": "invalid_role"}), 422
    if len(password) < 6:
        return jsonify({"error": "weak_password"}), 422

    # email unique
    exists = User.query.filter_by(email=email).first()
    if exists:
        return jsonify({"error": "email_taken"}), 409

    salt = bcrypt.gensalt()
    mdp_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    user = User(
        nom=nom,
        prenom=prenom,
        email=email,
        mdp_hash=mdp_hash,
        role=role,
    )
    db.session.add(user)
    db.session.commit()

    out = {
        "id": user.user_id,
        "nom": user.nom,
        "prenom": user.prenom,
        "email": user.email,
        "role": user.role,
        "name": f"{user.prenom} {user.nom}".strip(),
    }
    return jsonify({"status": "ok", "user": out}), 201

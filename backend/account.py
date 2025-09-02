# backend/account.py
from flask import Blueprint, jsonify, request, session
from db import db, User
import bcrypt

account_bp = Blueprint("account", __name__, url_prefix="/api/account")

def _require_auth():
    u = session.get("user")
    return u if u and u.get("id") else None

@account_bp.put("/profile")
def update_profile():
    # Profil figé : on refuse la modif
    return jsonify({"error": "profile_edit_disabled"}), 405

@account_bp.put("/password")
def change_password():
    u = _require_auth()
    if not u:
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if len(new_password) < 6:
        return jsonify({"error": "weak_password"}), 422

    user = db.session.get(User, u["id"])
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    hashed_bytes = user.mdp_hash.encode("utf-8") if isinstance(user.mdp_hash, str) else user.mdp_hash
    if not bcrypt.checkpw(current_password.encode("utf-8"), hashed_bytes):
        return jsonify({"error": "bad_credentials"}), 403

    salt = bcrypt.gensalt()
    user.mdp_hash = bcrypt.hashpw(new_password.encode("utf-8"), salt).decode("utf-8")
    db.session.commit()
    return jsonify({"status": "ok"})

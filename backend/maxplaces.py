# backend/rules.py
from flask import Blueprint, jsonify, request, session
from sqlalchemy import select
from db import db, Categorie

maxplaces_bp = Blueprint("maxplaces", __name__, url_prefix="/api/maxplaces")


@maxplaces_bp.get("/max-places")
def get_max_places():
    """Retourne toutes les catégories avec leurs max places."""
    cats = db.session.execute(select(Categorie).order_by(Categorie.nom)).scalars().all()
    out = [
        {
            "categorie_id": c.categorie_id,
            "categorie": c.nom,
            "max_places_indiv": c.max_places_indiv,
            "max_places_relay": c.max_places_relay,
        }
        for c in cats
    ]
    return jsonify({"items": out, "total": len(out)})

@maxplaces_bp.patch("/max-places/<int:cat_id>")
def update_one_max_place(cat_id: int):
    

    data = request.get_json(silent=True) or {}
    c: Categorie | None = db.session.get(Categorie, cat_id)
    if not c:
        return jsonify({"error": "categorie_not_found"}), 404

    # champs optionnels
    if "max_places_indiv" in data:
        v = data["max_places_indiv"]
        c.max_places_indiv = int(v) if v is not None else None
    if "max_places_relay" in data:
        v = data["max_places_relay"]
        c.max_places_relay = int(v) if v is not None else None

    db.session.commit()
    return jsonify({
        "categorie_id": c.categorie_id,
        "categorie": c.nom,
        "max_places_indiv": c.max_places_indiv,
        "max_places_relay": c.max_places_relay,
    })

@maxplaces_bp.put("/max-places")
def bulk_update_max_places():
    """
    Met à jour en lot (admin seulement).
    Payload attendu:
    {
      "updates": [
        {"categorie_id": 1, "max_places_indiv": 8, "max_places_relay": 2},
        ...
      ]
    }
    """

    data = request.get_json(silent=True) or {}
    updates = data.get("updates") or []
    if not isinstance(updates, list):
        return jsonify({"error": "invalid_payload"}), 422

    changed = 0
    ids = []
    for u in updates:
        try:
            cat_id = int(u.get("categorie_id"))
        except Exception:
            continue
        c: Categorie | None = db.session.get(Categorie, cat_id)
        if not c:
            continue
        if "max_places_indiv" in u:
            v = u["max_places_indiv"]
            c.max_places_indiv = int(v) if v is not None else None
        if "max_places_relay" in u:
            v = u["max_places_relay"]
            c.max_places_relay = int(v) if v is not None else None
        changed += 1
        ids.append(cat_id)

    db.session.commit()
    return jsonify({"status": "ok", "updated": changed, "ids": ids})

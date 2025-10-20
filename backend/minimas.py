# minimas_bp.py
from flask import Blueprint, jsonify, request
from sqlalchemy import text  # ✅ important pour corriger l'erreur SQL
from db import db, Epreuve, Minimas, Categorie  # Assure-toi que ces modèles existent

minimas_bp = Blueprint("minimas", __name__, url_prefix="/api/minimas")


# --- GET : Récupérer tous les minimas ---
@minimas_bp.route("/", methods=["GET"])
def get_minimas():
    try:
        query = db.session.execute(text("""
            SELECT 
                m.min_id AS min_id,
                c.nom AS categorie,
                CASE 
                    WHEN e.legs_count = 4 OR e.legs_count = 10 THEN
                        e.legs_count || '_x_' || e.distance || '_M_ ' ||
                        UPPER(REPLACE(e.nage, ' ', '_')) || ' ' || e.genre
                    ELSE
                        e.distance || '_M_ ' || UPPER(REPLACE(e.nage, ' ', '_')) || ' ' || e.genre
                END AS epreuve,
                m.temp_min
            FROM minimas m
            JOIN epreuve e ON m.epreuve_id = e.epreuve_id
            JOIN categorie c ON m.categorie_id = c.categorie_id
            ORDER BY c.nom, e.nage, e.distance;
        """))  # ✅ text() obligatoire avec SQLAlchemy 2.x

        rows = [dict(row._mapping) for row in query]
        return jsonify(rows), 200  # ✅ ajout explicite du code HTTP

    except Exception as e:
        db.session.rollback()
        print("❌ ERREUR SQL :", e)
        return jsonify({"error": str(e)}), 500


# --- PUT : Modifier un minima ---
@minimas_bp.route("/<int:minima_id>", methods=["PUT"])
def update_minima(minima_id):
    data = request.get_json()
    temps = data.get("temps")

    if not temps:
        return jsonify({"error": "Le temps est requis"}), 400

    try:
        result = db.session.execute(
            text("UPDATE minimas SET temp_min = :temps WHERE min_id = :id RETURNING min_id, temp_min;"),
            {"temps": temps, "id": minima_id}
        )
        updated = result.fetchone()
        db.session.commit()

        if updated:
            return jsonify({"id": updated[0], "temp_min": updated[1]}), 200
        else:
            return jsonify({"error": "Minima non trouvé"}), 404

    except Exception as e:
        db.session.rollback()
        print("❌ ERREUR SQL :", e)
        return jsonify({"error": str(e)}), 500

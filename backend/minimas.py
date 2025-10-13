# minimas_bp.py
from flask import Blueprint, jsonify, request
from db import db
import psycopg2
from psycopg2.extras import RealDictCursor

minimas_bp = Blueprint("minimas", __name__, url_prefix="/api/minimas")

# Connexion PostgreSQL (si tu ne veux pas utiliser SQLAlchemy ici)
conn = psycopg2.connect(
    host="localhost",
    database="NatationDB",
    user="postgres",
    password="admin"

)

@minimas_bp.route("/", methods=["GET"])
def get_minimas():
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
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
    """)
    rows = cur.fetchall()
    cur.close()
    return jsonify(rows)






# --- PUT pour modifier un minima ---
@minimas_bp.route("/<int:minima_id>", methods=["PUT"])
def update_minima(minima_id):
    data = request.get_json()
    temps = data.get("temps")

    if not temps:
        return jsonify({"error": "Le temps est requis"}), 400

    cur = conn.cursor()
    try:
        cur.execute("UPDATE minimas SET temp_min = %s WHERE min_id = %s RETURNING min_id, temp_min;", (temps, minima_id))
        updated = cur.fetchone()
        conn.commit()
        cur.close()
        if updated:
            return jsonify({"id": updated[0], "temp_min": updated[1]})
        else:
            return jsonify({"error": "Minima non trouvé"}), 404
    except Exception as e:
        conn.rollback()
        cur.close()
        return jsonify({"error": str(e)}), 500
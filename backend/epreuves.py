from flask import Blueprint, jsonify, request
from db import db, Epreuve

epreuves_bp = Blueprint("epreuves", __name__, url_prefix="/api/epreuves")


@epreuves_bp.route("/", methods=["GET"])
def get_epreuves():
    eps = Epreuve.query.all()
    return jsonify([{
        "id": e.epreuve_id,
        "nage": e.nage,
        "distance": e.distance,
        "genre": e.genre,
        "is_relay": e.is_relay,
        "legs_count": e.legs_count
    } for e in eps])


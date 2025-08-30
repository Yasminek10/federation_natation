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


# @epreuves_bp.route("/", methods=["POST"])
# def create_epreuve():
#     data = request.json
#     e = Epreuve(
#         nage=data.get("nage"),
#         distance=data.get("distance"),
#         genre=data.get("genre"),
#         is_relay=data.get("is_relay", False)
#     )
#     db.session.add(e)
#     db.session.commit()
#     return jsonify({
#         "id": e.epreuve_id,
#         "nage": e.nage,
#         "distance": e.distance,
#         "genre": e.genre,
#         "is_relay": e.is_relay
#     }), 201

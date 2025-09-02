from flask import Blueprint, jsonify, request
from db import db, Championnat

championnats_bp = Blueprint("championnats", __name__, url_prefix="/api/championnats")


@championnats_bp.route("/", methods=["GET"])
def get_championnats():
    chs = Championnat.query.all()
    return jsonify([{
        "id": c.champ_id,
        "nom": c.nom,
        "saison": c.saison,
        "datedeb": c.datedeb.isoformat(),
        "datefin": c.datefin.isoformat(),
        "lieu": c.lieu,
        "bassin": c.bassin
    } for c in chs])



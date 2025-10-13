# backend/championnats.py
from flask import Blueprint, jsonify
from db import db
from db import db, Championnat, CEC, Epreuve, Categorie

champ_bp = Blueprint("champ", __name__, url_prefix="/api/championnats")



@champ_bp.get("/")
def get_championnats():
    ch = Championnat.query.all()
    return jsonify([
        {
            "id": c.champ_id,
            "nom": c.nom,
            "saison": c.saison,
            "lieu": c.lieu,
            "datedeb": str(c.datedeb),
            "datefin": str(c.datefin),
        }
        for c in ch
    ])


@champ_bp.get("/<int:champ_id>/epreuves")
def get_epreuves(champ_id):
    epreuves = (
        db.session.query(
            Epreuve.epreuve_id,
            Epreuve.nage,
            Epreuve.distance,
            Epreuve.genre,
            Epreuve.is_relay
        )
        .join(CEC, CEC.epreuve_id == Epreuve.epreuve_id)
        .filter(CEC.champ_id == champ_id)
        .distinct()  # ici ça déduplique sur les colonnes choisies
        .all()
    )

    return jsonify([
        {
            "epreuve_id": e.epreuve_id,
            "nage": e.nage,
            "distance": e.distance,
            "genre": e.genre,
            "is_relay": e.is_relay,
        }
        for e in epreuves
    ])




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



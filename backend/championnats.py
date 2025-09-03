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
        db.session.query(CEC, Epreuve, Categorie)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
        .filter(CEC.champ_id == champ_id)
        .all()
    )
    return jsonify([
        {
            "cec_id": c.CEC.cec_id,
            "epreuve_id": c.Epreuve.epreuve_id,
            "categorie": c.Categorie.nom,
            "nage": c.Epreuve.nage,
            "distance": c.Epreuve.distance,
            "genre": c.Epreuve.genre,
            "is_relay": c.Epreuve.is_relay,
        }
        for c in epreuves
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



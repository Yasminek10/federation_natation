# backend/championnats.py
from flask import Blueprint, jsonify
from db import db
from db import Championnat, Epreuve, ResultatBase, ResultatIndividuel, ResultatRelais, Nageur, Equipe, CEC

champ_bp = Blueprint("champ", __name__, url_prefix="/api/championnats")

# Liste des championnats
@champ_bp.get("/")
def list_championnats():
    championnats = Championnat.query.all()
    return jsonify([
        {
            "id": c.champ_id,
            "nom": c.nom,
            "saison": c.saison,
            "lieu": c.lieu,
            "datedeb": c.datedeb.isoformat(),
            "datefin": c.datefin.isoformat()
        }
        for c in championnats
    ])

# Liste des épreuves d’un championnat
@champ_bp.get("/<int:champ_id>/epreuves")
def list_epreuves(champ_id):
    epreuves = (
        db.session.query(Epreuve)
        .join(CEC, CEC.epreuve_id == Epreuve.epreuve_id)
        .filter_by(champ_id=champ_id)
        .all()
    )
    return jsonify([
        {
            "id": e.epreuve_id,
            "nage": e.nage,
            "distance": e.distance,
            "genre": e.genre,
            "is_relay": e.is_relay
        }
        for e in epreuves
    ])

# Résultats d’une épreuve
@champ_bp.get("/epreuves/<int:epreuve_id>/resultats")
def list_resultats(epreuve_id):
    resultats = (
        db.session.query(ResultatBase, Nageur.nom, Nageur.prenom)
        .join(ResultatIndividuel, ResultatBase.resultat_id == ResultatIndividuel.resultat_id)
        .join(Nageur, ResultatIndividuel.id_nageur == Nageur.id_nageur)
        .filter(ResultatBase.cec_id.in_(
            db.session.query("cec_id").filter_by(epreuve_id=epreuve_id)
        ))
        .all()
    )
    return jsonify([
        {
            "place": r.ResultatBase.place,
            "temps": r.ResultatBase.temps,
            "points": r.ResultatBase.points,
            "nom": r.nom,
            "prenom": r.prenom
        }
        for r in resultats
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

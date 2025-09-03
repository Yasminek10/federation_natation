from flask import Blueprint, jsonify
from db import db
from db import ResultatBase, ResultatIndividuel, ResultatRelais, Nageur, Equipe,CEC,Club,Epreuve
from sqlalchemy.orm import aliased

results_bp = Blueprint("results", __name__, url_prefix="/api/epreuves")
res_indiv = aliased(ResultatIndividuel)
res_relais = aliased(ResultatRelais)
@results_bp.get("/<int:epreuve_id>/resultats")
def get_resultats(epreuve_id):
    # Sous-requête : récupérer tous les CEC liés à l'épreuve
    cec_subq = (
        db.session.query(CEC.cec_id)
        .filter(CEC.epreuve_id == epreuve_id)
        .subquery()
    )

    # Résultats avec jointure sur les nageurs
  

    resultats = (
    db.session.query(
        ResultatBase.resultat_id,
        ResultatBase.place,
        ResultatBase.points,
        ResultatBase.temps,
        ResultatBase.statut,
        Nageur.nom.label("nom"),
        Nageur.prenom.label("prenom"),
        Club.nom.label("club"),
        Epreuve.distance,
        Epreuve.nage,
        Epreuve.genre,
    )
    # Joins for individuels
    .outerjoin(res_indiv, res_indiv.resultat_id == ResultatBase.resultat_id)
    .outerjoin(Nageur, Nageur.id_nageur == res_indiv.id_nageur)

    # Joins for relais
    .outerjoin(res_relais, res_relais.resultat_id == ResultatBase.resultat_id)
    .outerjoin(Equipe, Equipe.equipe_id == res_relais.equipe_id)
    .outerjoin(Club, Club.id_club == Equipe.id_club)

    # Join epreuve
    .join(CEC, CEC.cec_id == ResultatBase.cec_id)
    .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)

    .filter(ResultatBase.cec_id.in_(cec_subq))
    .all()
)

    res_list = []
    for r in resultats:
        res = {
    "id": r.resultat_id,
    "place": r.place,
    "points": r.points,
    "temps": r.temps,
    "statut": r.statut,
    "nom": r.nom,
    "prenom": r.prenom,
    "club": r.club,
    "distance": r.distance,
    "nage": r.nage,
    "genre": r.genre,
}
        res_list.append(res)

    return jsonify(res_list)

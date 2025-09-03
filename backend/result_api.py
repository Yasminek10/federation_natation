from flask import Blueprint, jsonify
from db import db
from db import ResultatBase, ResultatIndividuel, ResultatRelais, Nageur, Equipe, CEC, Club, Epreuve, Categorie
from sqlalchemy.orm import aliased

results_yass_bp = Blueprint("results_yass", __name__, url_prefix="/api/epreuves")

# Aliases
res_indiv = aliased(ResultatIndividuel)
res_relais = aliased(ResultatRelais)
ClubIndiv = aliased(Club)
ClubRelais = aliased(Club)


@results_yass_bp.get("/<int:epreuve_id>/resultats")
def get_resultats(epreuve_id):
    # Sous-requête : récupérer tous les CEC liés à l'épreuve
    cec_subq = (
        db.session.query(CEC.cec_id)
        .filter(CEC.epreuve_id == epreuve_id)
        .subquery()
    )

    # Résultats (individuels + relais)
    resultats = (
        db.session.query(
            ResultatBase.resultat_id,
            ResultatBase.place,
            ResultatBase.points,
            ResultatBase.temps,
            ResultatBase.statut,
            Nageur.nom.label("nom"),
            Nageur.prenom.label("prenom"),
            ClubIndiv.nom.label("club_indiv"),   # club du nageur
            ClubRelais.nom.label("club_relais"), # club de l’équipe
            Epreuve.distance,
            Epreuve.nage,
            Epreuve.genre,
            Categorie.nom.label("categorie"),    # 🔥 ajout catégorie
        )
        # Individuels
        .outerjoin(res_indiv, res_indiv.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Nageur, Nageur.id_nageur == res_indiv.id_nageur)
        .outerjoin(ClubIndiv, ClubIndiv.id_club == Nageur.id_club)

        # Relais
        .outerjoin(res_relais, res_relais.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Equipe, Equipe.equipe_id == res_relais.equipe_id)
        .outerjoin(ClubRelais, ClubRelais.id_club == Equipe.id_club)

        # Epreuve + Categorie via CEC
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)  # 🔥 ici

        .filter(ResultatBase.cec_id.in_(cec_subq))
        .all()
    )

    # Transformer les résultats
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
            "club": r.club_indiv or r.club_relais,
            "distance": r.distance,
            "nage": r.nage,
            "genre": r.genre,
            "categorie": r.categorie,  # 🔥 on ajoute dans la réponse JSON
        }
        res_list.append(res)

    return jsonify(res_list)
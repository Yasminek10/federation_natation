from flask import Blueprint, jsonify
from db import db, Club, Nageur, ResultatIndividuel, ResultatBase, CEC, Epreuve
from system_date import get_categorie_from_birth_year

nageurs_bp = Blueprint("nageurs", __name__, url_prefix="/api/nageurs")

# Liste globale des nageurs
@nageurs_bp.route("/", methods=["GET"])
def get_all_nageurs():
    nageurs = db.session.query(Nageur).all()

    data = []
    for n in nageurs:
        # Récupérer une épreuve jouée (si dispo) pour trouver le genre
        genre = None
        if n.resultats_individuels:
            ri = n.resultats_individuels[0]
            if ri.base and ri.base.cec and ri.base.cec.epreuve:
                genre = ri.base.cec.epreuve.genre
        
        # Calcul de la catégorie en fonction de l’âge
        categorie = get_categorie_from_birth_year(n.birth_year)

        data.append({
            "id": n.id_nageur,
            "nom": n.nom,
            "prenom": n.prenom,
            "full_name": f"{n.prenom} {n.nom}",
            "nationalite": n.nationalite,
            "birth_year": n.birth_year,
            "eligible": n.eligible_points,
            "genre": "F" if genre == "Dames" else "M",
            "categorie": categorie,
            "id_club": n.id_club,
            "club_nom": n.club.nom if n.club else None  # 👈 ajoute le nom du club si dispo
        })

    return jsonify(data)

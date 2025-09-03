from flask import Blueprint, jsonify
from db import db, Club, Nageur, ResultatIndividuel, ResultatBase, CEC, Epreuve
from system_date import get_categorie_from_birth_year
clubs_bp = Blueprint("clubs", __name__, url_prefix="/api/clubs")

@clubs_bp.route("/", methods=["GET"])
def get_clubs():
    clubs = Club.query.all()
    result = []
    for c in clubs:
        # Compter combien de nageurs sont liés à ce club
        nageurs_count = db.session.query(Nageur).filter_by(id_club=c.id_club).count()
        result.append({
            "id": c.id_club,
            "nom": c.nom,
            "nbre_nageurs": nageurs_count
        })
    return jsonify(result)


@clubs_bp.route("/<int:id_club>", methods=["GET"])
def get_club_by_id(id_club):
    club = Club.query.get(id_club)
    return jsonify({
        "id": club.id_club,
        "nom": club.nom

    })


@clubs_bp.route("/<int:club_id>/nageurs", methods=["GET"])
def get_nageurs_by_club(club_id):
    nageurs = (
        db.session.query(Nageur)
        .filter_by(id_club=club_id)
        .all()
    )

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
            "categorie": categorie
        })

    return jsonify(data)

# Liste globale des nageurs
@clubs_bp.route("/nageurs", methods=["GET"])
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
            "id_club": n.id_club  # 👈 tu peux rajouter l’ID du club pour savoir à qui il appartient
        })

    return jsonify(data)
from flask import Blueprint, jsonify
from sqlalchemy import case, func, cast, String
from db import (db, Club, Nageur, ResultatIndividuel, ResultatBase, CEC, Epreuve,Championnat, Categorie, ResultatRelais, Equipe )

from system_date import get_categorie_from_birth_year
from system_date import extraire_nom_annee

clubs_bp = Blueprint("clubs", __name__, url_prefix="/api/clubs")

# ===============================
# Liste des clubs avec nombre de nageurs
# ===============================
@clubs_bp.route("/", methods=["GET"])
def get_clubs():
    clubs = Club.query.all()
    result = []
    for c in clubs:
        nageurs_count = db.session.query(Nageur).filter_by(id_club=c.id_club).count()
        result.append({
            "public_id": str(c.public_id),
            "nom": c.nom,
            "nbre_nageurs": nageurs_count
        })
    return jsonify(result)

# ===============================
# Détails d’un club
# ===============================
@clubs_bp.route("/<uuid:public_id>", methods=["GET"])
def get_club_by_id(public_id):
    club = Club.query.filter_by(public_id=public_id).first_or_404()
    return jsonify({
        "public_id": str(club.public_id),
        "nom": club.nom
    })

# ===============================
# Liste des nageurs d’un club
# ===============================
@clubs_bp.route("/<uuid:public_id>/nageurs", methods=["GET"])
def get_nageurs_by_club(public_id):
    club = Club.query.filter_by(public_id=public_id).first_or_404()
    nageurs = Nageur.query.filter_by(id_club=club.id_club).all()
    data = []
    for n in nageurs:
        genre = None
        if n.resultats_individuels:
            ri = n.resultats_individuels[0]
            if ri.base and ri.base.cec and ri.base.cec.epreuve:
                genre = ri.base.cec.epreuve.genre

        categorie = get_categorie_from_birth_year(n.birth_year)

        data.append({
            "id": n.id_nageur,
            "public_id": n.public_id,
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

# ===============================
# Liste globale des nageurs
# ===============================
@clubs_bp.route("/nageurs", methods=["GET"])
def get_all_nageurs():
    nageurs = db.session.query(Nageur).all()

    data = []
    for n in nageurs:
        genre = None
        if n.resultats_individuels:
            ri = n.resultats_individuels[0]
            if ri.base and ri.base.cec and ri.base.cec.epreuve:
                genre = ri.base.cec.epreuve.genre

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
            "id_club": n.id_club
        })

    return jsonify(data)

# ===============================
# Analyses globales
# ===============================
# ===============================
# Analyses par club
# ===============================
@clubs_bp.route("/<uuid:public_id>/analyses", methods=["GET"])
def analyses_par_club(public_id):
    club = Club.query.filter_by(public_id=public_id).first_or_404()
    id_club = club.id_club
    # 1. Médailles par genre
    medailles_par_genre = (
        db.session.query(
            Epreuve.genre,
            func.count(ResultatBase.resultat_id).label("nb_medailles")
        )
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
        .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
        .filter(ResultatBase.place.in_([1, 2, 3]))
        .filter(Nageur.id_club == id_club)
        .group_by(Epreuve.genre)
        .all()
    )

    # 2. Médailles par catégorie
    medailles_par_categorie = (
        db.session.query(
            Categorie.nom.label("categorie"),
            func.count(ResultatBase.resultat_id).label("nb_medailles")
        )
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
        .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
        .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
        .filter(ResultatBase.place.in_([1, 2, 3]))
        .filter(Nageur.id_club == id_club)
        .group_by(Categorie.nom)
        .all()
    )

    # 3. Médailles par type de nage
    medailles_par_nage = (
        db.session.query(
            Epreuve.nage,
            func.count(ResultatBase.resultat_id).label("nb_medailles")
        )
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
        .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
        .filter(ResultatBase.place.in_([1, 2, 3]))
        .filter(Nageur.id_club == id_club)
        .group_by(Epreuve.nage)
        .all()
    )

    # 4. Médailles par saison
    classement_par_saison = (
        db.session.query(
            Championnat.saison.label("saison"),
            func.count(ResultatBase.resultat_id).label("medailles")
        )
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Championnat, Championnat.champ_id == CEC.champ_id)
        .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
        .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
        .filter(ResultatBase.place.in_([1, 2, 3]))
        .filter(Nageur.id_club == id_club)
        .group_by(Championnat.saison)
        .order_by(Championnat.saison)
        .all()
    )

    classement_par_saison_data = [
        {"saison": c[0], "medailles": c[1]} for c in classement_par_saison
    ]
   
    females, males = [], []

    for n in club.nageurs:
        points_total = sum([ri.base.points for ri in n.resultats_individuels if ri.base and ri.base.points])
        full_name = f"{n.prenom} {n.nom}"
        if n.resultats_individuels and n.resultats_individuels[0].base and n.resultats_individuels[0].base.cec and n.resultats_individuels[0].base.cec.epreuve:
            genre = n.resultats_individuels[0].base.cec.epreuve.genre
        else:
            genre = "M"  # par défaut

        entry = {"id": n.id_nageur, "full_name": full_name, "points_total": points_total}

        if genre == "Dames" or genre == "F":
            females.append(entry)
        else:
            males.append(entry)

    top_females = sorted(females, key=lambda x: x["points_total"], reverse=True)[:10]
    top_males = sorted(males, key=lambda x: x["points_total"], reverse=True)[:10]
# 5. Médailles d’or en relais
    relais_or = (
         db.session.query(ResultatBase, Epreuve, Categorie, Championnat)
         .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
         .join(Equipe, Equipe.equipe_id == ResultatRelais.equipe_id)
          .join(CEC, CEC.cec_id == ResultatBase.cec_id)
         .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
         .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
         .join(Championnat, Championnat.champ_id == CEC.champ_id)
         .filter(Equipe.id_club == id_club)
         .filter(ResultatBase.place == 1)
         .filter(Epreuve.is_relay == True)
        .all()
    )

    relais_or_data = [
    {
        "epreuve": f"{'{}x'.format(r[1].legs_count) if r[1].is_relay else ''}{r[1].distance}m {r[1].nage} ({r[1].genre})",
        "categorie": r[2].nom,
        "saison": r[3].saison,
        "temps": r[0].temps,
        "competition": extraire_nom_annee(r[3]),   # 🔥 utilise la fonction
    }
    for r in relais_or
]

    return jsonify({
        "medailles_par_genre": [
            {"genre": r[0], "nb_medailles": r[1]} for r in medailles_par_genre
        ],
        "classement_par_saison": classement_par_saison_data,
        "medailles_par_categorie": [
            {"categorie": r[0], "nb_medailles": r[1]} for r in medailles_par_categorie
        ],
        "medailles_par_nage": [
            {"nage": r[0], "nb_medailles": r[1]} for r in medailles_par_nage
        ],
        "top_females": top_females,
        "top_males": top_males,        
        "relais_or": relais_or_data,
        "club_name": club.nom if club else "Club inconnu"

    })

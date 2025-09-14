from flask import Blueprint, jsonify
from sqlalchemy import func, and_
from db import db
from db import ResultatBase, ResultatIndividuel, ResultatRelais, Nageur, Equipe, CEC, Club, Epreuve, Categorie, Minimas
from sqlalchemy.orm import aliased

results_yass_bp = Blueprint("results_yass", __name__, url_prefix="/api/epreuves")

# Aliases
res_indiv = aliased(ResultatIndividuel)
res_relais = aliased(ResultatRelais)
ClubIndiv = aliased(Club)
ClubRelais = aliased(Club)


def convert_time_to_seconds(time_str: str):
    if not time_str:
        return None
    s = time_str.strip().replace(",", ".")
    if ":" in s:
        try:
            minutes, sec = s.split(":", 1)
            return int(minutes) * 60 + float(sec)
        except:
            return None
    try:
        return float(s)
    except:
        return None


# === Route 1 : résultats détaillés ===
@results_yass_bp.get("/<int:epreuve_id>/resultats")
def get_resultats(epreuve_id):
    cec_subq = (
        db.session.query(CEC.cec_id)
        .filter(CEC.epreuve_id == epreuve_id)
        .subquery()
    )

    resultats = (
        db.session.query(
            ResultatBase.resultat_id,
            ResultatBase.place,
            ResultatBase.points,
            ResultatBase.temps,
            ResultatBase.statut,
            Nageur.nom.label("nom"),
            Nageur.prenom.label("prenom"),
            ClubIndiv.nom.label("club_indiv"),
            ClubRelais.nom.label("club_relais"),
            Epreuve.distance,
            Epreuve.nage,
            Epreuve.genre,
            Categorie.nom.label("categorie"),
        )
        .outerjoin(res_indiv, res_indiv.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Nageur, Nageur.id_nageur == res_indiv.id_nageur)
        .outerjoin(ClubIndiv, ClubIndiv.id_club == Nageur.id_club)
        .outerjoin(res_relais, res_relais.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Equipe, Equipe.equipe_id == res_relais.equipe_id)
        .outerjoin(ClubRelais, ClubRelais.id_club == Equipe.id_club)
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
        .filter(ResultatBase.cec_id.in_(cec_subq))
        .all()
    )

    res_list = []
    for r in resultats:
        res_list.append({
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
            "categorie": r.categorie,
        })

    return jsonify(res_list)


# === Route 2 : cumul des points ===
@results_yass_bp.get("/<int:epreuve_id>/resultats_cumul")
def get_resultats_cumul(epreuve_id):
    cec_subq = (
        db.session.query(CEC.cec_id)
        .filter(CEC.epreuve_id == epreuve_id)
        .subquery()
    )

    resultats = (
        db.session.query(
            ResultatBase.points,
            ResultatBase.place,
            ResultatBase.temps,
            Nageur.nationalite,
            ClubIndiv.nom.label("club_indiv"),
            ClubRelais.nom.label("club_relais"),
            Categorie.max_places_indiv,
            Categorie.max_places_relay,
            Minimas.temp_min,
        )
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
        .outerjoin(res_indiv, res_indiv.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Nageur, Nageur.id_nageur == res_indiv.id_nageur)
        .outerjoin(ClubIndiv, ClubIndiv.id_club == Nageur.id_club)
        .outerjoin(res_relais, res_relais.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Equipe, Equipe.equipe_id == res_relais.equipe_id)
        .outerjoin(ClubRelais, ClubRelais.id_club == Equipe.id_club)
        .outerjoin(
            Minimas,
            and_(
                Minimas.epreuve_id == Epreuve.epreuve_id,
                Minimas.categorie_id == Categorie.categorie_id,
            ),
        )
        .filter(ResultatBase.cec_id.in_(cec_subq))
        .all()
    )

    cumul = {}
    for r in resultats:
        club_name = r.club_indiv or r.club_relais
        if not club_name:
            continue

        # 1. Vérif places max
        if r.place is None:
            continue
        max_places = r.max_places_indiv or r.max_places_relay
        if max_places and r.place > max_places:
            continue

        # 2. Vérif nationalité
        if r.nationalite and r.nationalite.strip().upper() != "TUN":
            continue

        # 3. Vérif minimas
        nageur_time = convert_time_to_seconds(r.temps)
        min_time = convert_time_to_seconds(r.temp_min)
        if min_time and (nageur_time is None or nageur_time > min_time):
            continue

        cumul[club_name] = cumul.get(club_name, 0) + (r.points or 0)

    cumul_list = [
        {"club": club, "points_cumules": points}
        for club, points in sorted(cumul.items(), key=lambda x: x[1], reverse=True)
    ]

    return jsonify(cumul_list)

@results_yass_bp.get("/statistiques/cumul")
def get_stats_cumul():
    resultats = (
        db.session.query(
            ResultatBase.points,
            ResultatBase.place,
            ResultatBase.temps,
            Nageur.nationalite,
            Epreuve.distance,
            Epreuve.nage,
            Epreuve.genre,
            Categorie.max_places_indiv,
            Categorie.max_places_relay,
            Minimas.temp_min,
        )
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
        .outerjoin(res_indiv, res_indiv.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Nageur, Nageur.id_nageur == res_indiv.id_nageur)
        .outerjoin(res_relais, res_relais.resultat_id == ResultatBase.resultat_id)
        .outerjoin(Equipe, Equipe.equipe_id == res_relais.equipe_id)
        .outerjoin(
            Minimas,
            and_(
                Minimas.epreuve_id == Epreuve.epreuve_id,
                Minimas.categorie_id == Categorie.categorie_id,
            ),
        )
        .all()
    )

    cumul = {}
    for r in resultats:
        key = (r.distance, r.nage)

        # === Conditions ===
        if r.place is None:
            continue
        max_places = r.max_places_indiv or r.max_places_relay
        if max_places and r.place > max_places:
            continue
        if r.nationalite and r.nationalite.strip().upper() != "TUN":
            continue
        nageur_time = convert_time_to_seconds(r.temps)
        min_time = convert_time_to_seconds(r.temp_min)
        if min_time and (nageur_time is None or nageur_time > min_time):
            continue

        # Ajouter au cumul
        if key not in cumul:
            cumul[key] = {"distance": r.distance, "nage": r.nage, "dames": 0, "messieurs": 0}

        if r.genre and r.genre.strip().upper().startswith("DAM"):
            cumul[key]["dames"] += r.points or 0
        else:
            cumul[key]["messieurs"] += r.points or 0

    return jsonify(list(cumul.values()))

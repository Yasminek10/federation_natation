from flask import Blueprint, jsonify
from sqlalchemy import func, and_
from db import db
from db import (
    ResultatBase, EquipeMembre, ResultatIndividuel, ResultatRelais,
    Nageur, Equipe, CEC, Club, Epreuve, Categorie, Minimas
)
from sqlalchemy.orm import aliased
from ingest import time_to_seconds, seconds_to_str, is_tunisian  # helpers existants

results_yass_bp = Blueprint("results_yass", __name__, url_prefix="/api/epreuves")

# Aliases
res_indiv = aliased(ResultatIndividuel)
res_relais = aliased(ResultatRelais)
ClubIndiv = aliased(Club)
ClubRelais = aliased(Club)

# ========================
#   Fonctions utilitaires
# ========================
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


def _is_eligible_swimmer(n: Nageur) -> bool:
    return (is_tunisian(n.nationalite) or bool(n.eligible_points))


def _meet_minima(epreuve_id: int, categorie_id: int, temps: str | None) -> bool:
    if not temps:
        return False
    m = Minimas.query.filter_by(epreuve_id=epreuve_id, categorie_id=categorie_id).first()
    if not m:
        return True
    t = time_to_seconds(temps)
    tm = time_to_seconds(m.temp_min)
    return (t is not None and tm is not None and t <= tm)


def _cap(val, default):
    try:
        return int(val) if val is not None else int(default)
    except:
        return int(default)


# ========================
#   ROUTE 1 : Résultats détaillés
# ========================
@results_yass_bp.get("/<uuid:public_id>/resultats")
def get_resultats(public_id):
    """
    Récupère les résultats pour une épreuve donnée via son UUID.
    """
    epreuve = Epreuve.query.filter_by(public_id=public_id).first_or_404()

    cec_subq = (
        db.session.query(CEC.cec_id)
        .filter(CEC.epreuve_id == epreuve.epreuve_id)
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
            Equipe.equipe_id.label("equipe_id")
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
        if r.nom:
            # Individuel
            res_list.append({
                "id": r.resultat_id,
                "place": r.place,
                "points": r.points,
                "temps": r.temps,
                "statut": r.statut,
                "nom": r.nom,
                "prenom": r.prenom,
                "club": r.club_indiv,
                "distance": r.distance,
                "nage": r.nage,
                "genre": r.genre,
                "categorie": r.categorie,
            })
        elif r.equipe_id:
            # Relais
            nageurs = (
                db.session.query(Nageur.nom, Nageur.prenom)
                .join(EquipeMembre, EquipeMembre.nageur_id == Nageur.id_nageur)
                .filter(EquipeMembre.equipe_id == r.equipe_id)
                .order_by(EquipeMembre.leg_order)
                .all()
            )
            for n in nageurs:
                res_list.append({
                    "id": r.resultat_id,
                    "place": r.place,
                    "points": r.points,
                    "temps": r.temps,
                    "statut": r.statut,
                    "nom": n.nom,
                    "prenom": n.prenom,
                    "club": r.club_indiv or r.club_relais,
                    "distance": r.distance,
                    "nage": r.nage,
                    "genre": r.genre,
                    "categorie": r.categorie,
                })

    return jsonify(res_list)


# ========================
#   ROUTE 2 : Cumul des points
# ========================
@results_yass_bp.get("/<uuid:public_id>/resultats_cumul")
def get_resultats_cumul(public_id):
    """
    Calcule le cumul des points pour une épreuve donnée (UUID).
    """
    epreuve = Epreuve.query.filter_by(public_id=public_id).first_or_404()

    cec_subq = (
        db.session.query(CEC.cec_id)
        .filter(CEC.epreuve_id == epreuve.epreuve_id)
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

        cumul[club_name] = cumul.get(club_name, 0) + (r.points or 0)

    cumul_list = [
        {"club": club, "points_cumules": points}
        for club, points in sorted(cumul.items(), key=lambda x: x[1], reverse=True)
    ]

    return jsonify(cumul_list)


# ========================
#   ROUTE 3 : Statistiques cumulées par championnat (UUID)
# ========================
@results_yass_bp.get("/statistiques/cumul/<uuid:public_id>")
def get_stats_cumul(public_id):
    """
    Calcule les statistiques cumulées par épreuve pour un championnat (UUID).
    """
    from db import Championnat

    champ = Championnat.query.filter_by(public_id=public_id).first_or_404()
    cumul = {}

    cecs = (
        db.session.query(CEC)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .join(Categorie, Categorie.categorie_id == CEC.categorie_id)
        .filter(CEC.champ_id == champ.champ_id)
        .all()
    )

    for cec in cecs:
        epr = cec.epreuve
        cat = cec.categorie

        # === Relais ===
        if epr.is_relay:
            cap = _cap(cat.max_places_relay, 8)
            q = (
                db.session.query(ResultatBase, ResultatRelais, Equipe)
                .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
                .join(Equipe, Equipe.equipe_id == ResultatRelais.equipe_id)
                .filter(
                    ResultatBase.cec_id == cec.cec_id,
                    ResultatBase.statut == "OK",
                    ResultatBase.place.isnot(None),
                    ResultatBase.place <= cap,
                )
            )

            for base, _, eq in q:
                if not _meet_minima(epr.epreuve_id, cat.categorie_id, base.temps):
                    continue

                mems = (
                    db.session.query(Nageur)
                    .join(EquipeMembre, EquipeMembre.nageur_id == Nageur.id_nageur)
                    .filter(EquipeMembre.equipe_id == eq.equipe_id)
                    .all()
                )
                if not mems or not all(_is_eligible_swimmer(n) for n in mems):
                    continue

                key = (epr.distance, epr.nage)
                if key not in cumul:
                    cumul[key] = {"distance": epr.distance, "nage": epr.nage, "dames": 0, "messieurs": 0}

                if epr.genre.upper().startswith("DAM"):
                    cumul[key]["dames"] += int(base.points or 0) * 2
                else:
                    cumul[key]["messieurs"] += int(base.points or 0) * 2

        # === Individuels ===
        else:
            cap = _cap(cat.max_places_indiv, 8)
            q = (
                db.session.query(ResultatBase, ResultatIndividuel, Nageur)
                .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
                .filter(
                    ResultatBase.cec_id == cec.cec_id,
                    ResultatBase.statut == "OK",
                    ResultatBase.place.isnot(None),
                    ResultatBase.place <= cap,
                )
            )

            for base, _, nageur in q:
                if not _is_eligible_swimmer(nageur):
                    continue
                if not _meet_minima(epr.epreuve_id, cat.categorie_id, base.temps):
                    continue

                key = (epr.distance, epr.nage)
                if key not in cumul:
                    cumul[key] = {"distance": epr.distance, "nage": epr.nage, "dames": 0, "messieurs": 0}

                if epr.genre.upper().startswith("DAM"):
                    cumul[key]["dames"] += int(base.points or 0)
                else:
                    cumul[key]["messieurs"] += int(base.points or 0)

    return jsonify(list(cumul.values()))

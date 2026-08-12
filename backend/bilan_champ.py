from flask import Blueprint, jsonify
from db import db, Championnat
from bilan import _meet_minima, _is_eligible_swimmer

bilan_clubs_bp = Blueprint("bilan_clubs", __name__, url_prefix="/api/bilan")

@bilan_clubs_bp.route("/cumul_points_clubs/<uuid:public_id>", methods=["GET"])
def cumul_points_clubs(public_id):
    """
    Retourne le cumul des points par club pour un championnat spécifique et chaque catégorie.
    Règles :
    - Individuels : place ≤ max_place_indiv et temps ≤ minima
    - Relais : place ≤ max_place_relay (ou 8) et temps ≤ minima
    - Nageurs éligibles uniquement
    - Points ×2 pour les relais
    """
    champ = Championnat.query.filter_by(public_id=public_id).first()
    if not champ:
        return jsonify({"error": "Championnat introuvable"}), 404

    def format_epreuve(epreuve):
        if not epreuve.is_relay:
            return f"{epreuve.distance} m {epreuve.nage} {epreuve.genre}"
        if epreuve.legs_count:
            return f"{epreuve.legs_count} x {epreuve.distance} m Relais {epreuve.nage} {epreuve.genre}"
        return f"{epreuve.distance} m Relais {epreuve.nage} {epreuve.genre}"

    categories_points = {}  

    for cec in champ.cecs:
        epreuve = cec.epreuve
        categorie = cec.categorie
        cat_nom = categorie.nom

        if cat_nom not in categories_points:
            categories_points[cat_nom] = {}

        cumul_points = categories_points[cat_nom]

        def club_bucket(club_nom):
            return cumul_points.setdefault(club_nom, {
                "points_individuels": 0,
                "points_relais_bruts": 0,
                "points_relais": 0,
                "details": [],
            })

        max_places_indiv = categorie.max_places_indiv or 8
        max_places_relay = categorie.max_places_relay or 8

        # === Résultats individuels ===
        for res_base in cec.resultats_base:
            if not res_base.resultat_individuel:
                continue

            nageur = res_base.resultat_individuel.nageur

            if (
                res_base.statut != "OK"
                or res_base.place is None
                or res_base.place > max_places_indiv
                or not _is_eligible_swimmer(nageur)
                or not _meet_minima(
                    epreuve.epreuve_id,
                    categorie.categorie_id,
                    res_base.temps
                )
            ):
                continue

            club = nageur.club
            if club:
                points = res_base.points or 0
                bucket = club_bucket(club.nom)
                bucket["points_individuels"] += points
                bucket["details"].append({
                    "epreuve": format_epreuve(epreuve),
                    "participant": f"{nageur.nom} {nageur.prenom}",
                    "type": "Individuel",
                    "points_bruts": points,
                    "points": points,
                })

        # === Résultats relais ===
        for res_base in cec.resultats_base:
            if not res_base.resultat_relais:
                continue

            equipe = res_base.resultat_relais.equipe
            club = equipe.club

            if (
                res_base.statut != "OK"
                or res_base.place is None
                or res_base.place > max_places_relay
                or not _meet_minima(
                    epreuve.epreuve_id,
                    categorie.categorie_id,
                    res_base.temps
                )
            ):
                continue

            if not all(_is_eligible_swimmer(m.nageur) for m in equipe.membres):
                continue

            if club:
                points_bruts = res_base.points or 0
                bucket = club_bucket(club.nom)
                bucket["points_relais_bruts"] += points_bruts
                bucket["points_relais"] += points_bruts * 2
                bucket["details"].append({
                    "epreuve": format_epreuve(epreuve),
                    "participant": f"\u00c9quipe {club.nom}",
                    "type": "Relais x2",
                    "points_bruts": points_bruts,
                    "points": points_bruts * 2,
                })

    # === Construire le résultat détaillé ===
    categories_list = []
    for cat_nom, clubs_points in categories_points.items():
        for details in clubs_points.values():
            details["details"].sort(key=lambda row: row["points"], reverse=True)
        classement = sorted(
            (
                {
                    "club": club,
                    **details,
                    "points": details["points_individuels"] + details["points_relais"],
                }
                for club, details in clubs_points.items()
            ),
            key=lambda x: x["points"],
            reverse=True,
        )
        categories_list.append({
            "categorie": cat_nom,
            "classement": classement
        })

    result = {
        "id": champ.champ_id,
        "public_id": champ.public_id,
        "championnat": champ.nom,
        "saison": champ.saison,
        "datedeb": champ.datedeb.isoformat() if champ.datedeb else None,
        "datefin": champ.datefin.isoformat() if champ.datefin else None,
        "categories": categories_list
    }

    return jsonify(result)

from datetime import datetime
from flask import Blueprint, jsonify
from db import db, Nageur
from system_date import get_categorie_from_birth_year

nageurs_bp = Blueprint("nageurs", __name__, url_prefix="/api/nageurs")
nageursDetails_bp = Blueprint("nageursDetails", __name__, url_prefix="/api/nageursDetails")

# ==============================
# Liste globale des nageurs
# ==============================
@nageurs_bp.route("/", methods=["GET"])
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
            "id_club": n.id_club,
            "club_nom": n.club.nom if n.club else None
        })

    return jsonify(data)


# ==============================
# Détails d’un nageur
# ==============================
@nageursDetails_bp.route("/<int:nageur_id>", methods=["GET"])
def get_nageur_details(nageur_id):
    nageur = Nageur.query.get(nageur_id)
    if not nageur:
        return jsonify({"error": "Nageur introuvable"}), 404

    # --- Fonctions utilitaires ---
    def temps_to_seconds(temps_str):
        if not temps_str:
            return None
        temps_str = temps_str.strip().lower()
        invalid_values = ["dsq", "disq", "disqualifié", "n.d.", "nd", "frf", "forfait"]
        if any(bad in temps_str for bad in invalid_values):
            return None
        try:
            if ":" in temps_str:
                minutes, secondes = temps_str.split(":")
                return float(minutes) * 60 + float(secondes)
            return float(temps_str)
        except ValueError:
            return None

    def seconds_to_temps(seconds):
        if seconds is None:
            return None
        if seconds >= 60:
            minutes = int(seconds // 60)
            sec = seconds % 60
            return f"{minutes}:{sec:05.2f}"
        else:
            return f"{seconds:.2f}"

    def extraire_nom_annee(championnat):
        nom_champ = championnat.nom if championnat.nom else "Inconnu"
        try:
            annee = championnat.datedeb.year
        except Exception as e:
            print("Erreur extraire_nom_annee:", e)
            annee = "Inconnue"
        return f"{nom_champ} ({annee})"

    # --- Infos basiques du nageur ---
    nageur_data = {
        "id": nageur.id_nageur,
        "nom": nageur.nom,
        "prenom": nageur.prenom,
        "club": nageur.club.nom if nageur.club else None,
        "nationalite": nageur.nationalite,
        "birth_year": nageur.birth_year,
    }

    # --- Historique individuel ---
    historiques = []
    temps_valides_sec = []
    points = []

    for res_ind in nageur.resultats_individuels:
        base = res_ind.base
        cec = base.cec
        championnat = cec.championnat
        epreuve = cec.epreuve
        categorie = cec.categorie

        sec = temps_to_seconds(base.temps)
        if sec is not None:
            temps_valides_sec.append(sec)
        if base.points:
            points.append(base.points)

        historiques.append({
            "championnat": extraire_nom_annee(championnat),
            "saison": championnat.saison,
            "epreuve": f"{epreuve.distance}m {epreuve.nage} ({epreuve.genre})",
            "categorie": categorie.nom,
            "temps": base.temps,
            "points": base.points,
            "place": base.place,
            "statut": base.statut,
        })

    # --- Résultats relais (uniquement pour ce nageur) ---
    relais_resultats = []

    for membre in nageur.equipes_membre:  
        equipe = membre.equipe
        cec = equipe.cec
        championnat = cec.championnat
        epreuve = cec.epreuve
        categorie = cec.categorie
        seg = temps_to_seconds(membre.split_time)

        relais_resultats.append({
            "championnat": extraire_nom_annee(championnat),
            "saison": championnat.saison,
            "epreuve": f"{epreuve.legs_count}x{epreuve.distance}m {epreuve.nage} ({epreuve.genre})",
            "categorie": categorie.nom,
            "club": equipe.club.nom if equipe.club else None,
            "role": f"Relais {membre.leg_order}",
            "split_time": membre.split_time,
            "temps_segment": seconds_to_temps(seg),
            "temps_total": getattr(equipe, "temps_total", None),
            "place": getattr(equipe, "place", None),
            "statut": getattr(equipe, "statut", None),
        })

    # --- Analyses simples ---
    meilleur_temps_sec = min(temps_valides_sec) if temps_valides_sec else None

    analyses = {
        "nb_courses": len(historiques),
        "meilleur_temps": seconds_to_temps(meilleur_temps_sec) if meilleur_temps_sec else None,
        "points_moyens": sum(points) / len(points) if points else None,
    }

    return jsonify({
        "nageur": nageur_data,
        "historique": historiques,
        "analyses": analyses,
        "relais": relais_resultats
    })

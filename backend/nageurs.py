from flask import Blueprint, jsonify
from db import db, Nageur, ResultatIndividuel, CEC, Championnat, Epreuve, Categorie
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
        """Convertit un temps 'mm:ss.xx' ou 'ss.xx' en secondes float.
           Retourne None si le temps est invalide (ex: DSQ, n.d., Frf, Forfait...).
        """
        if not temps_str:
            return None

        # Normaliser la chaîne
        temps_str = temps_str.strip().lower()

        # Cas non valides
        invalid_values = ["dsq", "disq", "disqualifié", "n.d.", "nd", "frf", "forfait"]
        if any(bad in temps_str for bad in invalid_values):
            return None

        # Conversion si format correct
        try:
            if ":" in temps_str:
                minutes, secondes = temps_str.split(":")
                return float(minutes) * 60 + float(secondes)
            return float(temps_str)
        except ValueError:
            return None

    def seconds_to_temps(seconds):
        """Convertit des secondes float en format 'mm:ss.xx' ou 'ss.xx'."""
        if seconds is None:
            return None
        if seconds >= 60:
            minutes = int(seconds // 60)
            sec = seconds % 60
            return f"{minutes}:{sec:05.2f}"  # format mm:ss.xx
        else:
            return f"{seconds:.2f}"

    # --- Infos basiques du nageur ---
    nageur_data = {
        "id": nageur.id_nageur,
        "nom": nageur.nom,
        "prenom": nageur.prenom,
        "club": nageur.club.nom if nageur.club else None,
        "nationalite": nageur.nationalite,
        "birth_year": nageur.birth_year,
    }

    # --- Historique des résultats ---
    historiques = []
    temps_valides_sec = []
    points = []

    for res_ind in nageur.resultats_individuels:
        base = res_ind.base
        cec = base.cec
        championnat = cec.championnat
        epreuve = cec.epreuve
        categorie = cec.categorie

        # Conversion du temps
        sec = temps_to_seconds(base.temps)
        if sec is not None:
            temps_valides_sec.append(sec)

        if base.points:
            points.append(base.points)

        historiques.append({
            "championnat": championnat.nom,
            "saison": championnat.saison,
            "epreuve": f"{epreuve.distance}m {epreuve.nage} ({epreuve.genre})",
            "categorie": categorie.nom,
            "temps": base.temps,  # garder la valeur brute (ex: DSQ, n.d.)
            "points": base.points,
            "place": base.place,
            "statut": base.statut,
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
    })

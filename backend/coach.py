from flask import Blueprint, jsonify, request, session, g
from db import db, User, Nageur, Seance, Presence, Categorie, Club, Epreuve, SessionTest, ResultatTest, ResultatIndividuel, ResultatBase, CEC
from system_date import get_categorie_from_birth_year  
from datetime import date as dt_date
from functools import lru_cache
import re
import io
import csv
from flask import send_file

coach_bp = Blueprint("coach", __name__, url_prefix="/api/coach")


def parse_temps_to_seconds(temps_str):
    """Convertit un temps (HH:MM:SS.xx ou M.SS.xx ou 1:23.45) en secondes décimales."""
    if not temps_str:
        return None
    s = temps_str.strip().replace(",", ".")
    
    # Formats acceptés :
    # - 1:23.45
    # - 59.87
    # - 1.23.45
    # - 00:01:02.34
    match = re.match(r"(?:(\d+):)?(\d{1,2})[.:](\d{1,2})(?:[.:](\d{1,2}))?", s)
    if not match:
        return None
    
    parts = [int(x) if x else 0 for x in match.groups()]
    if len(parts) == 4:
        h, m, s, cs = parts
        return h * 3600 + m * 60 + s + cs / 100
    elif len(parts) == 3:
        m, s, cs = parts
        return m * 60 + s + cs / 100
    else:
        return None
    

# ======================================================
# 🔹 Helper : récupérer le coach connecté
# ======================================================
def _get_current_coach():
    u = g.get("user") or getattr(g, "user", None)
    if not u and "user" in session:
        u = session["user"]
    if not u:
        return None

    user_id = u.get("id") or u.get("user_id")
    if not user_id:
        return None

    return User.query.get(user_id)


# ======================================================
# 🔹 Récupérer tous les clubs
# ======================================================
@coach_bp.get("/clubs")
def get_clubs():
    clubs = Club.query.order_by(Club.nom).all()
    return jsonify({
        "clubs": [{"id_club": c.id_club, "nom": c.nom} for c in clubs]
    })


# ======================================================
# 🔹 Récupérer les nageurs d’un club avec filtres
# ======================================================
@coach_bp.get("/clubs/<int:club_id>/nageurs_filtres")
def get_nageurs_filtres(club_id):
    categorie_id = request.args.get("categorie_id", type=int)
    search = request.args.get("search", type=str, default="").strip().lower()

    query = Nageur.query.filter_by(id_club=club_id)

    if search:
        query = query.filter(
            db.or_(
                db.func.lower(Nageur.nom).like(f"%{search}%"),
                db.func.lower(Nageur.prenom).like(f"%{search}%"),
            )
        )

    nageurs = query.all()
    coach = _get_current_coach()

    data = []
    for n in nageurs:
        cat_name = get_categorie_from_birth_year(n.birth_year)

        if categorie_id:
            cat = Categorie.query.get(categorie_id)
            if not cat or cat.nom != cat_name:
                continue

        data.append({
            "id_nageur": n.id_nageur,
            "nom": n.nom,
            "prenom": n.prenom,
            "birth_year": n.birth_year,
            "club": n.club.nom if n.club else None,
            "categorie": cat_name,
            "id_coach": n.id_coach,
            "selected": (n.id_coach == coach.user_id if coach else False),
        })

    return jsonify({"nageurs": data})


# ======================================================
# 🔹 Mettre à jour les nageurs encadrés par le coach
# ======================================================
@coach_bp.post("/nageurs/update")
def update_nageurs_coach():
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    data = request.get_json()
    selected_ids = data.get("nageur_ids", [])

    # Enlever les anciens nageurs du coach
    old_nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()
    for n in old_nageurs:
        n.id_coach = None

    # Réassigner les nouveaux
    for nid in selected_ids:
        nageur = Nageur.query.get(nid)
        if nageur:
            nageur.id_coach = coach.user_id

    db.session.commit()
    return jsonify({"message": "Liste des nageurs mise à jour avec succès."})


# ======================================================
# 🔹 Récupérer les nageurs encadrés par le coach
# ======================================================
@coach_bp.get("/nageurs/mine")
def get_nageurs_du_coach():
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()
    if not nageurs:
        return jsonify({"nageurs": [], "club_id": None, "club_nom": None})

    club_id = nageurs[0].id_club
    club = Club.query.get(club_id)

    return jsonify({
        "club_id": club_id,
        "club_nom": club.nom if club else None,
        "nageurs": [
            {
                "id_nageur": n.id_nageur,
                "nom": n.nom,
                "prenom": n.prenom,
                "birth_year": n.birth_year,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "selected": True
            }
            for n in nageurs
        ]
    })


# ======================================================
# 🔹 Récupérer les catégories
# ======================================================
@coach_bp.get("/categories")
def get_categories():
    cats = Categorie.query.order_by(Categorie.nom).all()
    return jsonify({"categories": [{"id": c.categorie_id, "nom": c.nom} for c in cats]})


# ======================================================
# 🔹 Créer ou récupérer une séance
# ======================================================
@coach_bp.post("/seances/get_or_create")
def get_or_create_seance():
    data = request.get_json()
    date_str = data.get("date")
    session_name = data.get("session")
    lieu = data.get("lieu")

    if not date_str or not session_name or not lieu:
        return jsonify({"message": "Date, session et lieu requis"}), 400

    # 🚫 Vérifier si la date est future
    try:
        date_obj = dt_date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"message": "Format de date invalide"}), 400

    if date_obj > dt_date.today():
        return jsonify({"message": "Impossible d’ajouter une séance future."}), 400

    seance = Seance.query.filter_by(date=date_obj, session=session_name, lieu_training=lieu).first()
    if not seance:
        seance = Seance(date=date_obj, session=session_name, lieu_training=lieu)
        db.session.add(seance)
        db.session.commit()

    return jsonify({
        "seance_id": seance.seance_id,
        "date": seance.date.isoformat(),
        "session": seance.session,
        "lieu": seance.lieu_training
    })


# ======================================================
# 🔹 Enregistrer les présences
# ======================================================
@coach_bp.post("/presences/save")
def save_presences():
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    data = request.get_json()
    seance_id = data.get("seance_id")
    presences = data.get("presences", [])

    if not seance_id or not presences:
        return jsonify({"message": "Données incomplètes"}), 400

    nageur_ids = [p["nageur_id"] for p in presences]
    Presence.query.filter(
        Presence.seance_id == seance_id,
        Presence.nageur_id.in_(nageur_ids)
    ).delete(synchronize_session=False)

    for p in presences:
        db.session.add(Presence(
            nageur_id=p["nageur_id"],
            seance_id=seance_id,
            present=p.get("present", True)
        ))

    db.session.commit()
    return jsonify({"message": "Présences enregistrées avec succès."})


# ======================================================
# 🔹 Charger les présences d'une séance donnée
# ======================================================
@coach_bp.get("/presences/by_date")
def get_presences_by_date():
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    date = request.args.get("date")
    session_name = request.args.get("session")

    if not date or not session_name:
        return jsonify({"message": "Date et session requises"}), 400

    seance = Seance.query.filter_by(date=date, session=session_name).first()
    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()

    # ⚙️ Si la séance n’existe pas encore
    if not seance:
        return jsonify({
            "seance_id": None,
            "lieu": "",
            "presences": [
                {
                    "id_nageur": n.id_nageur,
                    "nom": n.nom,
                    "prenom": n.prenom,
                    "categorie": get_categorie_from_birth_year(n.birth_year),
                    "present": True
                }
                for n in nageurs
            ]
        })

    # ⚙️ Si la séance existe déjà
    pres_dict = {p.nageur_id: p.present for p in seance.presences}
    data = [
        {
            "id_nageur": n.id_nageur,
            "nom": n.nom,
            "prenom": n.prenom,
            "categorie": get_categorie_from_birth_year(n.birth_year),
            "present": pres_dict.get(n.id_nageur, True)
        }
        for n in nageurs
    ]

    return jsonify({
        "seance_id": seance.seance_id,
        "date": seance.date.isoformat(),
        "session": seance.session,
        "lieu": seance.lieu_training,   #  ajout du lieu ici
        "presences": data
    })

@coach_bp.get("/presences/export")
def export_presences_completes():
    """Exporter la liste complète des nageurs avec leur présence/absence en CSV."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    date = request.args.get("date")
    session_name = request.args.get("session")
    if not date or not session_name:
        return jsonify({"message": "Date et session requises"}), 400

    seance = Seance.query.filter_by(date=date, session=session_name).first()
    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()

    if not seance:
        # Si la séance n'existe pas encore : tous présents par défaut
        rows = [
            {
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "present": True
            }
            for n in nageurs
        ]
    else:
        # Dictionnaire des présences réelles
        pres_dict = {p.nageur_id: p.present for p in seance.presences}
        rows = [
            {
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "present": pres_dict.get(n.id_nageur, True)
            }
            for n in nageurs
        ]

    #  Génération CSV identique au tableau React
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nom", "Prénom", "Catégorie", "Présence"])
    for r in rows:
        writer.writerow([
            r["nom"],
            r["prenom"],
            r["categorie"],
            "Présent" if r["present"] else "Absent"
        ])

    output.seek(0)
    filename = f"presences_{date}_{session_name}.csv"
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename
    )

@coach_bp.get("/presences/export_periode")
def export_presences_periode():
    """Exporter toutes les absences sur une période (start → end) en CSV."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    start_date = request.args.get("start")
    end_date = request.args.get("end")

    if not start_date or not end_date:
        return jsonify({"message": "Période requise (start et end)"}), 400

    # 🔹 Charger les séances de la période
    seances = (
        Seance.query
        .filter(Seance.date.between(start_date, end_date))
        .order_by(Seance.date.asc(), Seance.session.asc())
        .all()
    )

    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()
    rows = []

    for s in seances:
        pres_dict = {p.nageur_id: p.present for p in s.presences}

        for n in nageurs:
            rows.append({
                "date": s.date.isoformat(),
                "session": s.session,
                "lieu": s.lieu_training,
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "present": pres_dict.get(n.id_nageur, True)
            })

    # 🔹 Génération du CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Session", "Lieu", "Nom", "Prénom", "Catégorie", "Présence"])
    for r in rows:
        writer.writerow([
            r["date"],
            r["session"],
            r["lieu"],
            r["nom"],
            r["prenom"],
            r["categorie"],
            "Présent" if r["present"] else "Absent"
        ])

    output.seek(0)
    filename = f"absences_{start_date}_au_{end_date}.csv"
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename
    )

# ======================================================
# 🔹 Historique des séances du coach
# ======================================================
@coach_bp.get("/seances/history")
def get_seances_history():
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    subquery = (
        db.session.query(Presence.seance_id)
        .join(Nageur, Nageur.id_nageur == Presence.nageur_id)
        .filter(Nageur.id_coach == coach.user_id)
        .distinct()
        .subquery()
    )

    seances = (
        db.session.query(Seance)
        .filter(Seance.seance_id.in_(subquery))
        .order_by(Seance.date.desc(), Seance.session.desc())
        .all()
    )

    return jsonify({
        "seances": [
            {
                "seance_id": s.seance_id,
                "date": s.date.isoformat(),
                "session": s.session,
                "lieu": s.lieu_training
            }
            for s in seances
        ]
    })

@coach_bp.get("/tests/export")
def export_tests_csv():
    """Exporter les résultats d’un test (date + épreuve) en CSV (avec colonne Présence)."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    date_str = request.args.get("date")
    epreuve_id = request.args.get("epreuve_id", type=int)
    if not date_str or not epreuve_id:
        return jsonify({"message": "Date et épreuve requises"}), 400

    epreuve = Epreuve.query.get(epreuve_id)
    if not epreuve:
        return jsonify({"message": "Épreuve introuvable"}), 404

    session_test = SessionTest.query.filter_by(date_test=date_str, epreuve_id=epreuve_id).first()

    rows = []
    if not session_test:
        # Aucun test existant → tous les nageurs du coach (non testés = absents)
        nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()
        rows = [
            {
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "temps": "",
                "present": False
            }
            for n in nageurs
        ]
    else:
        # Charger tous les résultats enregistrés pour cette session
        resultats = (
            db.session.query(
                Nageur.id_nageur,
                Nageur.nom,
                Nageur.prenom,
                Nageur.birth_year,
                ResultatTest.temps
            )
            .join(ResultatTest, ResultatTest.nageur_id == Nageur.id_nageur)
            .filter(ResultatTest.session_test_id == session_test.session_test_id)
            .all()
        )

        ids_resultats = [r.id_nageur for r in resultats]

        # Ajouter les nageurs du coach non encore testés (absents)
        nageurs_restants = (
            Nageur.query.filter_by(id_coach=coach.user_id)
            .filter(~Nageur.id_nageur.in_(ids_resultats))
            .all()
        )

        for r in resultats:
            is_present = bool(r.temps and r.temps.strip() not in ["", "0", "ABS"])
            rows.append({
                "nom": r.nom,
                "prenom": r.prenom,
                "categorie": get_categorie_from_birth_year(r.birth_year),
                "temps": r.temps if r.temps and r.temps != "0" else "",
                "present": is_present
            })

        for n in nageurs_restants:
            rows.append({
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "temps": "",
                "present": False
            })

    # Tri alphabétique
    rows.sort(key=lambda x: (x["nom"].lower(), x["prenom"].lower()))

    # Génération du CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nom", "Prénom", "Catégorie", "Temps", "Présence"])
    for r in rows:
        writer.writerow([
            r["nom"],
            r["prenom"],
            r["categorie"],
            r["temps"],
            "Présent" if r["present"] else "Absent"
        ])

    output.seek(0)
    filename = f"test_{date_str}_{epreuve.distance}m_{epreuve.nage}_{epreuve.genre}.csv"
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename
    )


@coach_bp.get("/tests/epreuves")
def get_epreuves_tests():
    """Liste les épreuves individuelles disponibles (ex: 100m Papillon)."""
    epreuves = (
        Epreuve.query.filter_by(is_relay=False)
        .order_by(Epreuve.distance, Epreuve.nage, Epreuve.genre)
        .all()
    )
    return jsonify({
        "epreuves": [
            {
                "epreuve_id": e.epreuve_id,
                "label": f"{e.distance}m {e.nage} ({e.genre})"
            }
            for e in epreuves
        ]
    })


@coach_bp.get("/tests/by_date_epreuve")
def get_tests_by_date_epreuve():
    """Charge les résultats existants d’un test (date + épreuve)."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    date_str = request.args.get("date")
    epreuve_id = request.args.get("epreuve_id", type=int)

    if not date_str or not epreuve_id:
        return jsonify({"message": "Date et épreuve requises"}), 400

    # 🔹 Récupérer l’épreuve sélectionnée
    epreuve = Epreuve.query.get(epreuve_id)
    if not epreuve:
        return jsonify({"message": "Épreuve introuvable"}), 404

    genre_epreuve = epreuve.genre.lower()  # "dames", "messieurs", ou "mixte"

    # 🔹 Chercher la session existante
    session_test = SessionTest.query.filter_by(date_test=date_str, epreuve_id=epreuve_id).first()

    # ===========================================================
    # CAS 1 : le test existe → on renvoie seulement ses résultats
    # ===========================================================
    if session_test:
        data = []
        for r in session_test.resultats:
            n = Nageur.query.get(r.nageur_id)
            if not n:
                continue
            data.append({
                "id_nageur": n.id_nageur,
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "temps": r.temps if r.temps else "",
                "absence": (r.temps in [None, "", "ABS"])
            })

        return jsonify({
            "session_test_id": session_test.session_test_id,
            "genre_epreuve": epreuve.genre,
            "results": data
        })

    # ===========================================================
    # CAS 2 : aucun test enregistré → filtrer les nageurs du coach
    # ===========================================================
    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()

    # 🔹 Si l’épreuve n’est pas mixte → filtrer selon le genre
    if genre_epreuve != "mixte":
        genre_map = {}

        # Déterminer le genre à partir des épreuves en championnat
        for n in nageurs:
            dernier_resultat = (
                db.session.query(Epreuve.genre)
                .join(CEC, CEC.epreuve_id == Epreuve.epreuve_id)
                .join(ResultatBase, ResultatBase.cec_id == CEC.cec_id)
                .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                .filter(ResultatIndividuel.id_nageur == n.id_nageur)
                .order_by(ResultatBase.resultat_id.desc())
                .first()
            )
            if dernier_resultat:
                genre_map[n.id_nageur] = dernier_resultat[0]

        # Appliquer le filtre genre
        nageurs = [
            n for n in nageurs
            if genre_map.get(n.id_nageur, epreuve.genre) == epreuve.genre
        ]

    # 🔹 Préparer la liste vide (pas encore de résultats)
    return jsonify({
        "session_test_id": None,
        "genre_epreuve": epreuve.genre,
        "results": [
            {
                "id_nageur": n.id_nageur,
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "temps": "",
                "absence": False
            }
            for n in nageurs
        ]
    })


@coach_bp.post("/tests/save")
def save_tests():
    """Créer ou modifier les résultats d’un test technique."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    data = request.get_json()
    date_str = data.get("date")
    epreuve_id = data.get("epreuve_id")
    results = data.get("results", [])

    if not date_str or not epreuve_id:
        return jsonify({"message": "Date et épreuve requises"}), 400

    # Créer ou récupérer la session test
    session_test = SessionTest.query.filter_by(date_test=date_str, epreuve_id=epreuve_id).first()
    if not session_test:
        session_test = SessionTest(date_test=date_str, epreuve_id=epreuve_id)
        db.session.add(session_test)
        db.session.commit()

    # Supprimer les anciens résultats pour les nageurs concernés
    nageur_ids = [r["id_nageur"] for r in results]
    ResultatTest.query.filter(
        ResultatTest.session_test_id == session_test.session_test_id,
        ResultatTest.nageur_id.in_(nageur_ids)
    ).delete(synchronize_session=False)

    #  Filtrer côté back selon le genre de l’épreuve pour éviter les erreurs de front
    epreuve = Epreuve.query.get(epreuve_id)
    if not epreuve:
        return jsonify({"message": "Épreuve introuvable"}), 404

    genre_epreuve = epreuve.genre.lower()

    # Si l’épreuve n’est pas mixte → on garde uniquement les nageurs correspondants
    if genre_epreuve != "mixte":
        genre_map = {}
        for n in Nageur.query.filter_by(id_coach=coach.user_id).all():
            dernier_resultat = (
                db.session.query(Epreuve.genre)
                .join(CEC, CEC.epreuve_id == Epreuve.epreuve_id)
                .join(ResultatBase, ResultatBase.cec_id == CEC.cec_id)
                .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                .filter(ResultatIndividuel.id_nageur == n.id_nageur)
                .order_by(ResultatBase.resultat_id.desc())
                .first()
            )
            if dernier_resultat:
                genre_map[n.id_nageur] = dernier_resultat[0]

        #  Supprime les nageurs du mauvais genre
        results = [
            r for r in results
            if genre_map.get(r["id_nageur"], genre_epreuve.capitalize()) == epreuve.genre
        ]

    # Ajouter les nouveaux
    for r in results:
        temps_val = r.get("temps")
        if not temps_val or str(temps_val).strip() == "":
            temps_val = "0"  # si vide => 0
        db.session.add(ResultatTest(
            nageur_id=r["id_nageur"],
            session_test_id=session_test.session_test_id,
            temps=str(temps_val)
        ))

    db.session.commit()
    return jsonify({"message": "Résultats enregistrés avec succès."})

@coach_bp.get("/tests/history")
def get_tests_history():
    """Renvoie l’historique complet des tests du coach, y compris ceux sans résultats."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    # 🔹 Étape 1 : récupérer tous les tests liés à des nageurs du coach (avec ou sans résultats)
    # On fait une jointure sur SessionTest + Epreuve + (optionnellement) ResultatTest/Nageur
    # pour récupérer aussi les sessions créées mais encore vides
    sessions = (
        db.session.query(SessionTest)
        .join(Epreuve, SessionTest.epreuve_id == Epreuve.epreuve_id)
        .outerjoin(ResultatTest, ResultatTest.session_test_id == SessionTest.session_test_id)
        .outerjoin(Nageur, Nageur.id_nageur == ResultatTest.nageur_id)
        .filter(
            db.or_(
                Nageur.id_coach == coach.user_id,
                ResultatTest.session_test_id.is_(None)  # inclut les tests sans résultat
            )
        )
        .distinct()
        .order_by(SessionTest.date_test.desc())
        .all()
    )

    data = []
    for s in sessions:
        data.append({
            "session_test_id": s.session_test_id,
            "date": s.date_test.isoformat(),
            "epreuve": f"{s.epreuve.distance}m {s.epreuve.nage} ({s.epreuve.genre})"
        })

    return jsonify({"tests": data})

@coach_bp.get("/tests/nageurs_by_genre")
def get_nageurs_by_genre():
    """Renvoie la liste des nageurs filtrés selon le genre de l'épreuve (basé sur les épreuves faites en championnat)."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    epreuve_id = request.args.get("epreuve_id", type=int)
    if not epreuve_id:
        return jsonify({"message": "ID épreuve requis"}), 400

    epreuve = Epreuve.query.get(epreuve_id)
    if not epreuve:
        return jsonify({"message": "Épreuve introuvable"}), 404

    genre_epreuve = epreuve.genre  # "Dames", "Messieurs" ou "Mixte"
    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()

    # Si l'épreuve est mixte, inutile de filtrer
    if genre_epreuve.lower() == "mixte":
        return jsonify({
            "genre_epreuve": genre_epreuve,
            "nageurs": [
                {
                    "id_nageur": n.id_nageur,
                    "nom": n.nom,
                    "prenom": n.prenom,
                    "categorie": get_categorie_from_birth_year(n.birth_year),
                    "temps": ""
                }
                for n in nageurs
            ]
        })

    # =====================================================
    # 🔹 DÉDUCTION DU GENRE VIA LES ÉPREUVES DE CHAMPIONNAT
    # =====================================================
    genre_map = {}

    for n in nageurs:
        dernier_resultat = (
            db.session.query(Epreuve.genre)
            .join(CEC, CEC.epreuve_id == Epreuve.epreuve_id)
            .join(ResultatBase, ResultatBase.cec_id == CEC.cec_id)
            .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
            .filter(ResultatIndividuel.id_nageur == n.id_nageur)
            .order_by(ResultatBase.resultat_id.desc())
            .first()
        )
        if dernier_resultat:
            genre_map[n.id_nageur] = dernier_resultat[0]

    # =====================================================
    # 🔹 Appliquer le filtrage selon le genre
    # =====================================================
    nageurs_filtres = [
        n for n in nageurs
        if genre_map.get(n.id_nageur, genre_epreuve) == genre_epreuve
    ]

    return jsonify({
        "genre_epreuve": genre_epreuve,
        "nageurs": [
            {
                "id_nageur": n.id_nageur,
                "nom": n.nom,
                "prenom": n.prenom,
                "categorie": get_categorie_from_birth_year(n.birth_year),
                "temps": ""
            } for n in nageurs_filtres
        ]
    })


@coach_bp.get("/stats")
def get_stats():
    """Statistiques de performance, d'analyse des absences et classement par moyenne sur la période donnée."""
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404

    start_date = request.args.get("start")
    end_date = request.args.get("end")
    nageur_id = request.args.get("nageur_id", type=int)
    epreuve_label = request.args.get("epreuve_label")

    if not start_date or not end_date:
        return jsonify({"message": "Période requise"}), 400

    # 🔹 Filtrer les nageurs encadrés
    nageurs_filter = [Nageur.id_coach == coach.user_id]
    if nageur_id:
        nageurs_filter.append(Nageur.id_nageur == nageur_id)

    # ======================================================
    # === 1️⃣ Performances individuelles ====================
    # ======================================================
    tests = (
        db.session.query(
            SessionTest.date_test,
            db.func.concat(
                Epreuve.distance,
                "m ",
                Epreuve.nage,
                " (",
                Epreuve.genre,
                ")"
            ).label("label"),
            ResultatTest.temps,
            Nageur.nom,
            Nageur.prenom
        )
        .join(ResultatTest, SessionTest.session_test_id == ResultatTest.session_test_id)
        .join(Nageur, ResultatTest.nageur_id == Nageur.id_nageur)
        .join(Epreuve, SessionTest.epreuve_id == Epreuve.epreuve_id)
        .filter(
            *nageurs_filter,
            SessionTest.date_test.between(start_date, end_date)
        )
        .order_by(SessionTest.date_test)
        .all()
    )

    # Construire performances par épreuve
    perf_data = {}
    for date_test, label, temps, nom, prenom in tests:
        val = parse_temps_to_seconds(temps)
        if val is None:
            continue
        if epreuve_label and label != epreuve_label:
            continue
        if label not in perf_data:
            perf_data[label] = []
        perf_data[label].append({
            "date": date_test.isoformat(),
            "temps": val,
            "nageur": f"{prenom} {nom}"
        })

    # ======================================================
    # === 2️⃣ Analyse des absences ==========================
    # ======================================================
    pres_par_nageur = (
        db.session.query(
            Nageur.id_nageur,
            Nageur.nom,
            Nageur.prenom,
            db.func.sum(db.case((Presence.present == True, 1), else_=0)).label("nb_presences"),
            db.func.sum(db.case((Presence.present == False, 1), else_=0)).label("nb_absences")
        )
        .join(Presence, Presence.nageur_id == Nageur.id_nageur)
        .join(Seance, Presence.seance_id == Seance.seance_id)
        .filter(
            *nageurs_filter,
            Seance.date.between(start_date, end_date)
        )
        .group_by(Nageur.id_nageur, Nageur.nom, Nageur.prenom)
        .all()
    )

    absences_data = []
    for n_id, nom, prenom, pres, abs_ in pres_par_nageur:
        total = (pres or 0) + (abs_ or 0)
        taux = round((pres / total) * 100, 1) if total > 0 else 0
        absences_data.append({
            "nageur": f"{prenom} {nom}",
            "presences": pres or 0,
            "absences": abs_ or 0,
            "taux_presence": taux
        })

    # ======================================================
    # === 3️⃣ Classement par moyenne ========================
    # ======================================================
    classement_data = {}

    # Déterminer si la période couvre plusieurs jours
    multi_jours = start_date != end_date

    # Préparer structure : label → { nageur: [temps...] }
    grouped = {}
    for date_test, label, temps, nom, prenom in tests:
        val = parse_temps_to_seconds(temps)
        if val is None:
            continue
        if epreuve_label and label != epreuve_label:
            continue
        nageur = f"{prenom} {nom}"
        grouped.setdefault(label, {}).setdefault(nageur, []).append(val)

    # Calculer moyenne par nageur
    for label, nageurs_dict in grouped.items():
        moyennes = []
        for nageur, temps_list in nageurs_dict.items():
            if not temps_list:
                continue
            moyenne = (
                sum(temps_list) / len(temps_list)
                if multi_jours and len(temps_list) > 1
                else temps_list[-1]  # si un seul jour → dernier temps
            )
            moyennes.append({"nageur": nageur, "moyenne": moyenne})

        # Trier par moyenne croissante
        moyennes.sort(key=lambda x: x["moyenne"])
        classement_data[label] = moyennes

    # ======================================================
    # === 4️⃣ Retour final =================================
    # ======================================================
    return jsonify({
        "performances": perf_data,
        "absences_detail": absences_data,
        "classements": classement_data
    })


@coach_bp.get("/epreuves")
def get_epreuves():
    """Retourne la liste des épreuves disponibles (pour le sélecteur)."""
    epreuves = Epreuve.query.order_by(Epreuve.distance, Epreuve.nage, Epreuve.genre).all()
    return jsonify({
        "epreuves": [
            {
                "epreuve_id": e.epreuve_id,
                "distance": e.distance,
                "nage": e.nage,
                "genre": e.genre
            }
            for e in epreuves
        ]
    })

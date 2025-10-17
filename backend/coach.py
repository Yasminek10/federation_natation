# backend/coach.py
from flask import Blueprint, jsonify, request, g
from db import db, User, Nageur, Seance, Presence, Epreuve, SessionTest, ResultatTest
from datetime import date

coach_bp = Blueprint("coach", __name__, url_prefix="/api/coach")


# ============================
# Récupérer les nageurs du coach
# ============================
@coach_bp.get("/nageurs")
def list_nageurs():
    coach = _get_current_coach()
    if not coach:
        return jsonify({"message": "Coach non trouvé"}), 404
    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()
    return jsonify({
        "nageurs": [
            {
                "id": n.id_nageur,
                "nom": n.nom,
                "prenom": n.prenom,
                "club": n.club.nom if n.club else None,
                "birth_year": n.birth_year,
            }
            for n in nageurs
        ]
    })

# ============================
# Enregistrer une absence pour un nageur
# ============================
@coach_bp.post("/absences")
def add_absence():
    coach = _get_current_coach()
    data = request.get_json()
    nageur_id = data.get("nageur_id")
    date_str = data.get("date")
    session = data.get("session", "AM")

    nageur = Nageur.query.get(nageur_id)
    if not nageur or nageur.id_coach != coach.user_id:
        return jsonify({"message": "Nageur non autorisé"}), 403

    # Vérifie ou crée la séance
    seance = Seance.query.filter_by(date=date_str, session=session).first()
    if not seance:
        seance = Seance(date=date_str, session=session)
        db.session.add(seance)
        db.session.flush()

    # Enregistre la présence
    presence = Presence.query.filter_by(nageur_id=nageur.id_nageur, seance_id=seance.seance_id).first()
    if not presence:
        presence = Presence(nageur_id=nageur.id_nageur, seance_id=seance.seance_id, present=False)
        db.session.add(presence)
    else:
        presence.present = False

    db.session.commit()
    return jsonify({"message": "Absence enregistrée avec succès"})

# ============================
# Enregistrer un test technique
# ============================
@coach_bp.post("/tests")
def add_test():
    coach = _get_current_coach()
    data = request.get_json()
    nageur_id = data.get("nageur_id")
    epreuve_id = data.get("epreuve_id")
    temps = data.get("temps")
    date_test = data.get("date_test")

    nageur = Nageur.query.get(nageur_id)
    if not nageur or nageur.id_coach != coach.user_id:
        return jsonify({"message": "Nageur non autorisé"}), 403

    # Trouver ou créer la session de test
    sess = SessionTest.query.filter_by(epreuve_id=epreuve_id, date_test=date_test).first()
    if not sess:
        sess = SessionTest(epreuve_id=epreuve_id, date_test=date_test)
        db.session.add(sess)
        db.session.flush()

    # Ajouter résultat
    res = ResultatTest.query.filter_by(nageur_id=nageur.id_nageur, session_test_id=sess.session_test_id).first()
    if not res:
        res = ResultatTest(nageur_id=nageur.id_nageur, session_test_id=sess.session_test_id, temps=temps)
        db.session.add(res)
    else:
        res.temps = temps

    db.session.commit()
    return jsonify({"message": "Test ajouté avec succès"})

# ============================
#  Statistiques du coach
# ============================
@coach_bp.get("/stats")
def stats_coach():
    coach = _get_current_coach()
    nageurs = Nageur.query.filter_by(id_coach=coach.user_id).all()
    results = []
    for n in nageurs:
        tests = (
            db.session.query(ResultatTest, SessionTest, Epreuve)
            .join(SessionTest, SessionTest.session_test_id == ResultatTest.session_test_id)
            .join(Epreuve, Epreuve.epreuve_id == SessionTest.epreuve_id)
            .filter(ResultatTest.nageur_id == n.id_nageur)
            .order_by(SessionTest.date_test.desc())
            .all()
        )
        results.append({
            "nageur": f"{n.prenom} {n.nom}",
            "tests": [{"epreuve": f"{e.distance}m {e.nage}", "date": s.date_test, "temps": r.temps} for r, s, e in tests]
        })
    return jsonify({"stats": results})

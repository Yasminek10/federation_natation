# backend/results_api.py
from flask import Blueprint, request, jsonify
from db import db, Resultat, Epreuve, Nageur  # adapte à ton projet

results_bp = Blueprint("results", __name__, url_prefix="/api/results")

@results_bp.get("/")
def get_results():
    # Récupérer les filtres depuis le frontend
    categorie = request.args.get("categorie")
    genre = request.args.get("genre")
    distance = request.args.get("distance")

    # Construire la query
    query = db.session.query(Resultat).join(Nageur).join(Epreuve)

    if categorie:
        query = query.filter(Nageur.categorie == categorie)
    if genre:
        query = query.filter(Nageur.genre == genre)
    if distance:
        query = query.filter(Epreuve.distance == int(distance))

    results = query.all()

    # Retour format JSON
    return jsonify([
        {
            "id": r.id_resultat,
            "nageur": f"{r.nageur.nom} {r.nageur.prenom}",
            "categorie": r.nageur.categorie,
            "genre": r.nageur.genre,
            "epreuve": r.epreuve.nom,
            "distance": r.epreuve.distance,
            "temps": r.temps
        }
        for r in results
    ])

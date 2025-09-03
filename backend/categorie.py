from flask import Blueprint, jsonify, request
from db import db, Categorie

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@categories_bp.route("/", methods=["GET"])
def get_championnats():
    catg = Categorie.query.all()
    return jsonify([{
        "id": c.categorie_id,
        "nom": c.nom,
       
    } for c in catg])



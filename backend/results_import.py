# results_import.py
import re
import requests
import pandas as pd
from bs4 import BeautifulSoup
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from db import db

# ⬇️ Importe TES modèles existants. Si leurs noms diffèrent, adapte.
from db import db, Nageur, Resultat, Epreuve, Club

results_bp = Blueprint("results", __name__, url_prefix="/api/results")

# ---------- Helpers de normalisation -----------

POSSIBLE_COLS = {
    "rank": ["Rang", "Place", "Pos", "Classement", "Pl."],
    "name": ["Nom", "Nom et prénom", "Nom et Prénom", "Athlète", "Nageur"],
    "club": ["Club", "Equipe", "Équipe", "Team"],
    "time": ["Temps", "Performance", "Chrono", "Résultat"],
    "points": ["Points", "Pts", "Somme des Points", "Score"],
}

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    # strip colonnes
    df = df.rename(columns=lambda c: str(c).strip())
    colmap = {}
    for key, candidates in POSSIBLE_COLS.items():
        for c in candidates:
            if c in df.columns:
                colmap[key] = c
                break

    # On exige au moins nom/club/points (temps peut manquer pour forfaits)
    required = ["name", "club", "points"]
    missing = [r for r in required if r not in colmap]
    if missing:
        raise ValueError(f"Colonnes attendues manquantes dans le tableau HTML: {missing}")

    out = pd.DataFrame()
    out["name"]   = df[colmap["name"]].astype(str).str.strip()
    out["club"]   = df[colmap["club"]].astype(str).str.strip()

    if "rank" in colmap:
        out["rank"] = pd.to_numeric(df[colmap["rank"]], errors="coerce")
    else:
        out["rank"] = None

    if "time" in colmap:
        out["time"] = df[colmap["time"]].astype(str).str.strip()
    else:
        out["time"] = None

    # points en entier si possible
    pts_series = df[colmap["points"]].astype(str).str.replace(",", ".", regex=False)
    out["points"] = pd.to_numeric(pts_series, errors="coerce").fillna(0).astype(int)
    return out

def fetch_first_table(url: str) -> pd.DataFrame:
    # 1) téléchargement
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()

    # 2) pandas.read_html (rapide) – sinon BeautifulSoup si besoin
    tables = pd.read_html(resp.text)
    if not tables:
        # fallback: tenter d’attraper le premier <table> manuellement
        soup = BeautifulSoup(resp.text, "lxml")
        table = soup.find("table")
        if not table:
            raise ValueError("Aucun tableau HTML trouvé sur la page")
        df = pd.read_html(str(table))[0]
    else:
        df = tables[0]
    return df

# ---------- Helpers DB -----------

def get_or_create_nageur(nom: str, club: str) -> Nageur:
    # Adapte aux champs exacts (ici: Nageur(id_nageur PK, nom, prenom?, club?))
    # Si tu as nom/prenom séparés, fais un split ici.
    nageur = (db.session.query(Nageur)
              .filter(func.lower(Nageur.nom) == nom.lower(),
                      func.lower(Nageur.club) == club.lower())
              .first())
    if nageur:
        return nageur
    nageur = Nageur(nom=nom, club=club)  # complète si d’autres colonnes NOT NULL
    db.session.add(nageur)
    db.session.flush()  # pour récupérer id sans commit
    return nageur

def create_or_get_equipe(cec_id: int) -> Club:
    equipe = (db.session.query(Club)
              .filter(Club.cec_id == cec_id)
              .order_by(Club.equipe_id.desc())
              .first())
    # Tu peux choisir de créer une nouvelle équipe par ligne, ou regrouper par nom d’équipe si présent.
    # Ici on crée UNE équipe par import si relais.
    if equipe:
        return equipe
    equipe = Club(cec_id=cec_id)
    db.session.add(equipe)
    db.session.flush()
    return equipe

# ---------- API ----------

@results_bp.post("/import")
def import_from_url():
    """
    Body JSON attendu :
    {
      "url": "http://ftnatation.tn/....html#02",
      "cec_id": 123,           // obligatoire : rattache les résultats à l’épreuve+catégorie
      "is_relay": false,       // true si relais
      "double_relay_points": true  // optionnel: doubler les points des relais (défaut true)
    }
    """
    data = request.get_json() or {}
    url = (data.get("url") or "").strip()
    cec_id = data.get("cec_id")
    is_relay = bool(data.get("is_relay", False))
    double_relay_points = bool(data.get("double_relay_points", True))

    if not url or not cec_id:
        return jsonify({"status": "error", "message": "url et cec_id sont requis"}), 400

    try:
        raw = fetch_first_table(url)
        norm = normalize_columns(raw)

        inserted = 0
        # Si relais : on crée une équipe "technique" pour cet import (à peaufiner selon structure des pages)
        equipe_id = None
        if is_relay:
            equipe = create_or_get_equipe(cec_id)
            equipe_id = equipe.equipe_id

        for _, row in norm.iterrows():
            name = row["name"]
            club = row["club"]
            time = row["time"]
            points = int(row["points"] or 0)
            if is_relay and double_relay_points:
                points *= 2

            if is_relay:
                # On crée un résultat rattaché à l’équipe (nageur nullable)
                res = Resultat(
                    id_nageur=None,
                    equipe_id=equipe_id,
                    cec_id=cec_id,       # ⚠️ ajoute ce champ dans Resultat si pas encore là
                    points=points,
                    temps=time
                )
            else:
                nageur = get_or_create_nageur(name, club)
                res = Resultat(
                    id_nageur=nageur.id_nageur,  # adapte au nom de ta PK
                    equipe_id=None,
                    cec_id=cec_id,
                    points=points,
                    temps=time
                )

            db.session.add(res)
            inserted += 1

        db.session.commit()
        return jsonify({
            "status": "success",
            "inserted": inserted,
            "message": f"{inserted} lignes importées",
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@results_bp.get("/cec/<int:cec_id>")
def get_results_by_cec(cec_id: int):
    """
    Retourne les résultats agrégés pour affichage (club + total points)
    """
    # Jointure simple nageur/club + relais par equipe
    # Adapte au nom exact de tes colonnes
    # Exemple minimal : on renvoie juste les lignes telles quelles + un agrégat par club
    Result = Resultat.__table__
    N = Nageur.__table__

    # lignes individuelles
    indiv = (db.session.query(
                N.c.club.label("club"),
                Result.c.points.label("points")
            )
            .join(N, N.c.id_nageur == Result.c.id_nageur)
            .filter(Result.c.cec_id == cec_id)
            .all())

    # lignes relais (si tu stockes le club au niveau équipe, adapte ; sinon ajoute colonne club sur equipe)
    # Ici: on ne peut pas agréger par club pour les relais sans info club -> on les met en "Relais"
    relay = (db.session.query(
                db.literal("Relais").label("club"),
                Result.c.points.label("points")
            )
            .filter(Result.c.cec_id == cec_id, Result.c.equipe_id.isnot(None))
            .all())

    rows = indiv + relay
    df = pd.DataFrame(rows, columns=["club", "points"])
    if df.empty:
        return jsonify({"items": [], "aggregate": []})

    agg = (df.groupby("club", as_index=False)["points"].sum()
             .sort_values("points", ascending=False)
             .to_dict(orient="records"))

    return jsonify({
        "items": df.to_dict(orient="records"),
        "aggregate": agg
    })

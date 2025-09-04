# ocr_blueprint.py
# ocr_blueprint.py
import tempfile, os
import pandas as pd               # <-- indispensable car tu utilises pd.notna
from flask import Blueprint, request, jsonify
from db import db, Club, Nageur, Epreuve, Categorie
from utils_ocr_pipeline import (
    fuzzy_pick_club, fuzzy_match_swimmer, compute_club_totals, DEFAULT_CLUB_NAME
)
from ocr_natation import process_images
import re

ocr_bp = Blueprint("ocrx", __name__, url_prefix="/api/ocrx")

def _resolve_ids_from_payload():
    epreuve_id  = request.form.get("epreuve_id")  or (request.json.get("epreuve_id")  if request.is_json else None)
    categorie_id = request.form.get("categorie_id") or (request.json.get("categorie_id") if request.is_json else None)
    try:
        epreuve_id = int(epreuve_id) if epreuve_id else None
        categorie_id = int(categorie_id) if categorie_id else None
    except Exception:
        epreuve_id = categorie_id = None
    return epreuve_id, categorie_id

def _nice_case(s: str) -> str:
    """Title-case that keeps accents/dashes/apostrophes reasonable."""
    if not s: 
        return ""
    # Basic: lower then title (works fine for FR names in most cases)
    return s.strip().lower().title()


@ocr_bp.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error":"Aucun fichier"}), 400

    epreuve_id, categorie_id = _resolve_ids_from_payload()
    if not epreuve_id or not categorie_id:
        return jsonify({"error":"epreuve_id et categorie_id requis"}), 400

    f = request.files["file"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    try:
        # OCR -> DataFrame
        df = process_images([tmp_path], out_csv=None, out_xlsx=None, debug_dir=None)
        rows = []
        for _, r in df.iterrows():
            ocr_nom, ocr_prenom = (r.get("Nom") or "").strip(), (r.get("Prénom") or "").strip()
            nat = (r.get("Nationalité") or "").strip().upper() or "TUN"
            club_ocr = (r.get("Club") or "").strip()

            year = r.get("Année") if "Année" in r and pd.notna(r["Année"]) else None
            try:
                year = int(year) if year else None
            except:
                year = None

            club_obj = fuzzy_pick_club(club_ocr or DEFAULT_CLUB_NAME)
            swimmer, score = fuzzy_match_swimmer(ocr_nom, ocr_prenom, club_obj.id_club, year)

            # If matched → show DB names; else keep OCR names (lightly cased)
            disp_nom    = _nice_case(getattr(swimmer, "nom", "") or ocr_nom)
            disp_prenom = _nice_case(getattr(swimmer, "prenom", "") or ocr_prenom)

            rows.append({
                "place": int(r["Place"]),

                # display names (what the UI shows)
                "nom": disp_nom,
                "prenom": disp_prenom,

                # keep raw OCR names for traceability
                "ocr_nom": ocr_nom,
                "ocr_prenom": ocr_prenom,

                "nationalite": nat,
                "club_name": club_obj.nom,
                "club_id": int(club_obj.id_club),
                "temps": (r.get("Temps") or "").strip(),
                "points": int(str(r.get("Points") or "0") or 0),

                "matched_nageur_id": int(swimmer.id_nageur) if swimmer else None,
                "match_score": int(score),
                "eligible_points": bool(swimmer.eligible_points) if swimmer else (nat == "TUN"),
                "non_tunisien": (nat != "TUN"),
                "found_in_db": bool(swimmer is not None),

                "ocr_line": (r.get("Ligne") or "").strip(),
                "birth_year_ocr": year,
            })

        club_totals = compute_club_totals(rows, epreuve_id=epreuve_id, categorie_id=categorie_id) \
                        .to_dict(orient="records")
        return jsonify({"rows": rows, "club_totals": club_totals})
    finally:
        if os.path.exists(tmp_path): os.remove(tmp_path)

@ocr_bp.route("/recalc", methods=["POST"])
def recalc():
    data = request.get_json(force=True)
    rows_in = data.get("rows", [])
    epreuve_id = data.get("epreuve_id")
    categorie_id = data.get("categorie_id")
    if not epreuve_id or not categorie_id:
        return jsonify({"error":"epreuve_id et categorie_id requis"}), 400

    rows_out = []
    for r in rows_in:
        club_obj = fuzzy_pick_club(r.get("club_name") or DEFAULT_CLUB_NAME)
        nat = (r.get("nationalite") or "TUN").upper()
        swimmer, score = fuzzy_match_swimmer(
            r.get("nom",""), r.get("prenom",""),
            club_obj.id_club, r.get("birth_year_ocr")
        )
        disp_nom    = _nice_case(getattr(swimmer, "nom", "") or r.get("nom", ""))
        disp_prenom = _nice_case(getattr(swimmer, "prenom", "") or r.get("prenom", ""))
        rows_out.append({
           **r,
            # display names updated with DB when available
            "nom": disp_nom,
            "prenom": disp_prenom,

            "club_name": club_obj.nom,
            "club_id": int(club_obj.id_club),
            "matched_nageur_id": int(swimmer.id_nageur) if swimmer else None,
            "match_score": int(score),
            "eligible_points": bool(swimmer.eligible_points) if swimmer else (nat == "TUN"),
            "non_tunisien": (nat != "TUN"),
            "found_in_db": bool(swimmer is not None),
            "points": int(r.get("points") or 0),
        })

    club_totals = compute_club_totals(rows_out, epreuve_id=int(epreuve_id), categorie_id=int(categorie_id)) \
                    .to_dict(orient="records")
    return jsonify({"rows": rows_out, "club_totals": club_totals})

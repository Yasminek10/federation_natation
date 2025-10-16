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
from io import BytesIO
from datetime import datetime
from flask import send_file
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer


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

def _safe(s):
    return "" if s is None else str(s)

def _make_epreuve_label(e):
    """e = dict/obj avec distance, nage, genre, legs_count"""
    if not e:
        return ""
    try:
        legs = e.get("legs_count") if isinstance(e, dict) else getattr(e, "legs_count", None)
        distance = e.get("distance") if isinstance(e, dict) else getattr(e, "distance", "")
        nage = e.get("nage") if isinstance(e, dict) else getattr(e, "nage", "")
        genre = e.get("genre") if isinstance(e, dict) else getattr(e, "genre", "")
        if legs in (4, 10):
            return f"{legs}x{distance}m {nage} {genre}"
        return f"{distance}m {nage} {genre}"
    except Exception:
        return ""
    

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

@ocr_bp.route("/export_pdf", methods=["POST"])
def export_pdf():
    """
    Attend un JSON:
    {
      "championnat": "Nom championnat (saisi ou sélectionné)",
      "epreuve_label": "50m Dos Messieurs",
      "categorie_label": "Juniors A",
      "rows": [...],          # tableau du haut (détails)
      "club_totals": [...]    # cumul par club (tableau du bas)
    }
    """
    data = request.get_json(force=True)

    champ_name      = _safe(data.get("championnat"))
    epreuve_label   = _safe(data.get("epreuve_label"))
    categorie_label = _safe(data.get("categorie_label"))
    rows            = data.get("rows", []) or []
    club_totals     = data.get("club_totals", []) or []

    # Construction du PDF en mémoire
    buf = BytesIO()
    # Paysage pour avoir plus de place pour les tableaux
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=18, bottomMargin=18)
    story = []
    styles = getSampleStyleSheet()

    title = f"{champ_name or 'Sans championnat'}"
    story.append(Paragraph(title, styles["Title"]))
    meta = f"<b>Épreuve :</b> {epreuve_label or '-'}  &nbsp;&nbsp;&nbsp;  <b>Catégorie :</b> {categorie_label or '-'}  &nbsp;&nbsp;&nbsp;  <b>Généré le :</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    story.append(Paragraph(meta, styles["Normal"]))
    story.append(Spacer(1, 10))

    # --- Tableau des détails (haut) ---
    details_header = ["Rang", "Nom", "Prénom", "Club", "Nat.", "Temps", "Points", "Match", "Élig."]
    details_data = [details_header]
    for r in rows:
        details_data.append([
            _safe(r.get("place")),
            _safe(r.get("nom")),
            _safe(r.get("prenom")),
            _safe(r.get("club_name")),
            _safe(r.get("nationalite")),
            _safe(r.get("temps")),
            _safe(r.get("points")),
            f"{_safe(r.get('match_score'))}%",
            "Oui" if r.get("eligible_points") else "Non",
        ])

    details_tbl = Table(details_data, repeatRows=1)
    details_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.whitesmoke, colors.lightgrey]),
        ("FONTSIZE", (0,0), (-1,-1), 9),
    ]))
    story.append(Paragraph("<b>Détails des résultats (après vérification)</b>", styles["Heading4"]))
    story.append(details_tbl)
    story.append(Spacer(1, 14))

    # --- Tableau cumul par club (bas) ---
    totals_header = ["Club", "Points"]
    totals_data = [totals_header]
    for c in club_totals:
        totals_data.append([_safe(c.get("club_name")), _safe(c.get("points"))])

    totals_tbl = Table(totals_data, repeatRows=1, colWidths=[360, 80])
    totals_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.whitesmoke, colors.lightgrey]),
        ("FONTSIZE", (0,0), (-1,-1), 10),
    ]))
    story.append(Paragraph("<b>Cumul des points par club (sélection & minimas appliqués)</b>", styles["Heading4"]))
    story.append(totals_tbl)

    doc.build(story)

    filename = f"resultats_{re.sub(r'[^A-Za-z0-9_-]+','_', champ_name or 'championnat')}.pdf"
    buf.seek(0)
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename
    )
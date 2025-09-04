# utils_ocr_pipeline.py
from rapidfuzz import process, fuzz
from sqlalchemy import func
from db import db, Club, Nageur, Minimas, Epreuve, Categorie  # <— ajoute Epreuve, Categorie
import pandas as pd
import re

# --- normalisations légères cohérentes avec ton OCR ---
def _norm(s): 
    return (s or "").strip().upper().replace("’","'").replace("  "," ")

DEFAULT_CLUB_NAME = "ACADEMIE DE NATATION"

def get_or_create_default_club():
    club = Club.query.filter(func.upper(Club.nom)==DEFAULT_CLUB_NAME).first()
    if not club:
        club = Club(nom=DEFAULT_CLUB_NAME)
        db.session.add(club); db.session.flush()
    return club

def fetch_club_name_index():
    clubs = Club.query.all()
    names = [ _norm(c.nom) for c in clubs ]
    return clubs, names

def fuzzy_pick_club(ocr_club: str):
    """Raccroche le club OCR à un club DB (fuzzy) sinon renvoie le club par défaut."""
    o = _norm(ocr_club)
    if not o:
        return get_or_create_default_club()
    clubs, names = fetch_club_name_index()
    match = process.extractOne(o, names, scorer=fuzz.WRatio)
    if match and match[1] >= 88:  # seuil ajustable
        return clubs[match[2]]
    return get_or_create_default_club()

def candidate_swimmers(nom: str, prenom: str, club_id: int|None=None, year: int|None=None):
    q = Nageur.query
    if club_id:
        q = q.filter(Nageur.id_club==club_id)
    if year:
        q = q.filter(Nageur.birth_year==year)
    return q.all()

def fuzzy_match_swimmer(nom: str, prenom: str, club_id: int|None, year: int|None):
    """Retourne (nageur, score) ou (None, 0)."""
    nomN, preN = _norm(nom), _norm(prenom)
    cands = candidate_swimmers(nomN, preN, club_id, year)
    if not cands:
        cands = candidate_swimmers(nomN, preN, None, None)
    if not cands:
        return None, 0
    choices = [ (_norm(c.nom)+" "+_norm(c.prenom), c) for c in cands ]
    got = process.extractOne(f"{nomN} {preN}", [t[0] for t in choices], scorer=fuzz.WRatio)
    if got:
        chosen = choices[got[2]][1]
        return chosen, got[1]
    return None, 0

# ---------- Sélection/éligibilité & cumul ----------

def _parse_time_to_centis(t: str) -> int | None:
    """
    '1:05.42' -> 65.42s -> 6542 centis
    '1:05'    -> 65.00s -> 6500
    '32.28'   -> 32.28s -> 3228
    Retourne None si non parsable.
    """
    s = (t or "").strip()
    if not s:
        return None
    try:
        if ":" in s:
            mm, ss = s.split(":")
            if "." in ss:
                sec, cs = ss.split(".")
                return int(mm)*6000 + int(sec)*100 + int(cs[:2].ljust(2,"0"))
            else:
                return int(mm)*6000 + int(ss)*100
        else:
            # SS.cc
            if "." in s:
                sec, cs = s.split(".")
                return int(sec)*100 + int(cs[:2].ljust(2,"0"))
            else:
                return int(s)*100
    except Exception:
        return None

def _get_context(epreuve_id: int, categorie_id: int):
    """Récupère minimas (centis), quota max places, et multiplicateur relais."""
    epr: Epreuve = Epreuve.query.get(epreuve_id)
    cat: Categorie = Categorie.query.get(categorie_id)
    if not epr or not cat:
        # fallback neutre
        return None, 10, 1

    # minimas
    mini = Minimas.query.filter(
        Minimas.epreuve_id==epreuve_id,
        Minimas.categorie_id==categorie_id
    ).first()
    minima_cs = _parse_time_to_centis(mini.temp_min) if mini else None

    # quotas
    max_places = (cat.max_places_relay if (epr.is_relay) else cat.max_places_indiv) or 0
    if max_places <= 0:
        max_places = 10  # garde-fou

    # multiplicateur relais (spécifié par l’utilisateur : ×2 uniquement pour 4×*)
    relay_mult = 2 if (epr.is_relay and (epr.legs_count == 4)) else 1

    return minima_cs, max_places, relay_mult

def _row_is_eligible(r: dict, minima_cs: int | None) -> bool:
    """
    Règles:
      - r['eligible_points'] True
      - si 'minima_cs' défini: temps <= minima
      - on peut aussi exclure non-TUN si tu le souhaites (déjà traité dans eligible_points côté serveur)
    """
    if not r.get("eligible_points", False):
        return False
    if minima_cs is None:
        return True
    tcs = _parse_time_to_centis(r.get("temps",""))
    if tcs is None:
        return False
    return tcs <= minima_cs

def select_scoring_rows(rows: list[dict], epreuve_id: int, categorie_id: int) -> list[dict]:
    """
    Trie par place et sélectionne les nageurs à compter jusqu'à 'max_places'
    en respectant minimas & eligibility. Saute les non éligibles et prend les suivants.
    """
    minima_cs, max_places, relay_mult = _get_context(epreuve_id, categorie_id)
    out = []
    used = 0
    for r in sorted(rows, key=lambda x: int(x.get("place") or 9999)):
        if used >= max_places:
            break
        if _row_is_eligible(r, minima_cs):
            # applique le multiplicateur relais seulement au moment du cumul
            rr = {**r, "_relay_mult": relay_mult}
            out.append(rr)
            used += 1
    return out

def compute_club_totals(rows: list[dict], epreuve_id: int, categorie_id: int) -> pd.DataFrame:
    """
    Calcule le cumul par club, après sélection (minimas, quotas, éligibilité).
    Applique le multiplicateur relais (×2 si 4×*).
    """
    selected = select_scoring_rows(rows, epreuve_id, categorie_id)
    if not selected:
        return pd.DataFrame(columns=["club_name","club_id","points"])

    df = pd.DataFrame(selected)

    # points numériques
    df["points"] = pd.to_numeric(df["points"], errors="coerce").fillna(0).astype(int)
    # multiplicateur relais (par ligne)
    df["points_eff"] = df["points"] * df["_relay_mult"].fillna(1).astype(int)

    out = (
        df.groupby(["club_name","club_id"], dropna=False)["points_eff"]
          .sum()
          .reset_index()
          .rename(columns={"points_eff":"points"})
          .sort_values("points", ascending=False)
    )
    return out

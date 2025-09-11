# backend/ingest.py
import re
from datetime import datetime
from urllib.parse import urlparse
from sqlalchemy import func
import requests
from bs4 import BeautifulSoup
from flask import Blueprint, request, jsonify

from db import (
    db,
    Club, Nageur, Categorie, Epreuve, Championnat, CEC,
    Equipe, EquipeMembre,
    ResultatBase, ResultatIndividuel, ResultatRelais, 
)

ingest_bp = Blueprint("ingest", __name__, url_prefix="/api")
NBSP = "\u00A0"

# =========================
# Helpers & normalisations
# =========================

NAGE_MAP = {
    "NAGE LIBRE": "Nage Libre", "NL": "Nage Libre",
    "DOS": "Dos",
    "BRASSE": "Brasse", "BR": "Brasse",
    "PAPILLON": "Papillon", "PAP": "Papillon",
    "4 NAGES": "4 Nages", "4_NAGES": "4 Nages", "4NAGES": "4 Nages",
}

CAT_TOKENS = {
    "POUSSIN": "Poussin", "POUSSINS": "Poussin",
    "MINIME": "Minimes", "MINIMES": "Minimes",
    "BENJAMIN": "Benjamins", "BENJAMINS": "Benjamins", "BENJAMENS": "Benjamins",  # ⬅️
    "CADET": "Cadets", "CADETS": "Cadets",
    "JUNIOR": "Juniors/Seniors", "JUNIORS": "Juniors/Seniors",
    "SENIOR": "Juniors/Seniors", "SENIORS": "Juniors/Seniors",
    "SUNIORS": "Juniors/Seniors",
    "TC": "TC",
}

DEFAULT_CAT = "TC"
# --- Eligible points / identité nageur ------------------------

def norm_nat(n: str | None) -> str:
    return (clean_text(n).upper() if n else "")

def is_tunisian(n: str | None) -> bool:
    t = norm_nat(n)
    return t in {"TUN", "TUNISIE", "TN", "TUN."}

def swimmer_key(fullname: str, birth_txt: str | None, club_name: str) -> str:
    nom, prenom = _split_name(fullname)   # défini plus bas
    by = clean_text(birth_txt) or "-"
    club = clean_text(club_name)
    return f"{nom.upper()}|{prenom.upper()}|{club.upper()}|{by}"

def compute_eligible_from_preview(nation: str | None, approvals: dict, key: str) -> bool | None:
    """
    Retourne:
      - True si tunisien (auto)
      - approvals[key] si présent (True/False choisi par l'utilisateur)
      - None sinon -> ne PAS écraser la valeur existante en base
    """
    if is_tunisian(nation):
        return True
    if key in approvals:
        return bool(approvals[key])
    return None

def clean_text(s: str) -> str:
    if s is None:
        return ""
    return " ".join(s.replace(NBSP, " ").replace("\r", " ").replace("\n", " ").split()).strip()

def guess_bassin(label: str) -> int | None:
    t = clean_text(label).lower()
    if "grand bassin" in t or "50" in t:
        return 50
    if "petit bassin" in t or "25" in t:
        return 25
    return None

def compute_saison(date_deb) -> str:
    # saison Sept->Août
    y = date_deb.year
    return f"{y}/{y+1}" if date_deb.month >= 9 else f"{y-1}/{y}"

def norm_nage(token: str) -> str:
    t = clean_text(token).upper().replace("_", " ")
    t = re.sub(r"\s+", " ", t)
    return NAGE_MAP.get(t, t.title())

def parse_time_raw(s: str) -> str | None:
    s = clean_text(s).replace("；", ":").replace("：", ":").replace(",", ".")
    return s or None

def parse_place_and_statut(s: str) -> tuple[int | None, str]:
    """Renvoie (place|None, statut). Gère NC/DNS/DNF/DSQ sinon 'OK'."""
    t = clean_text(s).upper().replace(".", "")
    for key in ("DSQ", "DNS", "DNF", "NC"):
        if key in t:
            return 0, key
    try:
        return int(t), "OK"
    except ValueError:
        return None, "OK"

def detect_category(text: str) -> str | None:
    t = clean_text(text).upper()
    hits = [CAT_TOKENS[k] for k in CAT_TOKENS if re.search(rf"\b{k}\b", t)]
    if not hits:
        return None
    if "Juniors/Seniors" in hits:
        return "Juniors/Seniors"
    return hits[0]

# ==============
# ensure* (DB)
# ==============

def ensure_club(nom: str) -> Club:
    nom = clean_text(nom)
    if not nom:
        raise ValueError("club_vide")
    c = Club.query.filter_by(nom=nom).first()
    if not c:
        c = Club(nom=nom)
        db.session.add(c)
        db.session.flush()
    return c

def ensure_nageur(fullname: str, year_txt: str | None, club: Club, nation: str | None = None,
                  eligible_points: bool | None = None) -> Nageur:
    if club is None:
        raise ValueError("club_obligatoire")

    full = clean_text(fullname)
    nom, prenom = _split_name(fullname)
    nom = clean_text(nom)
    prenom = clean_text(prenom)

    by = int(year_txt) if (year_txt and year_txt.isdigit()) else None

    #lookup insensible à la casse pour respecter la contrainte upper(...)
    q = Nageur.query.filter(
        Nageur.id_club == club.id_club,
        func.upper(Nageur.nom) == nom.upper(),
        func.upper(Nageur.prenom) == prenom.upper(),
    )
    q = q.filter(Nageur.birth_year == by) if by is not None else q.filter(Nageur.birth_year.is_(None))
    n = q.first()
    if n:
        nat = clean_text(nation) or None
        if not n.nationalite and nat:
            n.nationalite = nat
        if eligible_points is not None and n.eligible_points != eligible_points:
            n.eligible_points = eligible_points
        return n

    n = Nageur(
        nom=nom,
        prenom=prenom,
        birth_year=by,
        id_club=club.id_club,
        nationalite=(clean_text(nation) or None),
        eligible_points=(
            eligible_points if eligible_points is not None
            else (True if is_tunisian(nation) else False)
        ),
    )
    db.session.add(n)
    db.session.flush()
    return n

def ensure_categorie(nom: str) -> Categorie:
    c = Categorie.query.filter_by(nom=nom).first()
    if not c:
        c = Categorie(nom=nom)
        db.session.add(c)
        db.session.flush()
    return c

def ensure_epreuve(distance: int, nage_token: str, genre: str, is_relay: bool, legs_count: int | None) -> Epreuve:
    """
    ⚠️ Nouveau schéma: pour un relais, 'distance' est la distance PAR JAMBE (ex: 100 pour 4x100).
    """
    nage = norm_nage(nage_token)
    e = Epreuve.query.filter_by(distance=distance, nage=nage, genre=genre, is_relay=is_relay, legs_count=legs_count).first()
    if not e:
        e = Epreuve(distance=distance, nage=nage, genre=genre, is_relay=is_relay, legs_count=legs_count)
        db.session.add(e)
        db.session.flush()
    return e

def ensure_championnat(nom: str, d_deb, d_fin, lieu: str | None, bassin: int | None, saison_label: str | None) -> Championnat:
    s = clean_text(saison_label or "")
    n = clean_text(nom)
    ch = Championnat.query.filter_by(nom=n, saison=s, datedeb=d_deb, datefin=d_fin).first()
    if not ch:
        ch = Championnat(nom=n, saison=s, datedeb=d_deb, datefin=d_fin, lieu=clean_text(lieu), bassin=bassin or 50)
        db.session.add(ch)
        db.session.flush()
    return ch

def ensure_cec(champ_id: int, epreuve_id: int, categorie_id: int) -> CEC:
    c = CEC.query.filter_by(champ_id=champ_id, epreuve_id=epreuve_id, categorie_id=categorie_id).first()
    if not c:
        c = CEC(champ_id=champ_id, epreuve_id=epreuve_id, categorie_id=categorie_id)
        db.session.add(c)
        db.session.flush()
    return c

def ensure_equipe(cec_id: int, club_id: int) -> Equipe:
    eq = Equipe.query.filter_by(cec_id=cec_id, id_club=club_id).first()
    if not eq:
        eq = Equipe(cec_id=cec_id, id_club=club_id)
        db.session.add(eq)
        db.session.flush()
    return eq

# ==============================
# Parsers (header / épreuve / UI)
# ==============================

EVENT_RX = re.compile(
    r"""^(?:(?P<legs>\d+)\s*[x×X]\s*)?      # 4 x  (optionnel, accepte ×)
         (?P<dist>\d+)\s*m?\s*              # '50 m' ou '50'
         (?P<nage>(?:NAGE\s*LIBRE|NL|DOS|BRASSE|BR|PAPILLON|PAP|4\s*NAGES))
         (?:\s*m)?\s+                       # parfois un 'm' errant après le style
         (?P<genre>Dames?|Messieurs?|Hommes|Mixte)   # tolérant
         (?:\s+.*)?$                        # ex: 'Classement', 'Finale', etc.
    """,
    re.IGNORECASE | re.VERBOSE
)
DATE_RX = re.compile(r"(\d{2}/\d{2}/\d{4}).*?(\d{2}/\d{2}/\d{4})")
TC_RX = re.compile(
    r"(?:\bT\s*\.?\s*C\s*\.?\b|\bTOUTES?\s+CAT[ÉE]GOR(?:IE|IES)\b)",
    re.IGNORECASE
)

def default_category_from_title(title: str) -> str | None:
    """
    - Si 'TC' (ou 'TOUTES CATEGORIE(S)') est présent dans le titre -> 'TC'
    - Sinon, si exactement UNE seule catégorie explicite (Benjamins, Minimes, …) -> celle-ci
    - Sinon -> None (et on retombera plus loin sur DEFAULT_CAT = 'TC')
    """
    t = clean_text(title)
    u = t.upper()

    if TC_RX.search(u):
        return "TC"

    hits = [CAT_TOKENS[k] for k in CAT_TOKENS if re.search(rf"\b{k}\b", u)]
    hits = list({h for h in hits if h})
    hits_non_tc = [h for h in hits if h != "TC"]
    if len(hits_non_tc) == 1:
        return hits_non_tc[0]
    return None


def derive_saison_from_name(nom: str) -> str | None:
    t = clean_text(nom).upper()
    if "ÉTÉ" in t or "ETE" in t:
        return "ETE"
    if "HIVER" in t:
        return "HIVER"
    return None

def derive_saison_from_dates(d1, d2) -> str:
    """
    Heuristique simple:
      - ETE  : compétitions dont la date de début est entre mai et septembre inclus
      - HIVER: sinon
    """
    m = (d1 or d2).month  # d1 existe déjà dans nos parseurs
    return "ETE" if 5 <= m <= 9 else "HIVER"

def parse_header_info(soup: BeautifulSoup):
    for el in soup.find_all("p"):
        txt = clean_text(el.get_text())
        if "CHAMPIONNAT" in txt.upper() and DATE_RX.search(txt):
            m = DATE_RX.search(txt)
            d1 = datetime.strptime(m.group(1), "%d/%m/%Y").date()
            d2 = datetime.strptime(m.group(2), "%d/%m/%Y").date()

            left = txt[:m.start()].strip(" -")
            parts = [x.strip() for x in left.split("-") if x.strip()]

            nom_strict = clean_text(parts[0]) if parts else clean_text(left)
            lieu = clean_text(parts[1]) if len(parts) >= 2 else None
            bassin = guess_bassin(parts[2]) if len(parts) >= 3 else None

            saison = derive_saison_from_name(nom_strict) or derive_saison_from_dates(d1, d2)

            # ⬇️ utilise tout 'left' pour ne pas rater "M/C J/S TC" après un tiret
            default_cat = default_category_from_title(left)

            return {
                "nom": nom_strict,
                "lieu": lieu,
                "bassin": bassin,
                "datedeb": d1,
                "datefin": d2,
                "saison": saison,
                "default_category": default_cat,
            }
    return None

def parse_event_heading(soup: BeautifulSoup):
    for el in soup.find_all("font"):
        t = clean_text(el.get_text())
        m = EVENT_RX.search(t)
        if not m:
            continue
        legs = m.group("legs")
        dist = int(m.group("dist"))
        nage = norm_nage(m.group("nage"))
        genre_raw = m.group("genre").strip().capitalize()
        # normalise le genre
        genre = "Messieurs" if genre_raw in {"Messieurs", "Hommes"} else ("Dames" if genre_raw.startswith("Dame") else "Mixte")
        if legs:
            return {"is_relay": True, "legs_count": int(legs), "distance": dist, "nage": nage, "genre": genre, "raw": t}
        return {"is_relay": False, "legs_count": None, "distance": dist, "nage": nage, "genre": genre, "raw": t}
    return None

def _parse_event_text(txt: str):
    """Retourne un dict ev{} à partir d'une ligne titre, sinon None."""
    t = clean_text(txt)
    m = EVENT_RX.search(t)
    if not m:
        return None
    legs = m.group("legs")
    dist = int(m.group("dist"))
    nage = norm_nage(m.group("nage"))
    genre_raw = m.group("genre").strip().capitalize()
    genre = "Messieurs" if genre_raw in {"Messieurs", "Hommes"} else ("Dames" if genre_raw.startswith("Dame") else "Mixte")
    if legs:
        return {"is_relay": True, "legs_count": int(legs), "distance": dist, "nage": nage, "genre": genre, "raw": t}
    return {"is_relay": False, "legs_count": None, "distance": dist, "nage": nage, "genre": genre, "raw": t}


def collect_events_with_tables(soup: BeautifulSoup, default_cat: str | None = None):
    events = []
    curr_event, curr_cat = None, None
    fallback_cat = default_cat or DEFAULT_CAT   # <— use page default if provided

    for node in soup.body.descendants:
        name = getattr(node, "name", None)
        if name in ("font", "b", "u", "p"):
            txt = clean_text(getattr(node, "get_text", lambda *a, **k: "")(" ", strip=True))
            ev = _parse_event_text(txt)
            if ev:
                curr_event = {"ev": ev, "sections": []}
                events.append(curr_event)
                curr_cat = None
                continue
            cat = detect_category(txt or "")
            if cat:
                curr_cat = cat
                continue

        if name == "table":
            headers = [clean_text(td.get_text()) for td in node.find_all("td")]
            if any("Nom et prénom" in h for h in headers) and any(h.lower().startswith("place") for h in headers):
                if curr_event is not None:
                    cat_label = curr_cat or fallback_cat   # <— here
                    curr_event["sections"].append((cat_label, node))

    return [e for e in events if e["sections"]]


def iter_category_tables(soup: BeautifulSoup, default_cat: str | None = None):
    curr_cat = None
    fallback_cat = default_cat or DEFAULT_CAT
    for node in soup.body.descendants:
        if getattr(node, "name", None) in ("font", "b", "u", "p"):
            cat = detect_category(node.get_text() or "")
            if cat:
                curr_cat = cat
        if getattr(node, "name", None) == "table":
            headers = [clean_text(td.get_text()) for td in node.find_all("td")]
            if any("Nom et prénom" in h for h in headers) and any(h.lower().startswith("place") for h in headers):
                yield (curr_cat or fallback_cat), node   

# --- entêtes robustes ---

HEADER_KEYS = {
    "place": "place",
    "nom": "name", "prénom": "name", "prenom": "name",
    "nation": "nation",
    "naissance": "birth",
    "club": "club",
    "temps": "time",
    "points": "points",
    "temps de passage": "passages",
}


def header_map_from_table(table) -> tuple[dict[str, int], int]:
    """
    Analyse les 1–3 premières lignes pour trouver la vraie ligne d'entête.
    Retourne (mapping, header_row_index).
    """
    rows = table.find_all("tr")
    header_idx = 0
    header_cells = None

    scan_upto = min(3, len(rows))
    for i in range(scan_upto):
        cells = [clean_text(td.get_text(" ", strip=True)).lower() for td in rows[i].find_all("td")]
        # Heuristique: une ligne d'entête contient au moins 'nom' et 'club' (ou 'temps' etc.)
        if any("nom" in c for c in cells) and (any("club" in c for c in cells) or any("temps" in c for c in cells)):
            header_idx = i
            header_cells = cells
            break

    if header_cells is None:
        header_cells = [clean_text(td.get_text(" ", strip=True)).lower() for td in rows[0].find_all("td")] if rows else []
        header_idx = 0

    mapping = {}
    for idx, h in enumerate(header_cells):
        for needle, key in HEADER_KEYS.items():
            if needle in h and key not in mapping:
                mapping[key] = idx

    return mapping, header_idx

# ============
# Relais utils
# ============

def extract_cumulative_passages(cell_text: str) -> list[str]:
    # '29.83 (50 m) - 1:02.42 (100 m) - ...' -> ['29.83','1:02.42', ...]
    t = clean_text(cell_text)
    out = []
    for chunk in t.split("-"):
        chunk = chunk.strip()
        if chunk:
            out.append(chunk.split(" (")[0].strip())
    return out

def time_to_seconds(t: str) -> float | None:
    if not t:
        return None
    t = t.replace(",", ".")
    if ":" not in t:
        try:
            return float(t)
        except:
            return None
    s = 0.0
    for p in t.split(":"):
        s = s * 60 + float(p)
    return s

def seconds_to_str(x: float) -> str:
    if x is None:
        return ""
    m = int(x // 60)
    s = x - 60 * m
    return f"{m}:{s:05.2f}" if m else f"{s:.2f}"




def parse_relay_groups(table, legs_count: int):
    """Regroupe les lignes en équipes (place -> recap + 3/9 lignes membres)."""
    rows = table.find_all("tr")
    teams, cur = [], None
    for r in rows[1:]:
        cells = [clean_text(td.get_text()) for td in r.find_all("td")]
        if len(cells) < 8:
            continue
        place_txt, fullname, nation, year, club, tps, pts, passages = cells[:8]

        if place_txt and any(ch.isdigit() for ch in place_txt):
            if cur and cur["members"]:
                teams.append(cur)
            cur = {"place_txt": place_txt, "members": [], "club": "", "time": "", "points": 0, "passages": ""}

        if cur is None:
            continue

        cur["members"].append({"fullname": fullname, "nation": nation, "year": year})

        if club and not cur["club"]:
            cur["club"] = club
        if tps:
            cur["time"] = tps
        if pts:
            try:
                cur["points"] = int(float(pts))
            except:
                cur["points"] = 0
        if passages:
            cur["passages"] = passages

    if cur and cur["members"]:
        teams.append(cur)
    # garde uniquement les équipes complètes
    return [t for t in teams if len(t["members"]) == legs_count]




# --- Remplace entièrement cette fonction ---
def compute_leg_50_splits_for_store(
    legs_count: int,
    dist_per_leg: int,
    cumul_list: list[str],
    total_time: str | None
) -> list[str]:
    """
    Retourne ["p50[/p50b]", ...] (longueur = legs_count).
    Règles :
      - Segments standards = différence de passages adjacents si présents et croissants.
      - 4e relayeur : 2e 50 = total - (dernier passage < total).
      - On ne dérive jamais d'autres segments à partir du total.
    """
    if not legs_count or not dist_per_leg:
        return []

    per50 = max(1, dist_per_leg // 50)             # 100 -> 2
    sec = [time_to_seconds(x) for x in cumul_list]  # [50,100,150,...]
    tot = time_to_seconds(total_time or "")

    def fmt(x):
        return seconds_to_str(x) if x is not None else ""

    out = []
    for j in range(legs_count):                     # 0..3
        start_idx = j * per50                       # 0,2,4,6 pour 4x100
        segs = []
        prev = 0.0 if start_idx == 0 else (sec[start_idx - 1] if start_idx - 1 < len(sec) else None)

        for k in range(per50):                      # k=0 (50), k=1 (100)
            cur_idx = start_idx + k                 # 0/1 ; 2/3 ; 4/5 ; 6/7(=absent)
            cur = sec[cur_idx] if cur_idx < len(sec) else None

            # Cas général: différence si croissant strict
            if prev is not None and cur is not None and cur > prev:
                segs.append(fmt(cur - prev))
                prev = cur
                continue

            # Fallback UNIQUEMENT pour le DERNIER segment du DERNIER relayeur
            if j == legs_count - 1 and k == per50 - 1 and tot is not None:
                # dernier passage valide strictement < total (350 de préférence)
                last_valid = None
                for x in sec:
                    if x is not None and x < tot and (last_valid is None or x > last_valid):
                        last_valid = x
                if last_valid is not None and tot > last_valid:
                    segs.append(fmt(tot - last_valid))
                    prev = tot
                    continue

            # sinon: segment inconnu
            segs.append("")
            prev = cur

        out.append("/".join(segs))
    return out



# ==================
# Endpoint principal
# ==================

def compute_eligible_for_insert(nation: str | None, approvals: dict, key: str, existing_nageur) -> bool | None:
    """
    Règle:
      - TUN -> True
      - Si approval explicite -> cette valeur
      - Sinon:
          - si NAGEUR NOUVEAU -> False (par défaut)
          - si NAGEUR EXISTANT -> None (ne pas écraser sa valeur)
    """
    if is_tunisian(nation):
        return True
    if key in approvals:
        return bool(approvals[key])
    return False if existing_nageur is None else None


@ingest_bp.post("/ingest")
def ingest_url():
    """
    Importe TOUTES les épreuves présentes sur l'URL (multi-épreuves).
    - Détecte le championnat, regroupe par épreuve/catégorie.
    - Déduplication globale CEC.
    - Insertion (individuel & relais).
    - Applique eligible_points : TUN => True ; non-TUN => selon approvals ; sinon ne change pas (None).
    """
    data = request.get_json(silent=True) or {}
    url = clean_text(data.get("url", ""))

    # (NEW) approvals issus du preview
    approvals = data.get("approvals", {})
    if not isinstance(approvals, dict):
        approvals = {}

    if not url or not urlparse(url).scheme:
        return jsonify({"status": "error", "message": "URL manquante ou invalide"}), 422

    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code != 200 or not resp.text:
            return jsonify({"status": "error", "message": "Impossible de récupérer la page"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Erreur réseau: {e}"}), 400

    soup = BeautifulSoup(resp.text, "lxml")

    # 1) Championnat
    meta = parse_header_info(soup)
    if not meta:
        return jsonify({"status": "error", "message": "En-tête championnat introuvable"}), 422
    champ = ensure_championnat(meta["nom"], meta["datedeb"], meta["datefin"], meta["lieu"], meta["bassin"], meta.get("saison"))

    # 2) Épreuves (multi) -> fallback single si nécessaire
    ev_groups = collect_events_with_tables(soup, default_cat=meta.get("default_category"))
    if not ev_groups:
        single = parse_event_heading(soup)
        if not single:
            return jsonify({"status": "error", "message": "Aucune épreuve détectée"}), 422
        ev_groups = [{"ev": single, "sections": list(iter_category_tables(soup, default_cat=meta.get("default_category")))}]

    # 3) Construire la liste de tout ce qu'on va insérer (CEC par épreuve×catégorie)
    pending_items = []   # [{cec_id, table, ev}, ...]
    cats_seen = []

    for grp in ev_groups:
        ev = grp["ev"]
        epr = ensure_epreuve(ev["distance"], ev["nage"], ev["genre"], ev["is_relay"], ev["legs_count"])
        for (cat_name, table) in grp["sections"]:
            cat_label = cat_name or DEFAULT_CAT
            cat = ensure_categorie(cat_label)
            cec = ensure_cec(champ.champ_id, epr.epreuve_id, cat.categorie_id)
            pending_items.append({"cec_id": cec.cec_id, "table": table, "ev": ev})
            cats_seen.append(cat.nom)

    if not pending_items:
        return jsonify({"status": "error", "message": "Aucune table de résultats lisible"}), 422

    # 4) Déduplication GLOBALE
    already = []
    for it in pending_items:
        if db.session.query(ResultatBase.resultat_id).filter_by(cec_id=it["cec_id"]).first():
            already.append(it["cec_id"])
    if already:
        return jsonify({"status": "error", "message": "Championnat déjà importé", "cec_ids": sorted(set(already))}), 409

    # 5) Insertion
    inserted = 0
    for it in pending_items:
        cec_id, table, ev = it["cec_id"], it["table"], it["ev"]

        if ev["is_relay"]:
            legs = ev["legs_count"] or 4
            dist_per_leg = ev["distance"]
            teams = parse_relay_groups(table, legs)

            for team in teams:
                if not team.get("club"):
                    return jsonify({"status": "error", "message": f"Club manquant pour l'équipe (CEC {cec_id})."}), 422
                club = ensure_club(team["club"])
                eq = ensure_equipe(cec_id, club.id_club)

                cumul = extract_cumulative_passages(team.get("passages", ""))
                leg_50_splits = compute_leg_50_splits_for_store(legs, dist_per_leg, cumul, team.get("time", ""))

                for idx, mem in enumerate(team.get("members", []), start=1):
                    sw_key = swimmer_key(mem.get("fullname", ""), mem.get("year", ""), team.get("club", ""))
                    existing = _find_nageur(mem.get("fullname", ""), mem.get("year", ""), club)
                    elig = compute_eligible_for_insert(mem.get("nation"), approvals, sw_key, existing)
                    nageur = ensure_nageur(mem.get("fullname", ""), mem.get("year", ""), club, mem.get("nation"), eligible_points=elig)

                    st = leg_50_splits[idx - 1] if (idx - 1) < len(leg_50_splits) else ""
                    db.session.add(EquipeMembre(
                        equipe_id=eq.equipe_id,
                        nageur_id=nageur.id_nageur,
                        leg_order=idx,
                        split_time=st
                    ))

                place, statut = parse_place_and_statut(team.get("place_txt", ""))
                base = ResultatBase(
                    cec_id=cec_id,
                    points=team.get("points", 0) or 0,
                    place=place,
                    temps=(team.get("time") or None),
                    statut=statut
                )
                db.session.add(base)
                db.session.flush()
                db.session.add(ResultatRelais(resultat_id=base.resultat_id, equipe_id=eq.equipe_id))
                inserted += 1

        else:
            rows = table.find_all("tr")
            if not rows or len(rows) < 2:
                continue

            col, header_idx = header_map_from_table(table)
            if header_idx < 0 or "club" not in col:
                return jsonify({"status": "error", "message": f"Entête invalide (colonne 'Club' absente) CEC {cec_id}."}), 422

            for r in rows[header_idx + 1:]:
                tds = r.find_all("td")
                if not tds:
                    continue

                def pick(key, default=""):
                    i = col.get(key)
                    return clean_text(tds[i].get_text(" ", strip=True)) if i is not None and i < len(tds) else default

                fullname = pick("name")
                if not fullname:
                    continue

                club_nom = pick("club")
                if not club_nom:
                    return jsonify({"status": "error", "message": f"Club manquant pour '{fullname}' (CEC {cec_id})."}), 422

                annee     = pick("birth")
                place_txt = pick("place")
                temps_raw = pick("time")
                pts_txt   = pick("points")
                nation    = pick("nation")

                place, statut = parse_place_and_statut(place_txt)
                temps = parse_time_raw(temps_raw)
                try:
                    points = int(float(pts_txt)) if pts_txt else 0
                except Exception:
                    points = 0

                club = ensure_club(club_nom)

                # (NEW) appliquer eligible_points via preview approvals
                sw_key = swimmer_key(fullname, annee, club_nom)
                existing = _find_nageur(fullname, annee, club)
                elig = compute_eligible_for_insert(nation, approvals, sw_key, existing)  # True/False/None
                nageur = ensure_nageur(fullname, annee, club, nation, eligible_points=elig)

                base = ResultatBase(cec_id=cec_id, points=points, place=place, temps=temps, statut=statut)
                db.session.add(base)
                db.session.flush()
                db.session.add(ResultatIndividuel(resultat_id=base.resultat_id, id_nageur=nageur.id_nageur))
                inserted += 1

    db.session.commit()

    events_out = [{
        "nage": grp["ev"]["nage"],
        "genre": grp["ev"]["genre"],
        "is_relay": grp["ev"]["is_relay"],
        "legs_count": grp["ev"]["legs_count"],
        "distance_par_jambe": grp["ev"]["distance"],
    } for grp in ev_groups]

    return jsonify({
        "status": "success",
        "inserted": inserted,
        "championnat": {
            "id": champ.champ_id,
            "nom": champ.nom,
            "saison": champ.saison,
            "lieu": champ.lieu,
            "bassin": champ.bassin,
            "datedeb": str(champ.datedeb),
            "datefin": str(champ.datefin),
        },
        "epreuve": (events_out[0] if events_out else None),
        "events": events_out,
        "categories": sorted(set(cats_seen)),
        "eligible_policy": {
            "auto_true_if_tunisian": True,
            "non_tunisian_default": False,
            "applied_approvals_count": len(approvals),
        },
        "url": url,
    }), 201


# =========================
# Dry-run (prévisualisation)
# =========================

def _find_club(nom: str):
    nom = clean_text(nom)
    if not nom:
        return None
    return Club.query.filter_by(nom=nom).first()

def _split_name(fullname: str):
    full = clean_text(fullname)
    if not full:
        return "", ""
    parts = full.split()
    if len(parts) == 1:
        return parts[0], ""

    # Heuristique : run de mots en MAJUSCULES au début => nom de famille
    upper_run = []
    for tok in parts:
        # garde le token si au moins une lettre et tout en majuscules (accents OK)
        if tok.upper() == tok and re.search(r"[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ]", tok):
            upper_run.append(tok)
        else:
            break

    if 1 <= len(upper_run) < len(parts):
        nom = " ".join(upper_run)
        prenom = " ".join(parts[len(upper_run):])
        return nom, prenom

    # Fallback : tout sauf le dernier = nom ; dernier = prénom
    return " ".join(parts[:-1]), parts[-1]

def _find_nageur(fullname: str, year_txt: str | None, club: Club | None):
    if club is None:
        return None
    nom, prenom = _split_name(fullname)
    nom = clean_text(nom)
    prenom = clean_text(prenom)
    by = int(year_txt) if (year_txt and year_txt.isdigit()) else None

    q = Nageur.query.filter(
        Nageur.id_club == club.id_club,
        func.upper(Nageur.nom) == nom.upper(),
        func.upper(Nageur.prenom) == prenom.upper(),
    )
    q = q.filter(Nageur.birth_year == by) if by is not None else q.filter(Nageur.birth_year.is_(None))
    return q.first()

@ingest_bp.post("/ingest/preview")
def ingest_preview():
    """
    Dry-run multi-épreuves (pas d'écriture).
    Retourne:
      - championnat, events, categories, conflicts_cec_ids
      - swimmers_verification (liste unique, non-TUN à approuver) + swimmer_conflicts_keys
    """
    data = request.get_json(silent=True) or {}
    url = clean_text(data.get("url", ""))
    sample_limit = int(data.get("limit", 8))

    if not url or not urlparse(url).scheme:
        return jsonify({"status": "error", "message": "URL manquante ou invalide"}), 422

    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code != 200 or not resp.text:
            return jsonify({"status": "error", "message": "Impossible de récupérer la page"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Erreur réseau: {e}"}), 400

    soup = BeautifulSoup(resp.text, "lxml")

    meta = parse_header_info(soup)
    if not meta:
        return jsonify({"status": "error", "message": "En-tête championnat introuvable"}), 422

    ev_groups = collect_events_with_tables(soup, default_cat=meta.get("default_category"))
    if not ev_groups:
        single = parse_event_heading(soup)
        if not single:
            return jsonify({"status": "error", "message": "Aucune épreuve détectée"}), 422
        ev_groups = [{"ev": single, "sections": list(iter_category_tables(soup, default_cat=meta.get("default_category")))}]

    events_preview = []
    cats_seen = []
    conflicts = []

    # Agrégateur de nageurs uniques
    sw_seen: dict[str, dict] = {}
    conflict_keys: set[str] = set()

    def push_swimmer(fullname, birth, club_nom, nation):
        key = swimmer_key(fullname, birth, club_nom)
        nat = norm_nat(nation)
        entry = sw_seen.get(key)
        if not entry:
            club = _find_club(club_nom) if club_nom else None
            existing = _find_nageur(fullname, birth, club) if club else None
            nom, prenom = _split_name(fullname)
            sw_seen[key] = {
                "key": key,
                "fullname": clean_text(fullname),
                "nom": nom,
                "prenom": prenom,
                "birth_year": (int(clean_text(birth)) if clean_text(birth).isdigit() else None),
                "club": clean_text(club_nom),
                "nations": set(),
                "existing": {
                    "id": (existing.id_nageur if existing else None),
                    "nationalite": (existing.nationalite if existing else None),
                    "eligible_points": (existing.eligible_points if existing is not None else None),
                },
            }
            entry = sw_seen[key]
        if nat:
            entry["nations"].add(nat)
        if len(entry["nations"]) > 1:
            conflict_keys.add(key)

    saison_label = clean_text(meta.get("saison") or "")
    champ_db = Championnat.query.filter_by(
        nom=meta["nom"], saison=saison_label, datedeb=meta["datedeb"], datefin=meta["datefin"]
    ).first()

    for grp in ev_groups:
        ev = grp["ev"]
        epr_db = Epreuve.query.filter_by(
            distance=ev["distance"], nage=ev["nage"], genre=ev["genre"],
            is_relay=ev["is_relay"], legs_count=ev["legs_count"]
        ).first()

        event_out = {
            "epreuve": {
                "is_relay": ev["is_relay"],
                "legs_count": ev["legs_count"],
                "distance_par_jambe": ev["distance"],
                "nage": ev["nage"],
                "genre": ev["genre"],
            },
            "cecs": [],
        }

        for (cat_name, table) in grp["sections"]:
            cat_label = cat_name or DEFAULT_CAT
            cats_seen.append(cat_label)

            virt = {"categorie": cat_label, "details": [], "header_mapping": {}, "header_row_index": -1,
                    "guessed_category": (cat_name is None)}

            # conflit CEC déjà importé ?
            cec_id = None
            if champ_db and epr_db:
                cat_db = Categorie.query.filter_by(nom=cat_label).first()
                if cat_db:
                    cec = CEC.query.filter_by(
                        champ_id=champ_db.champ_id, epreuve_id=epr_db.epreuve_id, categorie_id=cat_db.categorie_id
                    ).first()
                    if cec:
                        cec_id = cec.cec_id
                        if db.session.query(ResultatBase.resultat_id).filter_by(cec_id=cec_id).first():
                            conflicts.append(cec_id)
            virt["cec_id"] = cec_id

            if ev["is_relay"]:
                legs = ev["legs_count"] or 4
                teams = parse_relay_groups(table, legs)

                # (NEW) scan complet pour l’agrégateur
                for T in teams:
                    club_name = clean_text(T.get("club", ""))
                    for mem in T.get("members", []):
                        push_swimmer(mem.get("fullname", ""), mem.get("year", ""), club_name, mem.get("nation", ""))

                # affichage (échantillon)
                out = []
                for t in teams[:sample_limit]:
                    club_name = clean_text(t.get("club", ""))
                    club = _find_club(club_name) if club_name else None
                    pl_raw = t.get("place_txt", "")
                    pl, _ = parse_place_and_statut(pl_raw)
                    block = {
                        "place_raw": pl_raw,
                        "place": pl,
                        "club": club_name,
                        "would_create_club": (club is None),
                        "time": clean_text(t.get("time", "")),
                        "points": t.get("points", 0) or 0,
                        "members": [],
                        "passages": clean_text(t.get("passages", "")),
                    }
                    if not club_name:
                        block["error"] = "Club d’équipe manquant (relais)."
                    for mem in t.get("members", []):
                        full = clean_text(mem.get("fullname", ""))
                        year = clean_text(mem.get("year", ""))
                        block["members"].append({
                            "fullname": full,
                            "nation": clean_text(mem.get("nation", "")),
                            "birth_year": (int(year) if year.isdigit() else None),
                            "club": club_name,
                            "would_create_swimmer": (_find_nageur(full, year, club) is None) or (club is None),
                        })
                    out.append(block)
                virt["details"] = out

            else:
                col, header_idx = header_map_from_table(table)
                virt["header_mapping"] = col
                virt["header_row_index"] = header_idx
                rows = table.find_all("tr")
                rows = rows[header_idx + 1:] if header_idx >= 0 else rows[1:]

                # (NEW) scan complet agrégateur
                for r in rows:
                    tds = r.find_all("td")
                    if not tds:
                        continue
                    def pick_all(key, default=""):
                        i = col.get(key)
                        return clean_text(tds[i].get_text(" ", strip=True)) if i is not None and i < len(tds) else default
                    fullname_all = pick_all("name")
                    if not fullname_all:
                        continue
                    club_nom_all  = pick_all("club")
                    birth_all     = pick_all("birth")
                    nation_all    = pick_all("nation")
                    push_swimmer(fullname_all, birth_all, club_nom_all, nation_all)

                # affichage (échantillon)
                det = []
                for r in rows:
                    tds = r.find_all("td")
                    if not tds:
                        continue
                    def pick(key, default=""):
                        i = col.get(key)
                        return clean_text(tds[i].get_text(" ", strip=True)) if i is not None and i < len(tds) else default
                    fullname = pick("name")
                    if not fullname:
                        continue
                    club_nom  = pick("club")
                    birth     = pick("birth")
                    nation    = pick("nation")
                    place_raw = pick("place")
                    temps_raw = pick("time")
                    pts_raw   = pick("points")
                    club = _find_club(club_nom) if club_nom else None
                    nageur = _find_nageur(fullname, birth, club) if club else None
                    det.append({
                        "fullname": fullname, "club": club_nom, "nation": nation,
                        "birth_year": (int(birth) if birth.isdigit() else None),
                        "place_raw": place_raw, "time": temps_raw, "points_raw": pts_raw,
                        "would_create_club": (club is None),
                        "would_create_swimmer": (nageur is None) or (club is None),
                        "error": ("Club manquant" if not club_nom else None),
                    })
                    if len(det) >= sample_limit:
                        break
                virt["details"] = det

            event_out["cecs"].append(virt)

        events_preview.append(event_out)

    # (NEW) liste unique + tri par clé
    swimmers_list = []
    for key in sorted(sw_seen.keys()):
        v = sw_seen[key]
        nations = sorted(v["nations"]) if v["nations"] else []
        existing_ep = v["existing"]["eligible_points"]
        default_ep = (existing_ep if existing_ep is not None
                      else (True if any(is_tunisian(n) for n in nations) else False))
        swimmers_list.append({
            **{k: v[k] for k in ("key","fullname","nom","prenom","birth_year","club","existing")},
            "nations": nations,
            "default_eligible_points": bool(default_ep),
            "needs_approval": (not any(is_tunisian(n) for n in nations)),  # TUN non demandé
            "conflict": (key in conflict_keys),
        })

    return jsonify({
        "status": "ok",
        "preview": True,
        "championnat": {
            "nom": meta["nom"], "saison": saison_label, "lieu": meta["lieu"], "bassin": meta["bassin"],
            "datedeb": str(meta["datedeb"]), "datefin": str(meta["datefin"]),
        },
        "events": events_preview,
        "epreuve": (events_preview[0]["epreuve"] if events_preview else None),
        "categories": sorted(set(cats_seen)),
        "conflicts_cec_ids": sorted(set(conflicts)),
        "swimmers_verification": swimmers_list,          # (NEW)
        "swimmer_conflicts_keys": sorted(conflict_keys), # (NEW)
        "url": url,
    })
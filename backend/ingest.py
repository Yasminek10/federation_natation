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
    "BENJAMIN": "Benjamins", "BENJAMINS": "Benjamins", "BENJAMENS": "Benjamins",
    "CADET": "Cadets", "CADETS": "Cadets",
    "JUNIOR": "Juniors/Seniors", "JUNIORS": "Juniors/Seniors",
    "SENIOR": "Juniors/Seniors", "SENIORS": "Juniors/Seniors",
    "SUNIORS": "Juniors/Seniors",
    "TC": "TC",
}

DEFAULT_CAT = "TC"

# --- Eligible points / identité nageur ------------------------

def clean_text(s: str) -> str:
    if s is None:
        return ""
    return " ".join(s.replace(NBSP, " ").replace("\r", " ").replace("\n", " ").split()).strip()

def norm_nat(n: str | None) -> str:
    return (clean_text(n).upper() if n else "")

def is_tunisian(n: str | None) -> bool:
    t = norm_nat(n)
    return t in {"TUN", "TUNISIE", "TN", "TUN."}

def swimmer_key(fullname: str, birth_txt: str | None, club_name: str) -> str:
    nom, prenom = _split_name(fullname)
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

def guess_bassin(label: str) -> int | None:
    t = clean_text(label).lower()
    if "grand bassin" in t or "50" in t:
        return 50
    if "petit bassin" in t or "25" in t:
        return 25
    return None

def compute_saison(date_deb) -> str:
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

    if re.search(r"\bJ\s*[/\-]?\s*S\b", t):
        return "Juniors/Seniors"

    if "18 ET PLUS" in t:
        return "Juniors/Seniors"

    hits = [CAT_TOKENS[k] for k in CAT_TOKENS if re.search(rf"\b{k}\b", t)]
    if not hits:
        return None
    if "Juniors/Seniors" in hits:
        return "Juniors/Seniors"
    return hits[0]

def contains_championnat(t: str) -> bool:
    u = t.upper()
    return ("CHAMP" in u and ("NAT" in u or "ION" in u))

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
    r"""^(?:(?P<legs>\d+)\s*[x×X]\s*)?
         (?P<dist>\d+)\s*m?\s*
         (?P<nage>(?:NAGE\s*LIBRE|NL|DOS|BRASSE|BR|PAPILLON|PAP|4\s*NAGES))
         (?:\s*m)?\s+
         (?P<genre>Dames?|Messieurs?|Hommes|Mixte)
         (?:\s+.*)?$
    """,
    re.IGNORECASE | re.VERBOSE
)
DATE_RX = re.compile(r"(\d{2}/\d{2}/\d{4}).*?(\d{2}/\d{2}/\d{4})")
TC_RX = re.compile(
    r"(?:\bT\s*\.?\s*C\s*\.?\b|\bTOUTES?\s+CAT[ÉE]GOR(?:IE|IES)\b)",
    re.IGNORECASE
)

def default_category_from_title(title: str) -> str | None:
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
    m = (d1 or d2).month
    return "ETE" if 5 <= m <= 9 else "HIVER"

def parse_header_info(soup: BeautifulSoup):
    for el in soup.find_all("p"):
        txt = clean_text(el.get_text())
        if contains_championnat(txt) and DATE_RX.search(txt):
            m = DATE_RX.search(txt)
            d1 = datetime.strptime(m.group(1), "%d/%m/%Y").date()
            d2 = datetime.strptime(m.group(2), "%d/%m/%Y").date()

            left = txt[:m.start()].strip(" -¤")
            parts = [x.strip() for x in re.split(r"[-¤]", left) if x.strip()]

            nom_strict = clean_text(parts[0]) if parts else clean_text(left)
            lieu = clean_text(parts[1]) if len(parts) >= 2 else None
            bassin = guess_bassin(parts[2]) if len(parts) >= 3 else None

            saison = derive_saison_from_name(nom_strict) or derive_saison_from_dates(d1, d2)
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
        genre = "Messieurs" if genre_raw in {"Messieurs", "Hommes"} else ("Dames" if genre_raw.startswith("Dame") else "Mixte")
        if legs:
            return {"is_relay": True, "legs_count": int(legs), "distance": dist, "nage": nage, "genre": genre, "raw": t}
        return {"is_relay": False, "legs_count": None, "distance": dist, "nage": nage, "genre": genre, "raw": t}
    return None

def _parse_event_text(txt: str):
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
    fallback_cat = default_cat or DEFAULT_CAT

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
                    cat_label = curr_cat or fallback_cat
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
    rows = table.find_all("tr")
    header_idx = 0
    header_cells = None

    scan_upto = min(3, len(rows))
    for i in range(scan_upto):
        cells = [clean_text(td.get_text(" ", strip=True)).lower() for td in rows[i].find_all("td")]
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
    return [t for t in teams if len(t["members"]) == legs_count]

def compute_leg_50_splits_for_store(
    legs_count: int,
    dist_per_leg: int,
    cumul_list: list[str],
    total_time: str | None
) -> list[str]:
    if not legs_count or not dist_per_leg:
        return []

    per50 = max(1, dist_per_leg // 50)
    sec = [time_to_seconds(x) for x in cumul_list]
    tot = time_to_seconds(total_time or "")

    def fmt(x):
        return seconds_to_str(x) if x is not None else ""

    out = []
    for j in range(legs_count):
        start_idx = j * per50
        segs = []
        prev = 0.0 if start_idx == 0 else (sec[start_idx - 1] if start_idx - 1 < len(sec) else None)

        for k in range(per50):
            cur_idx = start_idx + k
            cur = sec[cur_idx] if cur_idx < len(sec) else None

            if prev is not None and cur is not None and cur > prev:
                segs.append(fmt(cur - prev))
                prev = cur
                continue

            if j == legs_count - 1 and k == per50 - 1 and tot is not None:
                last_valid = None
                for x in sec:
                    if x is not None and x < tot and (last_valid is None or x > last_valid):
                        last_valid = x
                if last_valid is not None and tot > last_valid:
                    segs.append(fmt(tot - last_valid))
                    prev = tot
                    continue

            segs.append("")
            prev = cur

        out.append("/".join(segs))
    return out

# =======================================
# UPSERT helpers (NEW)
# =======================================

def diff_base_fields(base: ResultatBase, *, points, place, temps, statut) -> dict:
    changes = {}
    if (base.points or 0) != (points or 0): changes["points"] = (base.points, points)
    if base.place != place: changes["place"] = (base.place, place)
    if (base.temps or None) != (temps or None): changes["temps"] = (base.temps, temps)
    if (base.statut or "OK") != (statut or "OK"): changes["statut"] = (base.statut, statut)
    return changes

def upsert_individual_result(*, cec_id: int, nageur_id: int, points: int, place: int | None, temps: str | None, statut: str):
    """
    Unicité logique: (cec_id, nageur_id)
    """
    base = (
        db.session.query(ResultatBase)
        .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
        .filter(ResultatBase.cec_id == cec_id, ResultatIndividuel.id_nageur == nageur_id)
        .first()
    )

    if not base:
        base = ResultatBase(cec_id=cec_id, points=points or 0, place=place, temps=temps, statut=statut)
        db.session.add(base)
        db.session.flush()
        db.session.add(ResultatIndividuel(resultat_id=base.resultat_id, id_nageur=nageur_id))
        return "inserted", base.resultat_id, {}

    changes = diff_base_fields(base, points=points, place=place, temps=temps, statut=statut)
    if not changes:
        return "unchanged", base.resultat_id, {}

    base.points = points or 0
    base.place = place
    base.temps = temps
    base.statut = statut
    return "updated", base.resultat_id, changes

def upsert_relay_result(*, cec_id: int, equipe_id: int, points: int, place: int | None, temps: str | None, statut: str):
    """
    Unicité logique: (cec_id, equipe_id)
    """
    base = (
        db.session.query(ResultatBase)
        .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
        .filter(ResultatBase.cec_id == cec_id, ResultatRelais.equipe_id == equipe_id)
        .first()
    )

    if not base:
        base = ResultatBase(cec_id=cec_id, points=points or 0, place=place, temps=temps, statut=statut)
        db.session.add(base)
        db.session.flush()
        db.session.add(ResultatRelais(resultat_id=base.resultat_id, equipe_id=equipe_id))
        return "inserted", base.resultat_id, {}

    changes = diff_base_fields(base, points=points, place=place, temps=temps, statut=statut)
    if not changes:
        return "unchanged", base.resultat_id, {}

    base.points = points or 0
    base.place = place
    base.temps = temps
    base.statut = statut
    return "updated", base.resultat_id, changes

def upsert_relay_members(*, equipe_id: int, members: list[dict]):
    """
    members: [{nageur_id, leg_order, split_time}]
    -> insert/update EquipeMembre
    """
    existing = {m.leg_order: m for m in EquipeMembre.query.filter_by(equipe_id=equipe_id).all()}
    ins = upd = unch = 0

    for m in members:
        leg = m["leg_order"]
        nageur_id = m["nageur_id"]
        split_time = m.get("split_time") or None

        em = existing.get(leg)
        if not em:
            db.session.add(EquipeMembre(equipe_id=equipe_id, nageur_id=nageur_id, leg_order=leg, split_time=split_time))
            ins += 1
            continue

        if em.nageur_id == nageur_id and (em.split_time or None) == split_time:
            unch += 1
            continue

        em.nageur_id = nageur_id
        em.split_time = split_time
        upd += 1

    return ins, upd, unch

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

    ✅ Nouveau comportement:
      - Autorise la réimportation du même championnat
      - Upsert résultats:
          inserted / updated / unchanged
      - Met à jour si la source (FTN) a changé
    """
    data = request.get_json(silent=True) or {}
    url = clean_text(data.get("url", ""))

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

    # 1) Championnat (ensure -> réutilise ou crée)
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

    # 3) Construire CEC (ensure) + items
    pending_items = []
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

    # ✅ 4) PLUS DE BLOCAGE "Championnat déjà importé"
    #    -> on fait des UPSERT ligne par ligne.

    inserted = 0
    updated = 0
    unchanged = 0

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

                members_payload = []
                for idx, mem in enumerate(team.get("members", []), start=1):
                    sw_key = swimmer_key(mem.get("fullname", ""), mem.get("year", ""), team.get("club", ""))
                    existing = _find_nageur(mem.get("fullname", ""), mem.get("year", ""), club)
                    elig = compute_eligible_for_insert(mem.get("nation"), approvals, sw_key, existing)
                    nageur = ensure_nageur(mem.get("fullname", ""), mem.get("year", ""), club, mem.get("nation"), eligible_points=elig)

                    st = leg_50_splits[idx - 1] if (idx - 1) < len(leg_50_splits) else ""
                    members_payload.append({
                        "nageur_id": nageur.id_nageur,
                        "leg_order": idx,
                        "split_time": st
                    })

                # Upsert membres équipe
                upsert_relay_members(equipe_id=eq.equipe_id, members=members_payload)

                place, statut = parse_place_and_statut(team.get("place_txt", ""))
                status, rid, changes = upsert_relay_result(
                    cec_id=cec_id,
                    equipe_id=eq.equipe_id,
                    points=team.get("points", 0) or 0,
                    place=place,
                    temps=(team.get("time") or None),
                    statut=statut
                )
                if status == "inserted":
                    inserted += 1
                elif status == "updated":
                    updated += 1
                else:
                    unchanged += 1

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

                sw_key = swimmer_key(fullname, annee, club_nom)
                existing = _find_nageur(fullname, annee, club)
                elig = compute_eligible_for_insert(nation, approvals, sw_key, existing)
                nageur = ensure_nageur(fullname, annee, club, nation, eligible_points=elig)

                status, rid, changes = upsert_individual_result(
                    cec_id=cec_id,
                    nageur_id=nageur.id_nageur,
                    points=points,
                    place=place,
                    temps=temps,
                    statut=statut
                )
                if status == "inserted":
                    inserted += 1
                elif status == "updated":
                    updated += 1
                else:
                    unchanged += 1

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
        "updated": updated,
        "unchanged": unchanged,
        "championnat": {
            "id": champ.champ_id,
            "nom": champ.nom,
            "saison": champ.saison,
            "lieu": champ.lieu,
            "bassin": champ.bassin,
            "datedeb": str(champ.datedeb),
            "datefin": str(champ.datefin),
        },
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

    upper_run = []
    for tok in parts:
        if tok.upper() == tok and re.search(r"[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ]", tok):
            upper_run.append(tok)
        else:
            break

    if 1 <= len(upper_run) < len(parts):
        nom = " ".join(upper_run)
        prenom = " ".join(parts[len(upper_run):])
        return nom, prenom

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

def _find_indiv_result(cec_id: int, nageur_id: int) -> ResultatBase | None:
    return (
        db.session.query(ResultatBase)
        .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
        .filter(ResultatBase.cec_id == cec_id, ResultatIndividuel.id_nageur == nageur_id)
        .first()
    )

def _find_relay_result(cec_id: int, equipe_id: int) -> ResultatBase | None:
    return (
        db.session.query(ResultatBase)
        .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
        .filter(ResultatBase.cec_id == cec_id, ResultatRelais.equipe_id == equipe_id)
        .first()
    )

@ingest_bp.post("/ingest/preview")
def ingest_preview():
    """
    Dry-run multi-épreuves (pas d'écriture).
    Retourne:
      - championnat, events, categories
      - delta_summary (NEW) : inserted / updated / unchanged estimés
      - swimmers_verification + conflits nationalités
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

    # Agrégateur nageurs uniques
    sw_seen: dict[str, dict] = {}
    conflict_keys: set[str] = set()

    # Résumé upsert estimé (NEW)
    delta_inserted = 0
    delta_updated = 0
    delta_unchanged = 0

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

            virt = {
                "categorie": cat_label,
                "details": [],
                "header_mapping": {},
                "header_row_index": -1,
                "guessed_category": (cat_name is None),
                "cec_id": None,
            }

            # retrouver cec_id en base si existant
            cec_id = None
            if champ_db and epr_db:
                cat_db = Categorie.query.filter_by(nom=cat_label).first()
                if cat_db:
                    cec = CEC.query.filter_by(
                        champ_id=champ_db.champ_id, epreuve_id=epr_db.epreuve_id, categorie_id=cat_db.categorie_id
                    ).first()
                    if cec:
                        cec_id = cec.cec_id
            virt["cec_id"] = cec_id

            if ev["is_relay"]:
                legs = ev["legs_count"] or 4
                teams = parse_relay_groups(table, legs)

                # scan complet agrégateur nageurs + delta_summary
                for T in teams:
                    club_name_all = clean_text(T.get("club", ""))
                    for mem in T.get("members", []):
                        push_swimmer(mem.get("fullname", ""), mem.get("year", ""), club_name_all, mem.get("nation", ""))

                    # delta status pour l'équipe si possible
                    if cec_id and club_name_all:
                        club_db = _find_club(club_name_all)
                        if club_db:
                            eq_db = Equipe.query.filter_by(cec_id=cec_id, id_club=club_db.id_club).first()
                            if eq_db:
                                rb = _find_relay_result(cec_id, eq_db.equipe_id)
                            else:
                                rb = None

                            place_new, statut_new = parse_place_and_statut(T.get("place_txt", ""))
                            temps_new = parse_time_raw(T.get("time", ""))
                            try:
                                pts_new = int(float(T.get("points", 0) or 0))
                            except:
                                pts_new = 0

                            if not rb:
                                delta_inserted += 1
                            else:
                                changes = diff_base_fields(rb, points=pts_new, place=place_new, temps=temps_new, statut=statut_new)
                                if not changes:
                                    delta_unchanged += 1
                                else:
                                    delta_updated += 1
                        else:
                            # club inexistant => sera créé => "new"
                            delta_inserted += 1
                    else:
                        # pas de cec existant => new
                        delta_inserted += 1

                # affichage (échantillon)
                out = []
                for t in teams[:sample_limit]:
                    club_name = clean_text(t.get("club", ""))
                    club = _find_club(club_name) if club_name else None
                    pl_raw = t.get("place_txt", "")
                    pl, stt = parse_place_and_statut(pl_raw)

                    team_status = "new"
                    if cec_id and club:
                        eq_db = Equipe.query.filter_by(cec_id=cec_id, id_club=club.id_club).first()
                        if eq_db:
                            rb = _find_relay_result(cec_id, eq_db.equipe_id)
                        else:
                            rb = None
                        temps_new = parse_time_raw(t.get("time", ""))
                        try:
                            pts_new = int(float(t.get("points", 0) or 0))
                        except:
                            pts_new = 0
                        if rb:
                            changes = diff_base_fields(rb, points=pts_new, place=pl, temps=temps_new, statut=stt)
                            team_status = "unchanged" if not changes else "updated"

                    block = {
                        "row_status": team_status,  # NEW
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

                # scan complet agrégateur nageurs + delta_summary
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

                    # delta status si possible
                    if cec_id and club_nom_all:
                        club_db = _find_club(club_nom_all)
                        nageur_db = _find_nageur(fullname_all, birth_all, club_db) if club_db else None

                        place_raw_all = pick_all("place")
                        temps_raw_all = pick_all("time")
                        pts_raw_all   = pick_all("points")

                        place_new, statut_new = parse_place_and_statut(place_raw_all)
                        temps_new = parse_time_raw(temps_raw_all)
                        try:
                            pts_new = int(float(pts_raw_all)) if pts_raw_all else 0
                        except:
                            pts_new = 0

                        if club_db and nageur_db:
                            rb = _find_indiv_result(cec_id, nageur_db.id_nageur)
                        else:
                            rb = None

                        if not rb:
                            delta_inserted += 1
                        else:
                            changes = diff_base_fields(rb, points=pts_new, place=place_new, temps=temps_new, statut=statut_new)
                            if not changes:
                                delta_unchanged += 1
                            else:
                                delta_updated += 1
                    else:
                        delta_inserted += 1

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

                    row_status = "new"
                    if cec_id and club and nageur:
                        rb = _find_indiv_result(cec_id, nageur.id_nageur)
                        if rb:
                            place_new, statut_new = parse_place_and_statut(place_raw)
                            temps_new = parse_time_raw(temps_raw)
                            try:
                                pts_new = int(float(pts_raw)) if pts_raw else 0
                            except:
                                pts_new = 0
                            changes = diff_base_fields(rb, points=pts_new, place=place_new, temps=temps_new, statut=statut_new)
                            row_status = "unchanged" if not changes else "updated"

                    det.append({
                        "row_status": row_status,  # NEW
                        "fullname": fullname,
                        "club": club_nom,
                        "nation": nation,
                        "birth_year": (int(birth) if birth.isdigit() else None),
                        "place_raw": place_raw,
                        "time": temps_raw,
                        "points_raw": pts_raw,
                        "would_create_club": (club is None),
                        "would_create_swimmer": (nageur is None) or (club is None),
                        "error": ("Club manquant" if not club_nom else None),
                    })
                    if len(det) >= sample_limit:
                        break
                virt["details"] = det

            event_out["cecs"].append(virt)

        events_preview.append(event_out)

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
            "needs_approval": (not any(is_tunisian(n) for n in nations)),
            "conflict": (key in conflict_keys),
        })

    return jsonify({
        "status": "ok",
        "preview": True,
        "championnat": {
            "nom": meta["nom"],
            "saison": saison_label,
            "lieu": meta["lieu"],
            "bassin": meta["bassin"],
            "datedeb": str(meta["datedeb"]),
            "datefin": str(meta["datefin"]),
        },
        "events": events_preview,
        "categories": sorted(set(cats_seen)),
        "delta_summary": {  # NEW
            "inserted": int(delta_inserted),
            "updated": int(delta_updated),
            "unchanged": int(delta_unchanged),
        },
        "swimmers_verification": swimmers_list,
        "swimmer_conflicts_keys": sorted(conflict_keys),
        "url": url,
    })

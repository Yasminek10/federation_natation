import re, sys
from pathlib import Path
from docx import Document

# Imports app / db depuis backend/
sys.path.append(str(Path(__file__).resolve().parent))
from app import app
from db import db, Minimas, Categorie, Epreuve

# ---- mapping nages -> canonique ----
NAGE_MAP = {
    "NAGE LIBRE": "Nage Libre", "NL": "Nage Libre",
    "DOS": "Dos",
    "BRASSE": "Brasse", "BR": "Brasse",
    "PAPILLON": "Papillon", "PAP": "Papillon",
    "4 NAGES": "4 Nages", "4_NAGES": "4 Nages", "4NAGES": "4 Nages",
}

NULL_TOKENS = {"", "-", "—", "–", "N/A", "NA", "MINIMA", "MINIMAS"}  # ignore aussi en-tête "minima"

def category_from_filename(name: str) -> str:
    stem = Path(name).stem
    low  = stem.lower()
    if low == "tc" or low.startswith("tc"): return "TC"
    if "poussin"  in low: return "Poussin"
    if "minime"   in low: return "Minimes"
    if "benjamin" in low: return "Benjamins"
    if "cadet"    in low: return "Cadets"
    if "junior" in low and "senior" in low: return "Juniors/Seniors"
    return stem.title()

def norm_time(s: str) -> str:
    if s is None: return ""
    s = s.strip().replace("\u00A0", "")
    
    s = re.sub(r"\s*:\s*", ":", s)  # "2 :39.84" -> "2:39.84"
    s = (s.replace("：", ":")
         .replace(" ;", ":").replace(";", ":")
         .replace(",,", ".").replace(",", "."))
    return s.strip()

def is_empty(s: str) -> bool:
    return s.strip().upper() in NULL_TOKENS

def normalize_nage_token(tok: str) -> str:
    t = tok.upper().replace("_", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return NAGE_MAP.get(t, t.title())

# ---- ORM helpers avec dédoublonnage DB ----
def ensure_categorie(nom: str) -> Categorie:
    obj = Categorie.query.filter_by(nom=nom).first()
    if not obj:
        obj = Categorie(nom=nom); db.session.add(obj); db.session.flush()
    return obj

def ensure_epreuve(distance: int, nage_token: str, genre: str, is_relay: bool) -> Epreuve:
    nage = normalize_nage_token(nage_token)
    ep = Epreuve.query.filter_by(distance=distance, nage=nage, genre=genre, is_relay=is_relay).first()
    if not ep:
        ep = Epreuve(distance=distance, nage=nage, genre=genre, is_relay=is_relay)
        db.session.add(ep); db.session.flush()
    return ep

def upsert_minima(epreuve_id: int, categorie_id: int, temp_min: str):
    rec = Minimas.query.filter_by(epreuve_id=epreuve_id, categorie_id=categorie_id).first()
    if rec:
        rec.temp_min = temp_min   # update si déjà là
    else:
        db.session.add(Minimas(epreuve_id=epreuve_id, categorie_id=categorie_id, temp_min=temp_min))

# Variante underscore: autorise un suffixe après le genre (ex: _Classement)
EVENT_U = re.compile(
    r"""^(?:(?P<relay>\d+)_x_)?      # 4_x_ (optionnel)
        (?P<dist>\d+)_m_
        (?P<nage>[A-Z0-9_]+)_
        (?P<genre>Dames|Messieurs|Mixte)
        (?:_.*)?$                    # <- suffixe optionnel
    """, re.IGNORECASE | re.VERBOSE
)

# Variante espaces: autorise du texte après le genre (ex: '... Mixte Classement')
EVENT_S = re.compile(
    r"""^(?:(?P<relay>\d+)\s*[xX]\s*)? # 4 x (optionnel)
        (?P<dist>\d+)\s*m\s+
        (?P<nage>(?:NAGE\s*LIBRE|NL|DOS|BRASSE|BR|PAPILLON|PAP|4\s*NAGES))\s+
        (?P<genre>Dames|Messieurs|Mixte)
        (?:\s+.*)?$                   # <- suffixe optionnel
    """, re.IGNORECASE | re.VERBOSE
)

def match_event(text: str):
    txt = text.strip()
    m = EVENT_U.match(txt.replace(" ", ""))  # variantes compactes
    if m: return m
    return EVENT_S.match(txt)                # variantes avec espaces

# ---- import principal : tables d'abord (col0=épreuve, col1=temps) ----
def parse_docx(path: Path):
    doc = Document(str(path))
    rows = []

    # 1) Tables 2 colonnes
    for tbl in doc.tables:
        for row in tbl.rows:
            cells = []
            for cell in row.cells:
                t = "\n".join(p.text for p in cell.paragraphs if p.text.strip()).strip()
                cells.append(t)
            if len(cells) >= 2:
                rows.append((cells[0].strip(), cells[1].strip()))

    # 2) Fallback: paragraphes (épreuve sur une ligne, temps sur la suivante)
    if not rows:
        lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        i = 0
        while i < len(lines):
            head = lines[i]
            m = match_event(head)
            if m:
                # temps = le champ après le match sur la même ligne, sinon ligne suivante
                remainder = head[m.end():].strip()
                time_txt = remainder or (lines[i+1] if i+1 < len(lines) else "")
                rows.append((head, time_txt))
                i += 2
            else:
                i += 1

    return rows

def load_all(folder: Path):
    total_ins = 0

    # sets pour dédoublonner dans UNE même exécution
    seen_epreuves = set()   # (distance, nage_norm, genre, is_relay)
    seen_minimas  = set()   # (distance, nage_norm, genre, is_relay, categorie_nom)

    for fp in sorted(folder.glob("*.docx")):
        cat_nom = category_from_filename(fp.name)
        cat = ensure_categorie(cat_nom)
        rows = parse_docx(fp)

        ins = 0
        for ev_text, time_text in rows:
            if not ev_text or is_empty(time_text):  # ignore en-têtes/vides
                continue

            m = match_event(ev_text)
            if not m:
                continue  # pas une épreuve lisible

            gd     = m.groupdict()
            relay  = gd.get("relay")
            dist   = int(gd["dist"])
            nage   = gd["nage"]
            genre  = gd["genre"].capitalize()
            is_rel = bool(relay)
            total_dist = dist * int(relay) if relay else dist
            nage_norm  = normalize_nage_token(nage)

            # ---- dédoublonnage épreuve (clé unique logique) ----
            ekey = (total_dist, nage_norm, genre, is_rel)
            if ekey not in seen_epreuves:
                seen_epreuves.add(ekey)
            # upsert DB (ne créera pas de doublon grâce à ensure_epreuve)
            ep = ensure_epreuve(total_dist, nage, genre, is_rel)

            # ---- temps ----
            tnorm = norm_time(time_text)
            if is_empty(tnorm):
                continue

            # ---- dédoublonnage minima par (épreuve, catégorie) ----
            mkey = (total_dist, nage_norm, genre, is_rel, cat_nom)
            if mkey in seen_minimas:
                # déjà inséré dans cette exécution -> skip
                continue
            seen_minimas.add(mkey)

            upsert_minima(ep.epreuve_id, cat.categorie_id, tnorm)
            ins += 1; total_ins += 1

        print(f"[OK] {fp.name}: insérées:{ins} (catégorie={cat_nom})")

    db.session.commit()
    return total_ins

if __name__ == "__main__":
    data_dir = Path(__file__).parent / "data" / "minimas"  # backend/data/minimas
    if not data_dir.exists():
        print(f"Répertoire introuvable: {data_dir}")
        raise SystemExit(1)

    with app.app_context():
        total = load_all(data_dir)
        print(f"Import terminé: {total} minima insérés/mis à jour.")

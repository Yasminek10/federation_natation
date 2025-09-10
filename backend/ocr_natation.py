# -*- coding: utf-8 -*-
"""
OCR résultats natation — classés numériques uniquement
- Prétraitement OpenCV (upscale + deskew + binarisation)
- OCR Tesseract multi-PSM
- Regroupement vertical des champs (ordre libre)
- Corrections :
  * normalisation caractères OCR (O→0, l→1, §→5, etc.)
  * clubs via aliases + fuzzy contre KNOWN_CLUBS
  * nationalités contre VALID_NATIONALITIES
  * temps tronqués (7.87 -> 27.87 si points élevés)
  * rattrapage Points dans la ligne brute
  * renumérotation finale 1..N
Usage :
  python ocr_natation.py image1.jpg [image2.png ...] --csv out.csv --xlsx out.xlsx
"""
import re, os, sys, cv2, numpy as np, pandas as pd, difflib
import pytesseract
from PIL import Image

# --- Clubs & nationalités connus (fourni par l'utilisateur) ---
KNOWN_CLUBS = {
    "ACADEMIE","ACADEMIEDE","NATATION","ACADEMIE DE NATATION","EST","CA","ASCNS","CMSLS","CNM","LP",
    "ASM","ESS","CSUIP","SUC","ASMT","CNBA","STADE TUNISIEN","GAZEL EL TUNIS","OLYMPICA","MSM","JSB",
    "OCK","AQUARIUM"
}
VALID_NATIONALITIES = {
    "TUN","ROU","MAR","LBA","EGY","FRA","ITA","ESP","GER","USA","BRA","SEN","CIV","TUR"
}

# -- Windows : ajuster si besoin
TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if TESSERACT_CMD and os.path.exists(TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# ------------------------ Prétraitement ------------------------
def deskew_with_osd(gray):
    try:
        osd = pytesseract.image_to_osd(gray)
        m = re.search(r"Rotate:\s*(\d+)", osd)
        ang = int(m.group(1)) if m else 0
        if ang:
            h, w = gray.shape[:2]
            M = cv2.getRotationMatrix2D((w//2, h//2), -ang, 1.0)
            gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC,
                                  borderMode=cv2.BORDER_REPLICATE)
    except Exception:
        pass
    return gray

def preprocess_for_ocr(path, debug_dir=None, tag=""):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(path)
    # upscale pour aider Tesseract
    img = cv2.resize(img, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    gray = deskew_with_osd(gray)
    # contraste local
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    # binaire (choisit entre adaptative et Otsu)
    ada = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY, 35, 15)
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th = ada if cv2.countNonZero(ada) < cv2.countNonZero(otsu) else otsu
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), 1)
    if debug_dir:
        os.makedirs(debug_dir, exist_ok=True)
        cv2.imwrite(os.path.join(debug_dir, f"pre_{tag}.png"), th)
    return th

# --------------------------- OCR ---------------------------
def ocr_text(img, debug_dir=None, tag=""):
    configs = [
        "--oem 3 --psm 4 -l fra+eng",   # texte en colonnes
        "--oem 3 --psm 6 -l fra+eng",   # bloc de texte
        "--oem 3 --psm 11 -l fra+eng",  # texte clairsemé
    ]
    best = ""
    for i, cfg in enumerate(configs):
        txt = pytesseract.image_to_string(img, config=cfg)
        if len(txt) > len(best):
            best = txt
        if debug_dir:
            with open(os.path.join(debug_dir, f"ocr_{tag}_psm{i}.txt"), "w", encoding="utf-8") as f:
                f.write(txt)
    if debug_dir:
        with open(os.path.join(debug_dir, f"ocr_best_{tag}.txt"), "w", encoding="utf-8") as f:
            f.write(best)
    return best

# -------------------- Normalisations/tests --------------------
TIME_RE = r"(?:\d{1,2}:\d{2}\.\d{2}|\d{1,2}:\d{2}|\d{1,2}\.\d{2})"

# début d’entrée : nombre + point + espace + MAJ (évite 25.55)
START_NUM = re.compile(r"^(?P<rank>\d{1,2})\.\s+(?=[A-Z])")
START_TAG = re.compile(r"^(?P<rank>(?:TLD|NC|HC))\.?\s+(?=[A-Z])")

# aliases clubs observés
CLUB_ALIASES = {
    "OLYM": "OLYMPICA", "OLYMP": "OLYMPICA", "OLYMPlCA": "OLYMPICA",
    "ASG": "ASCNS", "ASC": "ASCNS", "CSU!P": "CSUIP", "CSUIP": "CSUIP",
    "ES": "EST", "MJ": "CNM",
    "ACADEMIEDE": "ACADEMIE DE NATATION", "NATATION": "ACADEMIE DE NATATION", "ACADEMIE": "ACADEMIE DE NATATION"
}

def normalize_ocr_chars(s: str) -> str:
    # corrige caractères OCR fréquents
    trans = str.maketrans({
        "§": "5", "O": "0", "o": "0", "l": "1", "I": "1",
        ",": ".", "“": "", "”": "", "‘": "'", "’": "'"
    })
    return s.translate(trans)

def norm(s: str) -> str:
    return normalize_ocr_chars(s.strip())

def canon_nat(raw: str) -> str:
    s = norm(raw).upper()
    if s in VALID_NATIONALITIES:
        return s
    close = difflib.get_close_matches(s, list(VALID_NATIONALITIES), n=1, cutoff=0.84)
    return close[0] if close else ""

def canon_club(raw: str) -> str:
    s = norm(raw).upper()
    s = CLUB_ALIASES.get(s, s)
    # fuzzy vers KNOWN_CLUBS
    close = difflib.get_close_matches(s, list(KNOWN_CLUBS), n=1, cutoff=0.72)
    if close:
        return close[0]
    # combinaisons “ACADEMIE ... NATATION”
    tokens = s.split()
    if any(t in {"ACADEMIE", "ACADEMIEDE", "NATATION"} for t in tokens):
        return "ACADEMIE DE NATATION"
    return s

def looks_like_time(s: str) -> bool:
    t = norm(s)
    return re.fullmatch(TIME_RE, t) is not None or t in {"Abandon", "Disqual.", "Frf", "Frf n.d.", "Frf n.d"}

def is_points(s: str) -> bool:
    return re.fullmatch(r"\d{1,4}|0|n\.d\.", norm(s)) is not None

def noisy_number_before_start(s: str) -> bool:
    return re.fullmatch(r"\d{2,4}", norm(s)) is not None

# corrige chiffres dans des mots (ex: GH0RBEL -> GHORBEL)
def fix_alpha_token(tok: str) -> str:
    t = tok
    if re.search(r"[A-Za-z]", t):
        t = (t.replace("0", "O").replace("1", "I").replace("5", "S")
               .replace("8", "B").replace("6", "G").replace("4", "A"))
    return t

def fix_name(name: str) -> str:
    parts = norm(name).split()
    parts = [fix_alpha_token(p) for p in parts]
    return " ".join(parts)

def fix_club_text(club: str) -> str:
    c = " ".join(fix_alpha_token(w) for w in norm(club).split())
    return canon_club(c)

def split_nom_prenom(fullname: str):
    toks = norm(fullname).split()
    nom, prenom, hit = [], [], False
    for w in toks:
        if not hit and re.fullmatch(r"[A-Z\-']+", w):
            nom.append(w)
        else:
            hit = True
            prenom.append(w)
    if not nom and toks:
        nom = [toks[0]]
        prenom = toks[1:]
    return " ".join(nom).upper(), " ".join(prenom)

def fix_time_if_truncated(time_str: str, points: str) -> str:
    t = norm(time_str)
    if ":" in t:
        return t  # mm:ss.xx ou mm:ss
    # exemple: "5.38" (manque un 2 devant) ou "§.38" -> "5.38"
    if re.fullmatch(r"[^0-9]?\d\.\d{2}", t):
        t = re.sub(r"^[^0-9]", "", t)
        try:
            if points and int(norm(points)) >= 450 and re.fullmatch(r"\d\.\d{2}", t):
                t = "2" + t  # 7.87 -> 27.87 ; 5.38 -> 25.38
        except Exception:
            pass
    return t

def extract_points_from_raw(raw: str) -> str:
    """
    Cherche les points dans la 'Ligne' brute.
    Stratégie :
      1) repérer tous les temps au format mm:ss(.cc) ; prendre le DERNIER
      2) à partir de sa fin, chercher le 1er entier 3–4 chiffres (300..1200)
      3) sinon, choisir le meilleur candidat global en privilégiant
         - un entier 3–4 chiffres entre deux 'temps' (colonne centrale typique)
         - sinon un entier 3–4 chiffres n'importe où dans la ligne
    On normalise aussi les caractères OCR (ex: '§35' -> '535').
    """
    s = normalize_ocr_chars(raw.replace("|", " "))
    # 1) dernier temps
    last_time_end = -1
    time_pat = re.compile(r"\b\d{1,2}:\d{2}(?:\.\d{2})?\b")
    for m in time_pat.finditer(s):
        last_time_end = m.end()

    # utilitaire : valide un nombre comme des points plausibles
    def plausible(n: str) -> bool:
        try:
            v = int(n)
            return 300 <= v <= 1200
        except:
            return False

    # 2) 1er entier 3–4 chiffres après le dernier temps
    for m in re.finditer(r"\b\d{3,4}\b", s):
        if last_time_end >= 0 and m.start() > last_time_end and plausible(m.group()):
            return m.group()

    # 3a) candidat entre deux temps (souvent la colonne des points)
    times = list(time_pat.finditer(s))
    nums = list(re.finditer(r"\b\d{3,4}\b", s))
    if len(times) >= 1 and nums:
        # on prend un nombre situé entre un temps (à gauche) et quelque chose qui ressemble
        # à un temps partiel à droite (ex. 32.28 = split), mais on n'exige pas absolument le split
        for m in nums:
            if plausible(m.group()):
                # y a-t-il un temps juste avant ce nombre ?
                left_time = [t for t in times if t.end() <= m.start()]
                right_time = [t for t in times if t.start() >= m.end()]
                if left_time:
                    return m.group()

    # 3b) meilleur candidat global
    for m in nums:
        if plausible(m.group()):
            return m.group()

    return ""

def harvest_points_list(full_text: str):
    """
    Balaye le texte ligne par ligne.
    Dès qu'on voit un temps mm:ss(.cc), on s'attend à voir juste après
    la ligne 'points' (un entier 3–4 chiffres 300..1200). On ne garde
    que ce premier entier après chaque temps.
    """
    pts, expect_points = [], False
    time_pat = re.compile(r"\b\d{1,2}:\d{2}(?:\.\d{2})?\b")

    for raw_ln in full_text.splitlines():
        ln = normalize_ocr_chars(raw_ln).strip()

        # 1) si on rencontre un temps → on activera la capture au prochain entier plausible
        if time_pat.search(ln):
            expect_points = True
            continue

        # 2) si on "attend des points", capturer le tout premier entier 3–4 chiffres plausible
        if expect_points:
            m = re.fullmatch(r"(\d{3,4})", ln)
            if m:
                v = int(m.group(1))
                if 300 <= v <= 1200:
                    pts.append(m.group(1))
                    expect_points = False  # on a assigné les points de ce temps
                    continue

        # 3) si on croise un split (ex. 32.28) sans avoir trouvé d'entier, on abandonne l'attente
        if re.fullmatch(r"\d{2}\.\d{2}", ln):
            expect_points = False

    return pts

def assign_points_by_order(records, points_list):
    """
    Assigne par ordre: place 1 → point[0], etc.
    - Ne remplace pas un Points déjà trouvé.
    - S'arrête au min(len(records), len(points_list)).
    """
    k = min(len(records), len(points_list))
    for i in range(k):
        if not records[i].get("Points"):
            records[i]["Points"] = points_list[i]
# -------------------- Recousage vertical --------------------
def assemble_records(lines):
    recs, cur = [], None

    def push():
        nonlocal cur
        if not cur:
            return
        pts = cur.get("Points", "")
        if "Temps" in cur:
            cur["Temps"] = fix_time_if_truncated(cur["Temps"], pts)
        if not cur.get("Points"):
            guess = extract_points_from_raw(cur.get("_raw", ""))
            if guess:
                cur["Points"] = guess
        if "Points" in cur:
            cur["Points"] = norm(cur["Points"])
        if "Club" in cur:
            cur["Club"] = fix_club_text(cur["Club"])
        if "Nationalité" in cur:
            cur["Nationalité"] = canon_nat(cur["Nationalité"])
        if "NomComplet" in cur:
            nomc = fix_name(cur["NomComplet"])
            cur["Nom"], cur["Prénom"] = split_nom_prenom(nomc)

        recs.append({
            "Place": cur.get("Place", ""),
            "Nom": cur.get("Nom", ""),
            "Prénom": cur.get("Prénom", ""),
            "Nationalité": cur.get("Nationalité", ""),
            "Club": cur.get("Club", ""),
            "Temps": cur.get("Temps", ""),
            "Points": cur.get("Points", ""),
            "ExAequo": "Oui" if cur.get("ExAequo") else "Non",
            "Ligne": cur.get("_raw", "").strip()
        })
        cur = None

    i = 0
    while i < len(lines):
        t = lines[i].strip()
        if not t:
            i += 1
            continue

        # ignorer nombres/temps isolés avant un vrai début
        if cur is None and (noisy_number_before_start(t) or looks_like_time(t)):
            i += 1
            continue

        m = START_NUM.match(t) or START_TAG.match(t)
        if m:
            name_part = t[m.end():].strip()
            if len(name_part) < 2 or not re.match(r"[A-Z]", name_part):
                i += 1
                continue
            push()
            rank = m.group("rank").upper()
            cur = {"Place": rank, "NomComplet": name_part, "_raw": t}
            if "ex" in t.lower() and "aequo" in t.lower():
                cur["ExAequo"] = True
            i += 1
            continue

        if cur is None:
            i += 1
            continue

        cur["_raw"] += " | " + t

        # ordre libre : on remplit le prochain champ qui matche
        if "Nationalité" not in cur:
            nat = canon_nat(t)
            if nat:
                cur["Nationalité"] = nat
                i += 1
                continue
        if "Année" not in cur and re.fullmatch(r"\d{4}", norm(t)):
            cur["Année"] = norm(t)
            i += 1
            continue
        if "Club" not in cur:
            club = canon_club(t)
            if club in KNOWN_CLUBS:
                cur["Club"] = club
                i += 1
                continue
        if "Temps" not in cur and looks_like_time(t):
            cur["Temps"] = t
            i += 1
            continue
        if "Points" not in cur and is_points(t):
            cur["Points"] = t
            i += 1
            continue

        i += 1

    push()
    return recs

def parse_ocr_text(text):
    lines = [l for l in text.splitlines()
             if not re.search(r"CADETS|JUNIORS|SENIORS|RÉSULTATS|RESULTATS|NATATION|ÉPREU|EPREU|CATÉGOR", l, re.I)]
    recs = assemble_records(lines)
    # Nouveau : récolte globale puis assignation par ordre
    pts_list = harvest_points_list(text)
    assign_points_by_order(recs, pts_list)
    return recs

# --------------------------- Pipeline ---------------------------
def process_images(paths, out_csv=None, out_xlsx=None, debug_dir="debug"):
    all_rows = []
    for idx, p in enumerate(paths, start=1):
        tag = f"{idx}_{os.path.splitext(os.path.basename(p))[0]}"
        pre = preprocess_for_ocr(p, debug_dir=debug_dir, tag=tag)
        txt = ocr_text(pre, debug_dir=debug_dir, tag=tag)
        rows = parse_ocr_text(txt)
        for r in rows:
            r["Fichier"] = os.path.basename(p)
        all_rows.extend(rows)

    df = pd.DataFrame(all_rows, columns=[
        "Fichier", "Place", "Nom", "Prénom", "Nationalité", "Club", "Temps", "Points", "ExAequo", "Ligne"
    ])

    # garder uniquement les classés numériques, puis renuméroter 1..N
    df = df[df["Place"].str.fullmatch(r"\d{1,2}|TLD|NC|HC")]
    df = df[~df["Place"].str.match(r"TLD|NC|HC", na=False)].reset_index(drop=True)
    df["Place"] = (df.index + 1).astype(str)

    if out_csv:
        df.to_csv(out_csv, index=False, encoding="utf-8-sig")
    if out_xlsx:
        df.to_excel(out_xlsx, index=False)
    return df

def main():
    if len(sys.argv) < 2:
        print("Usage : python ocr_natation.py image1.jpg [image2.png ...] --csv out.csv --xlsx out.xlsx")
        return
    args = sys.argv[1:]
    out_csv = out_xlsx = None
    imgs = []
    i = 0
    while i < len(args):
        if args[i] == "--csv" and i + 1 < len(args):
            out_csv = args[i + 1]; i += 2
        elif args[i] == "--xlsx" and i + 1 < len(args):
            out_xlsx = args[i + 1]; i += 2
        else:
            imgs.append(args[i]); i += 1
    df = process_images(imgs, out_csv=out_csv, out_xlsx=out_xlsx, debug_dir="debug")
    print(df.to_string(index=False, max_colwidth=60))

if __name__ == "__main__":
    main()

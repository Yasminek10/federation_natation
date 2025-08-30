import cv2
import pytesseract
import pandas as pd
import re

# 👉 Config Tesseract (Windows uniquement, sinon commente)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# --- Clubs connus (tu peux enrichir cette liste) ---
KNOWN_CLUBS = {
    "ACADEMIE","ACADEMIEDE","NATATION","ACADEMIE DE NATATION","EST","CA","ASCNS","CMSLS","CNM","LP","ASM","ESS","CSUIP",
    "SUC","ASMT","CNBA","STADE TUNISIEN","GAZEL EL TUNIS","OLYMPICA","MSM","JSB","OCK","AQUARIUM"
}

# --- Nationalités valides ---
VALID_NATIONALITIES = {
    "TUN","ROU","MAR","LBA","EGY","FRA","ITA","ESP","GER","USA","BRA","SEN","CIV","TUR"
}

def process_image(image_path: str):
    """
    Traite une image OCR et retourne une liste de dicts :
    [{ "club": str, "nationalite": str, "points": int }]
    """
    # --- Pré-traitement image ---
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                 cv2.THRESH_BINARY, 11, 2)
    gray = cv2.medianBlur(gray, 3)

    # --- OCR ---
    data = pytesseract.image_to_data(
        gray, output_type=pytesseract.Output.DATAFRAME, config="--oem 3 --psm 6"
    )
    df = data.dropna(subset=['text']).copy()

    records = []

    for _, g in df.groupby('line_num'):
        g = g.sort_values('left')
        tokens = g['text'].tolist()
        line_upper = [t.upper() for t in tokens]

        # --- Détecter le club ---
        club_text, club_index = None, None
        max_tokens_club = 3
        for i in range(len(line_upper)):
            for j in range(max_tokens_club, 0, -1):
                phrase = " ".join(line_upper[i:i+j])
                for known_club in KNOWN_CLUBS:
                    if known_club in phrase:
                        club_text = known_club
                        club_index = i
                        break
                if club_text:
                    break
            if club_text:
                break

        if not club_text or club_index is None:
            continue

        # --- Détecter la nationalité ---
        nationality = "TUN"  # défaut
        tokens_after_club = line_upper[club_index+1:]

        for t in tokens_after_club:
            if re.fullmatch(r"[A-Z]{3}", t):  # exactement 3 lettres
                if t in VALID_NATIONALITIES:
                    nationality = t
                    break

        # --- Détecter les points ---
        points_candidates = []
        for t in tokens_after_club:
            if not t.isdigit():
                continue
            val = int(t)
            if 1900 <= val <= 2025:
                continue  # évite les années
            if val > 2000:
                continue  # bruit OCR
            if val == 0:
                continue
            points_candidates.append(val)

        pts_val = points_candidates[-1] if points_candidates else 0

        records.append({
            "club": club_text,
            "nationalite": nationality,
            "points": pts_val
        })

    # Nettoyage final : supprime doublons et retourne une liste JSON
    out = pd.DataFrame(records).drop_duplicates().reset_index(drop=True)
    return out.to_dict(orient="records")

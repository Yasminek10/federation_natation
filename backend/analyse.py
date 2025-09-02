import pandas as pd
import re
import sys
from sqlalchemy import create_engine, text

# -------------------------------
# 1. Paramètres
# -------------------------------
DB_URL = "postgresql://postgres:yassmin@localhost:5432/NatationDB"
engine = create_engine(DB_URL)

# Nom du fichier passé en argument
if len(sys.argv) < 2:
    print("Usage: python analyse.py 50_m_NAGE_LIBRE_Dames_Classement.csv")
    sys.exit(1)

filename = sys.argv[1]

# -------------------------------
# 2. Extraire infos depuis le nom de fichier
# -------------------------------
match = re.match(r"(\d+)_m_([A-Z_]+)_(Dames|Messieurs|Mixte)", filename)
if not match:
    raise ValueError("Nom du fichier invalide. Attendu : <distance>_m_<NAGE>_<genre>...csv")

distance = int(match.group(1))
nage = match.group(2)
genre = match.group(3)

print(f"📂 Fichier: {filename}")
print(f"➡️  Distance={distance}, Nage={nage}, Genre={genre}")

# -------------------------------
# 3. Charger CSV
# -------------------------------
df = pd.read_csv(filename)

# Séparer "Nom" en nom + prénom
df[["Nom_famille", "Prenom"]] = df["Nom"].str.split(" ", n=1, expand=True)
df["Prenom"] = df["Prenom"].fillna("")

# -------------------------------
# 4. Connexion DB
# -------------------------------
with engine.begin() as conn:
    # Championnat par défaut
    champ_id = conn.execute(
        text("SELECT champ_id FROM championnat WHERE nom=:nom"),
        {"nom": "Championnat auto import 2025"}
    ).scalar()

    if not champ_id:
        champ_id = conn.execute(
            text("""INSERT INTO championnat (nom, saison, datedeb, datefin, lieu, bassin)
                    VALUES (:nom, :saison, :deb, :fin, :lieu, :bassin)
                    RETURNING champ_id"""),
            {
                "nom": "Championnat auto import 2025",
                "saison": "2025",
                "deb": "2025-08-01",
                "fin": "2025-08-31",
                "lieu": "Tunis",
                "bassin": 25
            }
        ).scalar()
        print(f"🏆 Championnat créé: {champ_id}")

    # Épreuve
    epreuve_id = conn.execute(
        text("""SELECT epreuve_id FROM epreuve
                WHERE nage=:nage AND distance=:dist AND genre=:genre AND is_relay=FALSE"""),
        {"nage": nage, "dist": distance, "genre": genre}
    ).scalar()

    if not epreuve_id:
        epreuve_id = conn.execute(
            text("""INSERT INTO epreuve (nage, distance, genre, is_relay, legs_count)
                    VALUES (:nage, :dist, :genre, FALSE, NULL)
                    RETURNING epreuve_id"""),
            {"nage": nage, "dist": distance, "genre": genre}
        ).scalar()
        print(f"🏊 Épreuve créée: {epreuve_id}")

    # Catégorie par défaut
    cat_id = conn.execute(
        text("SELECT categorie_id FROM categorie WHERE nom=:nom"),
        {"nom": "Toutes catégories"}
    ).scalar()

    if not cat_id:
        cat_id = conn.execute(
            text("INSERT INTO categorie (nom) VALUES (:nom) RETURNING categorie_id"),
            {"nom": "Toutes catégories"}
        ).scalar()
        print(f"📂 Catégorie créée: {cat_id}")

    # Lien CEC
    cec_id = conn.execute(
        text("""SELECT cec_id FROM championnat_epreuve_categorie
                WHERE champ_id=:champ AND epreuve_id=:epr AND categorie_id=:cat"""),
        {"champ": champ_id, "epr": epreuve_id, "cat": cat_id}
    ).scalar()

    if not cec_id:
        cec_id = conn.execute(
            text("""INSERT INTO championnat_epreuve_categorie (champ_id, epreuve_id, categorie_id)
                    VALUES (:champ, :epr, :cat) RETURNING cec_id"""),
            {"champ": champ_id, "epr": epreuve_id, "cat": cat_id}
        ).scalar()
        print(f"🔗 CEC créé: {cec_id}")

    # -------------------------------
    # 5. Insérer données du CSV
    # -------------------------------
    for _, row in df.iterrows():
        # Club
        club_id = conn.execute(
            text("SELECT id_club FROM club WHERE nom=:nom"),
            {"nom": row["Club"]}
        ).scalar()
        if not club_id:
            club_id = conn.execute(
                text("INSERT INTO club (nom) VALUES (:nom) RETURNING id_club"),
                {"nom": row["Club"]}
            ).scalar()

        # Nageur
        nageur_id = conn.execute(
            text("""SELECT id_nageur FROM nageur
                    WHERE upper(nom)=upper(:nom) AND upper(prenom)=upper(:prenom)
                      AND id_club=:club_id"""),
            {"nom": row["Nom_famille"], "prenom": row["Prenom"], "club_id": club_id}
        ).scalar()
        if not nageur_id:
            nageur_id = conn.execute(
                text("""INSERT INTO nageur (nom, prenom, birth_year, id_club)
                        VALUES (:nom, :prenom, :birth, :club) RETURNING id_nageur"""),
                {
                    "nom": row["Nom_famille"],
                    "prenom": row["Prenom"],
                    "birth": int(row["Naissance"]),
                    "club": club_id
                }
            ).scalar()

        # Résultat de base
        resultat_id = conn.execute(
            text("""INSERT INTO resultat_base (cec_id, points, place, temps, statut)
                    VALUES (:cec, :points, :place, :temps, 'OK')
                    RETURNING resultat_id"""),
            {
                "cec": cec_id,
                "points": int(row["Points"]),
                "place": None,  # si tu veux gérer le classement il faut une colonne "Place"
                "temps": str(row["Temps (s)"])
            }
        ).scalar()

        # Associer nageur
        conn.execute(
            text("INSERT INTO resultat_individuel (resultat_id, id_nageur) VALUES (:rid, :nid)"),
            {"rid": resultat_id, "nid": nageur_id}
        )

    print("✅ Import terminé avec succès")

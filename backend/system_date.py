from datetime import datetime

def get_categorie_from_birth_year(birth_year: int) -> str:
    if not birth_year:
        return "N/A"

    current_year = datetime.now().year
    age = current_year - birth_year

    # Règles de catégories (à adapter selon ta fédération)
    if age >= 18:
        return "Juniors/Seniors"
    elif 16 <= age <= 17:
        return "Cadets"
    elif 14 <= age <= 15:
        return "Minimes"
    elif 12 <= age <= 13:
        return "Benjamins"
    elif age < 12:
        return "Poussin"
    else:
        return "N/A"


def extraire_nom_annee(championnat):
    nom_champ = championnat.nom if championnat.nom else "Inconnu"
    try:
        annee = championnat.datedeb.year
    except Exception as e:
        print("Erreur extraire_nom_annee:", e)
        annee = "Inconnue"
    return f"{nom_champ} ({annee})"
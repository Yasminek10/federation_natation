# backend/bilan.py
from flask import Blueprint, request, jsonify, make_response
from sqlalchemy import func, and_, asc
from datetime import date
from db import db, Club, Nageur, Categorie, Championnat, CEC, Epreuve, ResultatBase, ResultatIndividuel, ResultatRelais, Equipe, Minimas
from ingest import time_to_seconds, seconds_to_str, is_tunisian  # réutilise helpers existants

bilan_bp = Blueprint("bilan", __name__, url_prefix="/api/bilan")

def _is_eligible_swimmer(n: Nageur) -> bool:
    # Tunisien auto sinon doit être approuvé (eligible_points=True)
    return (is_tunisian(n.nationalite) or bool(n.eligible_points))

def _meet_minima(epreuve_id: int, categorie_id: int, temps: str | None) -> bool:
    if not temps: 
        return False
    m = Minimas.query.filter_by(epreuve_id=epreuve_id, categorie_id=categorie_id).first()
    if not m: 
        return True  # si pas de minima enregistré, on n'exclut pas
    t = time_to_seconds(temps)
    tm = time_to_seconds(m.temp_min)
    return (t is not None and tm is not None and t <= tm)

def _opposite_season(s: str) -> str:
    return "HIVER" if (s or "").upper() == "ETE" else "ETE"

def _previous_champ_same_scope(current: Championnat, categorie_id: int) -> Championnat | None:
    # prend le dernier championnat de la saison opposée avant datedeb
    opp = _opposite_season(current.saison)
    return (
        Championnat.query
        .filter(Championnat.saison == opp, Championnat.datefin < current.datedeb)
        .order_by(Championnat.datefin.desc())
        .first()
    )

@bilan_bp.get("/options")
def options():
    champs = (Championnat.query
              .order_by(Championnat.datefin.desc())
              .all())
    out = []
    for c in champs:
        label = f"{c.nom} — {c.saison} ({c.datedeb.strftime('%d/%m/%Y')} → {c.datefin.strftime('%d/%m/%Y')})"
        out.append({"id": c.champ_id, "label": label})
    return jsonify({"championnats": out})

@bilan_bp.get("/categories")
def cats_for_champ():
    cid = request.args.get("champ_id", type=int)
    if not cid:
        return jsonify({"message": "champ_id manquant"}), 422
    # catégories réellement présentes dans ce championnat via CEC
    rows = (db.session.query(Categorie.categorie_id, Categorie.nom, Categorie.max_places_indiv, Categorie.max_places_relay)
            .join(CEC, CEC.categorie_id == Categorie.categorie_id)
            .filter(CEC.champ_id == cid)
            .distinct()
            .order_by(Categorie.nom.asc())
            .all())
    cats = [{"id": r[0], "nom": r[1], "max_indiv": r[2], "max_relay": r[3]} for r in rows]
    return jsonify({"categories": cats})

@bilan_bp.get("/clubs")
def clubs_all():
    rows = Club.query.order_by(Club.nom.asc()).all()
    return jsonify({"clubs": [{"id": c.id_club, "nom": c.nom} for c in rows]})

def _cap(val, default):
    try:
        return int(val) if val is not None else int(default)
    except:
        return int(default)

def _points_for_club_on_cec(cec: CEC, club_id: int) -> int:
    cat = cec.categorie
    epr = cec.epreuve
    total = 0

    if epr.is_relay:
        cap = _cap(cat.max_places_relay, 1)
        q = (db.session.query(ResultatBase, ResultatRelais, Equipe)
             .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
             .join(Equipe, Equipe.equipe_id == ResultatRelais.equipe_id)
             .filter(ResultatBase.cec_id == cec.cec_id, ResultatBase.statut == "OK", Equipe.id_club == club_id)
             .order_by(asc(ResultatBase.place)))
        count = 0
        for base, rel, eq in q:
            if count >= cap:
                break
            pts = int(base.points or 0)
            # Multiplier par 2 pour relais 4x* uniquement
            if (epr.legs_count or 0) == 4:
                pts *= 2
            total += pts
            count += 1
        return total

    # Individuel: on prend au plus max_places_indiv nageurs éligibles du club, qui passent les minimas
    cap = _cap(cat.max_places_indiv, 3)
    q = (db.session.query(ResultatBase, ResultatIndividuel, Nageur)
         .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
         .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
         .filter(ResultatBase.cec_id == cec.cec_id, ResultatBase.statut == "OK", Nageur.id_club == club_id)
         .order_by(asc(ResultatBase.place), ResultatBase.points.desc()))
    count = 0
    for base, _, nageur in q:
        if count >= cap:
            break
        if not _is_eligible_swimmer(nageur):
            continue
        if not _meet_minima(epr.epreuve_id, cat.categorie_id, base.temps):
            continue
        total += int(base.points or 0)
        count += 1
    return total

def _gender_for_swimmer_in_champ(nageur_id: int, champ_id: int) -> str | None:
    # on déduit du genre des épreuves nagées
    row = (db.session.query(Epreuve.genre)
           .join(CEC, CEC.epreuve_id == Epreuve.epreuve_id)
           .join(ResultatBase, ResultatBase.cec_id == CEC.cec_id)
           .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
           .filter(CEC.champ_id == champ_id, ResultatIndividuel.id_nageur == nageur_id)
           .first())
    return row[0] if row else None

def _club_rankings(champ: Championnat, categorie_id: int):
    # total par club sur toutes les épreuves de cette catégorie
    cecs = CEC.query.filter_by(champ_id=champ.champ_id, categorie_id=categorie_id).all()
    club_totals = {}
    for cec in cecs:
        for club in Club.query:  # petit nb de clubs => simple
            pts = _points_for_club_on_cec(cec, club.id_club)
            if pts:
                club_totals[club.id_club] = club_totals.get(club.id_club, 0) + pts
    # tri
    items = sorted([(cid, pts) for cid, pts in club_totals.items()], key=lambda x: x[1], reverse=True)
    return [{"club": Club.query.get(cid).nom, "points": pts} for cid, pts in items]

def _club_rankings_by_stroke_and_gender(champ: Championnat, categorie_id: int):
    cecs = (db.session.query(CEC, Epreuve)
            .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
            .filter(CEC.champ_id == champ.champ_id, CEC.categorie_id == categorie_id)
            .all())
    out = {}  # { (nage, genre) : [ {club, points}, ... ] }
    for cec, epr in cecs:
        key = (epr.nage, epr.genre)
        if key not in out:
            out[key] = {}
        # cumule par club pour ce CEC
        for club in Club.query:
            pts = _points_for_club_on_cec(cec, club.id_club)
            if pts:
                out[key][club.id_club] = out[key].get(club.id_club, 0) + pts
    # format trié
    formatted = {}
    for (nage, genre), d in out.items():
        arr = sorted([(cid, pts) for cid, pts in d.items()], key=lambda x: x[1], reverse=True)
        formatted[(nage, genre)] = [{"club": Club.query.get(cid).nom, "points": pts} for cid, pts in arr]
    return formatted

def _swimmer_points_in_champ(nageur_id: int, champ_id: int, categorie_id: int) -> int:
    # somme des points individuels éligibles pour ce nageur (filtrage minimas)
    q = (db.session.query(ResultatBase, CEC, Epreuve)
         .join(CEC, CEC.cec_id == ResultatBase.cec_id)
         .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
         .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
         .filter(CEC.champ_id == champ_id, CEC.categorie_id == categorie_id, ResultatIndividuel.id_nageur == nageur_id, ResultatBase.statut=="OK"))
    pts = 0
    nageur = Nageur.query.get(nageur_id)
    for base, cec, epr in q:
        if not _is_eligible_swimmer(nageur): 
            continue
        if not _meet_minima(epr.epreuve_id, cec.categorie_id, base.temps):
            continue
        pts += int(base.points or 0)
    return pts

def _performances_club(champ: Championnat, prev: Championnat | None, categorie_id: int, club_id: int):
    # Pour chaque nageur du club présent dans ce champ/cat, lister ses temps par épreuve,
    # et le temps correspondant dans prev (même épreuve & cat) si trouvé.
    # Dames/Messieurs déduits des épreuves nagées.
    # On limite l’affichage aux résultats de ce championnat (pas besoin de tout l’historique).
    details = {"Dames": {}, "Messieurs": {}}
    cecs = (db.session.query(CEC, Epreuve)
            .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
            .filter(CEC.champ_id == champ.champ_id, CEC.categorie_id == categorie_id)
            .all())

    # map epreuve->cec_id dans prev pour recherche rapide
    prev_map = {}
    if prev:
        prev_cecs = (db.session.query(CEC, Epreuve)
                     .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
                     .filter(CEC.champ_id == prev.champ_id, CEC.categorie_id == categorie_id)
                     .all())
        for pc, pe in prev_cecs:
            prev_map[pe.epreuve_id] = pc.cec_id

    for cec, epr in cecs:
        # résultats du club
        rows = (db.session.query(ResultatBase, ResultatIndividuel, Nageur)
                .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
                .filter(ResultatBase.cec_id == cec.cec_id, ResultatBase.statut=="OK", Nageur.id_club == club_id)
                .order_by(asc(ResultatBase.place))
                .all())
        for base, _, nageur in rows:
            genre = _gender_for_swimmer_in_champ(nageur.id_nageur, champ.champ_id) or "Messieurs"
            bucket = details["Dames" if genre=="Dames" else "Messieurs"]
            if nageur.id_nageur not in bucket:
                bucket[nageur.id_nageur] = {
                    "nom": f"{nageur.nom} {nageur.prenom}",
                    "epreuves": []
                }
            # temps previous
            prev_time = None
            if prev and epr.epreuve_id in prev_map:
                rprev = (db.session.query(ResultatBase)
                         .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                         .filter(ResultatBase.cec_id == prev_map[epr.epreuve_id],
                                 ResultatIndividuel.id_nageur == nageur.id_nageur,
                                 ResultatBase.statut=="OK")
                         .order_by(asc(ResultatBase.place))
                         .first())
                prev_time = rprev.temps if rprev else None
            bucket[nageur.id_nageur]["epreuves"].append({
                "label": f"{epr.distance}m {epr.nage}",
                "prev": prev_time,
                "curr": base.temps
            })
    # transformer en listes
    dames = list(details["Dames"].values())
    messieurs = list(details["Messieurs"].values())
    # cumuls par nageur (points)
    def with_points(lst):
        out = []
        for sw in lst:
            # récup id via nom/prenom… on peut recalculer en DB pour fiabilité si besoin
            nageur = Nageur.query.filter(func.concat(Nageur.nom, " ", Nageur.prenom) == sw["nom"]).first()
            sw_pts = _swimmer_points_in_champ(nageur.id_nageur, champ.champ_id, categorie_id) if nageur else 0
            out.append({**sw, "points": sw_pts})
        return out
    return with_points(dames), with_points(messieurs)

def render_bilan_html(champ: Championnat, categorie: Categorie, club: Club):
    prev = _previous_champ_same_scope(champ, categorie.categorie_id)
    # classements général & par nage/genre
    rank_all = _club_rankings(champ, categorie.categorie_id)
    rank_by = _club_rankings_by_stroke_and_gender(champ, categorie.categorie_id)
    dames, messieurs = _performances_club(champ, prev, categorie.categorie_id, club.id_club)

    # relais du club
    rel_rows = (db.session.query(ResultatBase, ResultatRelais, CEC, Epreuve)
                .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
                .join(CEC, CEC.cec_id == ResultatBase.cec_id)
                .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
                .filter(CEC.champ_id == champ.champ_id, CEC.categorie_id == categorie.categorie_id,
                        ResultatBase.statut=="OK")
                .join(Equipe, and_(Equipe.equipe_id == ResultatRelais.equipe_id, Equipe.id_club == club.id_club))
                .order_by(asc(ResultatBase.place))
                .all())
    relais = []
    for base, _, _, epr in rel_rows:
        pts = int(base.points or 0)
        if (epr.legs_count or 0) == 4:
            pts *= 2
        relais.append({
            "label": f"{epr.legs_count}x{epr.distance}m {epr.nage}",
            "genre": epr.genre,
            "temps": base.temps or "—",
            "points": pts,
            "place": base.place or "—",
        })

    # HTML — structure inspirée du document fourni (sans synthèse)
    prev_label = f"{_opposite_season(champ.saison).title()}" if prev else "—"
    html = f"""
<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body {{ font-family: Arial, sans-serif; }}
  h1,h2,h3 {{ margin: 0.2rem 0; }}
  table {{ width:100%; border-collapse: collapse; margin: 8px 0; }}
  th, td {{ border: 1px solid #999; padding: 4px 6px; font-size: 12px; }}
  th {{ background:#f3f3f3; }}
  .muted {{ color:#666; }}
  .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
</style>
</head><body>
  <h1>BILAN — {club.nom}</h1>
  <div class="muted">Championnat: <b>{champ.nom}</b> — {champ.saison} ({champ.datedeb.strftime('%d/%m/%Y')} → {champ.datefin.strftime('%d/%m/%Y')})</div>
  <div class="muted">Catégorie: <b>{categorie.nom}</b></div>

  <h2>Classement général des Clubs</h2>
  <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
    {''.join(f"<tr><td>{i+1}</td><td>{r['club']}</td><td>{r['points']}</td></tr>" for i,r in enumerate(rank_all))}
  </tbody></table>

  <h2>Performances générales des nageurs</h2>

  <h3>Dames</h3>
  {''.join(f"""
  <div>
    <b>{sw['nom']}</b>
    <table>
      <thead><tr><th>Nage</th><th>Temps {prev_label}</th><th>Temps {champ.saison.title()}</th></tr></thead>
      <tbody>
      {''.join(f"<tr><td>{e['label']}</td><td>{e['prev'] or '—'}</td><td>{e['curr'] or '—'}</td></tr>" for e in sw['epreuves'])}
      </tbody>
    </table>
  </div>""" for sw in dames)}

  <h3>Messieurs</h3>
  {''.join(f"""
  <div>
    <b>{sw['nom']}</b>
    <table>
      <thead><tr><th>Nage</th><th>Temps {prev_label}</th><th>Temps {champ.saison.title()}</th></tr></thead>
      <tbody>
      {''.join(f"<tr><td>{e['label']}</td><td>{e['prev'] or '—'}</td><td>{e['curr'] or '—'}</td></tr>" for e in sw['epreuves'])}
      </tbody>
    </table>
  </div>""" for sw in messieurs)}

  <h2>Cumul des points par nageur</h2>
  <div class="two-col">
    <div>
      <h3>Dames</h3>
      <table><thead><tr><th>N°</th><th>NOM &amp; PRENOM</th><th>CUMULES DES POINTS</th></tr></thead><tbody>
      {''.join(f"<tr><td>{i+1}</td><td>{sw['nom']}</td><td>{sw['points']}</td></tr>" for i,sw in enumerate(sorted(dames, key=lambda x: x['points'], reverse=True)))}
      </tbody></table>
    </div>
    <div>
      <h3>Messieurs</h3>
      <table><thead><tr><th>N°</th><th>NOM &amp; PRENOM</th><th>CUMULES DES POINTS</th></tr></thead><tbody>
      {''.join(f"<tr><td>{i+1}</td><td>{sw['nom']}</td><td>{sw['points']}</td></tr>" for i,sw in enumerate(sorted(messieurs, key=lambda x: x['points'], reverse=True)))}
      </tbody></table>
    </div>
  </div>

  <h2>Classement des Clubs par nage et par genre</h2>
  {''.join(f"""
    <h3>{nage} — {genre}</h3>
    <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
    {''.join(f"<tr><td>{i+1}</td><td>{r['club']}</td><td>{r['points']}</td></tr>" for i,r in enumerate(lst))}
    </tbody></table>
  """ for (nage, genre), lst in rank_by.items())}

  <h2>Relais</h2>
  <table>
    <thead><tr><th>Nage</th><th>Genre</th><th>Temps</th><th>Points (×2 si 4×)</th><th>Classement</th></tr></thead>
    <tbody>
      {''.join(f"<tr><td>{r['label']}</td><td>{r['genre']}</td><td>{r['temps']}</td><td>{r['points']}</td><td>{r['place']}</td></tr>" for r in relais)}
    </tbody>
  </table>

  <!-- PAS DE SYNTHÈSE -->
</body></html>
"""
    return html

@bilan_bp.route("/generate", methods=["GET", "POST"])
def generate():
    # Accept both GET (querystring) and POST (JSON)
    if request.method == "GET":
        champ_id = request.args.get("champ_id", type=int)
        categorie_id = request.args.get("categorie_id", type=int)
        club_id = request.args.get("club_id", type=int)
    else:
        data = request.get_json(silent=True) or {}
        champ_id = int(data.get("champ_id") or 0)
        categorie_id = int(data.get("categorie_id") or 0)
        club_id = int(data.get("club_id") or 0)

    if not champ_id or not categorie_id or not club_id:
        return jsonify({"message": "Paramètres requis: champ_id, categorie_id, club_id"}), 422

    champ = Championnat.query.get(champ_id)
    categorie = Categorie.query.get(categorie_id)
    club = Club.query.get(club_id)
    if not champ or not categorie or not club:
        return jsonify({"message": "Objet introuvable"}), 404

    # Build printable HTML (no WeasyPrint)
    html = render_bilan_html(champ, categorie, club)

    # Auto-open the browser print dialog
    html = html.replace(
        "</body>",
        "<script>window.addEventListener('load',function(){try{window.print()}catch(e){}});</script></body>"
    )

    resp = make_response(html)
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    return resp



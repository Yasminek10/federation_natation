# backend/bilan.py
from flask import Blueprint, request, jsonify, make_response
from sqlalchemy import func, and_, asc
from datetime import date
from db import db, Club, Nageur, Categorie, Championnat, CEC, Epreuve, ResultatBase, EquipeMembre, ResultatIndividuel, ResultatRelais, Equipe, Minimas
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
        # TOP 8 global (ou valeur en base) + minimas relais + éligibilité des 4/10 membres
        cap = _cap(cat.max_places_relay, 8)
        q = (db.session.query(ResultatBase, ResultatRelais, Equipe)
             .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
             .join(Equipe, Equipe.equipe_id == ResultatRelais.equipe_id)
             .filter(ResultatBase.cec_id == cec.cec_id,
                     ResultatBase.statut == "OK",
                     ResultatBase.place.isnot(None),
                     ResultatBase.place <= cap,
                     Equipe.id_club == club_id))

        for base, _, eq in q:
            # 1) Minima sur le temps d'équipe
            if not _meet_minima(epr.epreuve_id, cat.categorie_id, base.temps):
                continue
            # 2) Tous les membres doivent être éligibles
            mems = (db.session.query(Nageur)
                    .join(EquipeMembre, EquipeMembre.nageur_id == Nageur.id_nageur)
                    .filter(EquipeMembre.equipe_id == eq.equipe_id)
                    .order_by(EquipeMembre.leg_order.asc())
                    .all())
            if not mems or (epr.legs_count and len(mems) < epr.legs_count):
                continue
            if not all(_is_eligible_swimmer(n) for n in mems):
                continue
            # 3) Relais = points ×2
            total += int(base.points or 0) * 2
        return total

    # Individuel : filtre GLOBAL par place ≤ max_places_indiv + minimas + éligibilité
    cap = _cap(cat.max_places_indiv, 8)  # la valeur réelle provient de la table 'categorie'
    q = (db.session.query(ResultatBase, ResultatIndividuel, Nageur)
         .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
         .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
         .filter(ResultatBase.cec_id == cec.cec_id,
                 ResultatBase.statut == "OK",
                 ResultatBase.place.isnot(None),
                 ResultatBase.place <= cap,
                 Nageur.id_club == club_id))

    for base, _, nageur in q:
        if not _is_eligible_swimmer(nageur):
            continue
        if not _meet_minima(epr.epreuve_id, cat.categorie_id, base.temps):
            continue
        total += int(base.points or 0)
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
    # Classement par nage & genre en n'incluant QUE l'individuel
    cecs = (db.session.query(CEC, Epreuve)
            .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
            .filter(CEC.champ_id == champ.champ_id,
                    CEC.categorie_id == categorie_id,
                    Epreuve.is_relay == False)
            .all())
    out = {}  # { (nage, genre): {club_id: points} }
    for cec, epr in cecs:
        key = (epr.nage, epr.genre)
        if key not in out:
            out[key] = {}
        for club in Club.query:
            pts = _points_for_club_on_cec(cec, club.id_club)  # ici, ce seront forcément des points d'individuel
            if pts:
                out[key][club.id_club] = out[key].get(club.id_club, 0) + pts

    formatted = {}
    for (nage, genre), d in out.items():
        arr = sorted(d.items(), key=lambda x: x[1], reverse=True)
        formatted[(nage, genre)] = [{"club": Club.query.get(cid).nom, "points": pts} for cid, pts in arr]
    return formatted

def _club_rankings_by_gender(champ: Championnat, categorie_id: int, genre: str, is_relay: bool | None):
    q = (db.session.query(CEC, Epreuve)
         .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
         .filter(CEC.champ_id == champ.champ_id,
                 CEC.categorie_id == categorie_id,
                 Epreuve.genre == genre))
    if is_relay is not None:
        q = q.filter(Epreuve.is_relay == is_relay)  # True => relais only, False => individuel only
    cecs = q.all()

    totals = {}
    for cec, _ in cecs:
        for club in Club.query:
            pts = _points_for_club_on_cec(cec, club.id_club)  # ici les relais restent doublés (logique de calcul)
            if pts:
                totals[club.id_club] = totals.get(club.id_club, 0) + pts
    items = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    return [{"club": Club.query.get(cid).nom, "points": pts} for cid, pts in items]

def _pair_gender_rankings(champ: Championnat, categorie_id: int, is_relay: bool | None):
    return (
        _club_rankings_by_gender(champ, categorie_id, "Messieurs", is_relay),
        _club_rankings_by_gender(champ, categorie_id, "Dames", is_relay),
    )

def _swimmer_points_in_champ(nageur_id: int, champ_id: int, categorie_id: int) -> int:
    """
    Somme des points INDIVIDUELS éligibles d’un nageur :
      - place renseignée et comprise dans la limite de la catégorie
      - statut == 'OK'
      - nageur éligible (nationalité TN ou eligible_points)
      - respect des minimas (épreuve + catégorie)
    Les relais ne sont pas inclus (jointure via ResultatIndividuel).
    """
    categorie = db.session.get(Categorie, categorie_id)
    cap = _cap(categorie.max_places_indiv if categorie else None, 8)

    q = (db.session.query(ResultatBase, CEC, Epreuve)
         .join(CEC, CEC.cec_id == ResultatBase.cec_id)
         .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
         .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
         .filter(
             CEC.champ_id == champ_id,
             CEC.categorie_id == categorie_id,
             ResultatIndividuel.id_nageur == nageur_id,
             ResultatBase.statut == "OK",
             ResultatBase.place.isnot(None),
             ResultatBase.place >= 1,
             ResultatBase.place <= cap,
         ))

    nageur = Nageur.query.get(nageur_id)
    pts_total = 0

    # si le nageur n'est pas éligible, aucun point (même si des résultats existent)
    if not nageur or not _is_eligible_swimmer(nageur):
        return 0

    for base, cec, epr in q:
        # vérifie le minima pour l'épreuve/catégorie du CEC
        if not _meet_minima(epr.epreuve_id, cec.categorie_id, base.temps):
            continue
        pts_total += int(base.points or 0)

    return pts_total

def _performances_club(champ: Championnat, prev: Championnat | None, categorie_id: int, club_id: int):
    details = {"Dames": {}, "Messieurs": {}}

    cecs = (db.session.query(CEC, Epreuve)
            .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
            .filter(CEC.champ_id == champ.champ_id, CEC.categorie_id == categorie_id)
            .all())

    prev_map = {}
    if prev:
        prev_cecs = (db.session.query(CEC, Epreuve)
                     .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
                     .filter(CEC.champ_id == prev.champ_id, CEC.categorie_id == categorie_id)
                     .all())
        for pc, pe in prev_cecs:
            prev_map[pe.epreuve_id] = (pc.cec_id, pe)

    for cec, epr in cecs:
        rows = (db.session.query(ResultatBase, ResultatIndividuel, Nageur)
                .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
                .filter(ResultatBase.cec_id == cec.cec_id, Nageur.id_club == club_id)
                .order_by(asc(ResultatBase.place))
                .all())
        for base, _, nageur in rows:
            genre = _gender_for_swimmer_in_champ(nageur.id_nageur, champ.champ_id) or "Messieurs"
            bucket = details["Dames" if genre == "Dames" else "Messieurs"]
            if nageur.id_nageur not in bucket:
                bucket[nageur.id_nageur] = {"nom": f"{nageur.nom} {nageur.prenom}", "epreuves": [], "_seen": set()}

            # temps "previous" s'il existe pour la même épreuve
            prev_time = None
            if prev and epr.epreuve_id in prev_map:
                prev_cec_id, _ = prev_map[epr.epreuve_id]
                rprev = (db.session.query(ResultatBase)
                         .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                         .filter(ResultatBase.cec_id == prev_cec_id,
                                 ResultatIndividuel.id_nageur == nageur.id_nageur)
                         .order_by(asc(ResultatBase.place))
                         .first())
                if rprev:
                    prev_time = rprev.temps

            bucket[nageur.id_nageur]["epreuves"].append({
                "label": f"{epr.distance}m {epr.nage}",
                "prev": prev_time,
                "curr": base.temps,
                "epr_id": epr.epreuve_id,  # <- utile pour minima
            })
            bucket[nageur.id_nageur]["_seen"].add(epr.epreuve_id)

    # épreuves nagées seulement en Hiver
    if prev:
        for sexe in ["Dames", "Messieurs"]:
            for nageur_id, sw in list(details[sexe].items()):
                seen = sw.get("_seen", set())
                for epr_id, (prev_cec_id, pe) in prev_map.items():
                    if epr_id in seen:
                        continue
                    rprev = (db.session.query(ResultatBase)
                             .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
                             .filter(ResultatBase.cec_id == prev_cec_id,
                                     ResultatIndividuel.id_nageur == nageur_id)
                             .order_by(asc(ResultatBase.place))
                             .first())
                    if rprev:
                        sw["epreuves"].append({
                            "label": f"{pe.distance}m {pe.nage}",
                            "prev": rprev.temps,
                            "curr": None,
                            "epr_id": pe.epreuve_id,  # <- pour minima
                        })

    def cleanup(lst):
        out = []
        for sw in lst.values():
            sw.pop("_seen", None)
            nageur = Nageur.query.filter(func.concat(Nageur.nom, " ", Nageur.prenom) == sw["nom"]).first()
            sw_pts = _swimmer_points_in_champ(nageur.id_nageur, champ.champ_id, categorie_id) if nageur else 0
            out.append({"id_nageur": nageur.id_nageur if nageur else 0, **sw, "points": sw_pts})
        return out

    return cleanup(details["Dames"]), cleanup(details["Messieurs"])

def render_bilan_html(champ: Championnat, categorie: Categorie, club: Club, selected_ids: list[int] | None = None):
    prev = _previous_champ_same_scope(champ, categorie.categorie_id)

    # Classements
    rank_all = _club_rankings(champ, categorie.categorie_id)
    rank_by = _club_rankings_by_stroke_and_gender(champ, categorie.categorie_id)
    rank_by_grouped = {}
    for (nage, genre), lst in rank_by.items():
        g = rank_by_grouped.setdefault(nage, {"Messieurs": [], "Dames": []})
        g[genre] = lst

    all_m, all_f = _pair_gender_rankings(champ, categorie.categorie_id, is_relay=None)
    relay_m, relay_f = _pair_gender_rankings(champ, categorie.categorie_id, is_relay=True)

    # Perfs du club
    dames, messieurs = _performances_club(champ, prev, categorie.categorie_id, club.id_club)
    if selected_ids:
        dames = [sw for sw in dames if sw["id_nageur"] in selected_ids]
        messieurs = [sw for sw in messieurs if sw["id_nageur"] in selected_ids]

    # Relais du club
    rel_rows = (
        db.session.query(ResultatBase, ResultatRelais, CEC, Epreuve)
        .join(ResultatRelais, ResultatRelais.resultat_id == ResultatBase.resultat_id)
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
        .filter(
            CEC.champ_id == champ.champ_id,
            CEC.categorie_id == categorie.categorie_id,
            ResultatBase.statut == "OK",
        )
        .join(Equipe, and_(Equipe.equipe_id == ResultatRelais.equipe_id, Equipe.id_club == club.id_club))
        .order_by(asc(ResultatBase.place))
        .all()
    )
    relais = [{
        "label": f"{epr.legs_count}x{epr.distance}m {epr.nage}",
        "genre": epr.genre,
        "temps": base.temps or "—",
        "points": int(base.points or 0),
        "place": base.place or "—",
    } for base, _, _, epr in rel_rows]

    # Helpers rendu
    def self_class(nom_club: str) -> str:
        return ' class="self"' if (nom_club or '').strip().lower() == (club.nom or '').strip().lower() else ''

    def mark_time(t: str | None, epr_id: int) -> str:
        if t and _meet_minima(epr_id, categorie.categorie_id, t):
            return f'<span class="minok">{t}</span>'
        return (t or "—")

    prev_label = f"{_opposite_season(champ.saison).title()}" if prev else "—"
    season_title = champ.saison.title()

    def render_swimmers(swimmers: list[dict]) -> str:
        sections = []
        for sw in swimmers:
            rows = ''.join(
                f"<tr><td>{e['label']}</td>"
                f"<td>{mark_time(e.get('prev'), e['epr_id'])}</td>"
                f"<td>{mark_time(e.get('curr'), e['epr_id'])}</td></tr>"
                for e in sw['epreuves']
            )
            sections.append(
                f"""
  <div class="swimmer" data-id="{sw.get('id_nageur', 0)}">
    <b>{sw['nom']}</b>
    <table>
      <thead><tr><th>Nage</th><th>Temps {prev_label}</th><th>Temps {season_title}</th></tr></thead>
      <tbody>
      {rows}
      </tbody>
    </table>
  </div>"""
            )
        return "\n".join(sections)

    def render_table(rows):
        return ''.join(
            f"<tr{self_class(r['club'])}><td>{i+1}</td><td>{r['club']}</td><td>{r['points']}</td></tr>"
            for i, r in enumerate(rows)
        )

    def render_rank_by_grouped() -> str:
        parts = []
        for nage, group in rank_by_grouped.items():
            rows_m = render_table(group.get("Messieurs", []))
            rows_f = render_table(group.get("Dames", []))
            parts.append(
                f"""
    <h3>{nage}</h3>
    <div class="two-col">
      <div>
        <h4>Messieurs</h4>
        <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
          {rows_m}
        </tbody></table>
      </div>
      <div>
        <h4>Dames</h4>
        <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
          {rows_f}
        </tbody></table>
      </div>
    </div>"""
            )
        return "\n".join(parts)

    # Blocs pré-rendus (pour éviter les f-strings imbriqués)
    rank_all_rows = render_table(rank_all)
    all_m_rows = render_table(all_m)
    all_f_rows = render_table(all_f)
    relay_m_rows = render_table(relay_m)
    relay_f_rows = render_table(relay_f)
    dames_html = render_swimmers(dames)
    messieurs_html = render_swimmers(messieurs)
    by_grouped_html = render_rank_by_grouped()
    relais_rows = ''.join(
        f"<tr><td>{r['label']}</td><td>{r['genre']}</td><td>{r['temps']}</td><td>{r['points']}</td><td>{r['place']}</td></tr>"
        for r in relais
    )

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
  /* club courant en ROUGE */
  tr.self td {{ color:#d00; font-weight:700; }}
  @media print {{
    tr.self td {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  }}
  /* temps qui respectent le minima en VERT */
  .minok {{ color:#0a8a0a; font-weight:600; }}
</style>
</head><body>
  <h1>BILAN — {club.nom}</h1>
  <div class="muted">Championnat: <b>{champ.nom}</b> — {champ.saison} ({champ.datedeb.strftime('%d/%m/%Y')} → {champ.datefin.strftime('%d/%m/%Y')})</div>
  <div class="muted">Catégorie: <b>{categorie.nom}</b></div>

  <h2>Classement général des Clubs</h2>
  <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
    {rank_all_rows}
  </tbody></table>

  <h2>Performances générales des nageurs</h2>

  <h3>Dames</h3>
  {dames_html}

  <h3>Messieurs</h3>
  {messieurs_html}

  <h2>Cumul des points par nageur</h2>
  <div class="two-col">
    <div>
      <h3>Dames</h3>
      <table><thead><tr><th>N°</th><th>NOM &amp; PRENOM</th><th>CUMULES DES POINTS</th></tr></thead><tbody>
      {''.join(f"<tr><td>{i+1}</td><td>{sw['nom']}</td><td>{sw['points']}</td></tr>" for i, sw in enumerate(sorted(dames, key=lambda x: x['points'], reverse=True)))}
      </tbody></table>
    </div>
    <div>
      <h3>Messieurs</h3>
      <table><thead><tr><th>N°</th><th>NOM &amp; PRENOM</th><th>CUMULES DES POINTS</th></tr></thead><tbody>
      {''.join(f"<tr><td>{i+1}</td><td>{sw['nom']}</td><td>{sw['points']}</td></tr>" for i, sw in enumerate(sorted(messieurs, key=lambda x: x['points'], reverse=True)))}
      </tbody></table>
    </div>
  </div>

  <h2>Classement par genre — Toutes les nages (individuel + relais)</h2>
  <div class="two-col">
    <div>
      <h3>Classement des Messieurs (toutes les nages)</h3>
      <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
        {all_m_rows}
      </tbody></table>
    </div>
    <div>
      <h3>Classement des Dames (toutes les nages)</h3>
      <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
        {all_f_rows}
      </tbody></table>
    </div>
  </div>

  <h2>Classement par genre — RELAIS</h2>
  <div class="two-col">
    <div>
      <h3>Classement des Messieurs (RELAIS)</h3>
      <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
        {relay_m_rows}
      </tbody></table>
    </div>
    <div>
      <h3>Classement des Dames (RELAIS)</h3>
      <table><thead><tr><th>N°</th><th>Club</th><th>Somme des Points</th></tr></thead><tbody>
        {relay_f_rows}
      </tbody></table>
    </div>
  </div>

  <h2>Classement des Clubs par nage et par genre</h2>
  {by_grouped_html}

  <h2>Relais</h2>
  <table>
    <thead><tr><th>Nage</th><th>Genre</th><th>Temps</th><th>Points</th><th>Classement</th></tr></thead>
    <tbody>
      {relais_rows}
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
        nageurs_str = request.args.get("nageurs")
    else:
        data = request.get_json(silent=True) or {}
        champ_id = int(data.get("champ_id") or 0)
        categorie_id = int(data.get("categorie_id") or 0)
        club_id = int(data.get("club_id") or 0)
        nageurs_str = data.get("nageurs")

    if not champ_id or not categorie_id or not club_id:
        return jsonify({"message": "Paramètres requis: champ_id, categorie_id, club_id"}), 422

    champ = Championnat.query.get(champ_id)
    categorie = Categorie.query.get(categorie_id)
    club = Club.query.get(club_id)
    if not champ or not categorie or not club:
        return jsonify({"message": "Objet introuvable"}), 404
    
    selected_ids = []
    if nageurs_str:
        try:
            import json
            selected_ids = json.loads(nageurs_str)
            # sécurité : ne garder que des entiers
            selected_ids = [int(x) for x in selected_ids if str(x).isdigit()]
        except Exception as e:
            print("Erreur parsing nageurs :", e)
    
    # Filtrer avant rendu
    if selected_ids:
        def filtered_performances(champ, categorie, club):
            dames, messieurs = _performances_club(champ, _previous_champ_same_scope(champ, categorie.categorie_id),
                                                  categorie.categorie_id, club.id_club)
            dames = [sw for sw in dames if sw["id_nageur"] in selected_ids]
            messieurs = [sw for sw in messieurs if sw["id_nageur"] in selected_ids]
            return dames, messieurs

        # Patch temporaire du rendu pour inclure seulement les nageurs filtrés
        from types import SimpleNamespace
        champ_data = SimpleNamespace(**{
            "champ": champ,
            "categorie": categorie,
            "club": club,
            "performances": filtered_performances(champ, categorie, club)
        })

        html = render_bilan_html(champ, categorie, club, selected_ids)
    else:
        html = render_bilan_html(champ, categorie, club, selected_ids)

    # Auto-open the browser print dialog
    html = html.replace(
        "</body>",
        "<script>window.addEventListener('load',function(){try{window.print()}catch(e){}});</script></body>"
    )

    resp = make_response(html)
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    return resp


@bilan_bp.get("/nageurs_participants")
def nageurs_participants():
    """
    Renvoie la liste des nageurs d’un club ayant participé
    à un championnat donné dans une catégorie donnée.
    """
    champ_id = request.args.get("champ_id", type=int)
    categorie_id = request.args.get("categorie_id", type=int)
    club_id = request.args.get("club_id", type=int)

    if not champ_id or not categorie_id or not club_id:
        return jsonify({"message": "Paramètres requis"}), 422

    # jointure sur ResultatBase -> ResultatIndividuel -> Nageur -> CEC
    q = (
        db.session.query(Nageur)
        .join(ResultatIndividuel, ResultatIndividuel.id_nageur == Nageur.id_nageur)
        .join(ResultatBase, ResultatBase.resultat_id == ResultatIndividuel.resultat_id)
        .join(CEC, CEC.cec_id == ResultatBase.cec_id)
        .filter(
            Nageur.id_club == club_id,
            CEC.champ_id == champ_id,
            CEC.categorie_id == categorie_id
        )
        .distinct()
        .order_by(Nageur.nom.asc(), Nageur.prenom.asc())
    )

    nageurs = [
        {
            "id_nageur": n.id_nageur,
            "nom": n.nom,
            "prenom": n.prenom
        }
        for n in q
    ]
    return jsonify({"nageurs": nageurs})

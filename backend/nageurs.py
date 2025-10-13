from datetime import datetime
from flask import Blueprint, jsonify
from system_date import get_categorie_from_birth_year,extraire_nom_annee

from ingest import time_to_seconds, is_tunisian
import unicodedata
from db import db, Nageur, ResultatBase, ResultatIndividuel, CEC, Epreuve, Minimas, Championnat, Categorie

nageurs_bp = Blueprint("nageurs", __name__, url_prefix="/api/nageurs")
nageursDetails_bp = Blueprint("nageursDetails", __name__, url_prefix="/api/nageursDetails")

# ==============================
# Liste globale des nageurs
# ==============================
@nageurs_bp.route("/", methods=["GET"])
def get_all_nageurs():
    nageurs = db.session.query(Nageur).all()
    data = []

    for n in nageurs:
        genre = None
        if n.resultats_individuels:
            ri = n.resultats_individuels[0]
            if ri.base and ri.base.cec and ri.base.cec.epreuve:
                genre = ri.base.cec.epreuve.genre

        categorie = get_categorie_from_birth_year(n.birth_year)

        data.append({
            "id": n.id_nageur,
            "nom": n.nom,
            "prenom": n.prenom,
            "full_name": f"{n.prenom} {n.nom}",
            "nationalite": n.nationalite,
            "birth_year": n.birth_year,
            "eligible": n.eligible_points,
            "genre": "F" if genre == "Dames" else "M",
            "categorie": categorie,
            "id_club": n.id_club,
            "club_nom": n.club.nom if n.club else None
        })

    return jsonify(data)


# --- helpers éligibilité/minimas (si pas déjà définis plus haut) ---
def _is_eligible_swimmer(n: Nageur) -> bool:
    from ingest import is_tunisian
    return (is_tunisian(n.nationalite) or bool(n.eligible_points))

def _meet_minima(epreuve_id: int, categorie_id: int, temps: str | None) -> bool:
    if not temps:
        return False
    m = Minimas.query.filter_by(epreuve_id=epreuve_id, categorie_id=categorie_id).first()
    if not m:
        return True
    t = time_to_seconds(temps)
    tm = time_to_seconds(m.temp_min)
    return (t is not None and tm is not None and t <= tm)

# --- AJOUT: normalisation texte + détection des championnats “TC” et des 4 catégories ---
def _norm(txt: str | None) -> str:
    """lowercase + sans accents + trim"""
    s = unicodedata.normalize("NFKD", (txt or "").strip())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower()

def _tc_champ_enabled(ch: Championnat) -> bool:
    """
    True si:
      - le nom du championnat contient 'tc'
      - ET les catégories disponibles couvrent minimes, cadets, juniors et seniors
        (on accepte 'juniors/seniors', 'j/s', 'js', etc.)
    """
    name_ok = "tc" in _norm(ch.nom)

    # catégories présentes dans ce championnat (via CEC)
    rows = (db.session.query(Categorie.nom)
            .join(CEC, CEC.categorie_id == Categorie.categorie_id)
            .filter(CEC.champ_id == ch.champ_id)
            .distinct()
            .all())
    names = [_norm(r[0]) for r in rows]

    def has(substr: str) -> bool:
        return any(substr in n for n in names)

    # gérer les combinés J/S
    has_js_combo = any(("j/s" in n) or ("junior" in n and "senior" in n) or (n.replace(" ", "") == "js")
                       for n in names)

    has_minimes = has("minime")
    has_cadets  = has("cadet")
    has_juniors = has("junior") or has_js_combo
    has_seniors = has("senior") or has_js_combo

    cats_ok = (has_minimes and has_cadets and has_juniors and has_seniors)
    return (name_ok and cats_ok)

def _tc_podiums_for_champ(champ_id: int):
    """
    Calcule le podium TC (top-3) par épreuve (individuel uniquement) pour un championnat.
    Filtre: statut OK, nageur éligible, minima respecté.
    Renvoie une liste d'entrées: {
        'epreuve_id', 'epr_label', 'nageur_id', 'tc_place', 'points', 'temps'
    }
    """
    rows = (db.session.query(ResultatBase, ResultatIndividuel, Nageur, CEC, Epreuve)
            .join(ResultatIndividuel, ResultatIndividuel.resultat_id == ResultatBase.resultat_id)
            .join(Nageur, Nageur.id_nageur == ResultatIndividuel.id_nageur)
            .join(CEC, CEC.cec_id == ResultatBase.cec_id)
            .join(Epreuve, Epreuve.epreuve_id == CEC.epreuve_id)
            .filter(CEC.champ_id == champ_id,
                    Epreuve.is_relay == False,
                    ResultatBase.statut == "OK")
            .all())

    by_epr = {}  # epreuve_id -> list[ dict(...) ]
    for base, ri, nageur, cec, epr in rows:
        if not _is_eligible_swimmer(nageur):
            continue
        if not _meet_minima(epr.epreuve_id, cec.categorie_id, base.temps):
            continue
        entry = {
            "epreuve_id": epr.epreuve_id,
            "epr_label": f"{epr.distance}m {epr.nage} ({epr.genre})",
            "nageur_id": nageur.id_nageur,
            "points": int(base.points or 0),
            "temps": base.temps,
            "sec": time_to_seconds(base.temps) or 10**9,  # pour briser les égalités
            "place_raw": base.place or 10**6
        }
        by_epr.setdefault(epr.epreuve_id, []).append(entry)

    out = []
    for epr_id, lst in by_epr.items():
        lst.sort(key=lambda x: (-x["points"], x["sec"], x["place_raw"]))
        podium = lst[:3]
        for i, it in enumerate(podium, start=1):
            out.append({
                "epreuve_id": it["epreuve_id"],
                "epr_label": it["epr_label"],
                "nageur_id": it["nageur_id"],
                "tc_place": i,
                "points": it["points"],
                "temps": it["temps"],
            })
    return out




def _event_key(epr_label: str) -> tuple:
    """
    Convertit '100m Nage Libre (Messieurs)' -> ('Nage Libre', 100, 'Messieurs')
    Tolérant si le format est inhabituel.
    """
    try:
        main, _, rest = epr_label.partition('m ')
        distance = int(main.strip())
        nage, _, genre_paren = rest.partition(' (')
        genre = genre_paren.replace(')', '').strip() if genre_paren else None
        return (nage.strip(), distance, genre)
    except Exception:
        return (epr_label, None, None)

def _build_training_suggestions(stats, trend, dq_stats):
    """
    Transforme les métriques en conseils lisibles.
    stats: dict avec 'events_summary', 'best_events', 'minima_fail_hotspots', 'versatility', 'stroke_averages'
    trend: dict avec 'by_year' (liste {'year','avg_points'}), 'last_change'
    dq_stats: {'dsq': int, 'dns_dnf': int, 'total': int}
    """
    suggestions = []

    # 1) Profil sprinter vs endurance (selon les distances des meilleures épreuves)
    if stats.get("best_events"):
        best_distances = [e.get("distance") for e in stats["best_events"] if e.get("distance")]
        if best_distances:
            short_cnt = sum(1 for d in best_distances if d and d <= 100)
            long_cnt  = sum(1 for d in best_distances if d and d >= 200)
            if short_cnt >= 2 and long_cnt == 0:
                suggestions.append("Profil sprinter : consolider la vitesse (explosivité, départs/virages, lactique court, séries 25–50m).")
            elif long_cnt >= 2 and short_cnt == 0:
                suggestions.append("Profil endurance : accentuer l’aérobie/tempo (200–800m, pacing négatif, seuil).")
            else:
                suggestions.append("Profil mixte : alterner blocs vitesse (25–50m) et aérobie (200–400m) sur la semaine.")

    # 2) Moyennes par nage → force/faiblesse
    stroke_avgs = stats.get("stroke_averages", {})
    if stroke_avgs:
        best_stroke = max(stroke_avgs.items(), key=lambda kv: kv[1])[0]
        worst_stroke = min(stroke_avgs.items(), key=lambda kv: kv[1])[0]
        suggestions.append(f"Force : {best_stroke}. Continuer le volume spécifique + vitesse de course.")
        suggestions.append(f"Faiblesse : {worst_stroke}. 2×/sem technique ciblée (drills, coordination bras-jambes).")

    # 3) Minimas : hotspots
    for hot in stats.get("minima_fail_hotspots", [])[:2]:
        suggestions.append(
            f"Minimas irréguliers en {hot['distance']}m {hot['nage']} : économie gestuelle + virages. "
            f"Objectif : +{hot['target_points_boost']} pts via séries au seuil."
        )

    # 4) Tendance points (année → année)
    lc = trend.get("last_change")
    if lc is not None:
        if lc < -10:
            suggestions.append("Baisse récente : micro-cycle de récupération + bilan charge/sommeil ; rééquilibrer intensités.")
        elif lc > 10:
            suggestions.append("Progression notable : garder la structure, placer des compétitions de repère.")

    # 5) DSQ / DNS-DNF
    if dq_stats.get("dsq", 0) >= 2:
        suggestions.append("DSQ multiples : sécuriser la conformité technique (départs/coulées/virages) — vidéo + feedback.")
    if dq_stats.get("dns_dnf", 0) >= 2:
        suggestions.append("DNS/DNF fréquents : routine échauffement + nutrition/hydratation à revoir.")

    # 6) Variété de nages
    if stats.get("versatility", 0) <= 1:
        suggestions.append("Variété limitée : introduire 1 séance hebdo d’une autre nage (prévention blessures + transferts techniques).")

    return suggestions[:6]
# ==============================
# Détails d’un nageur
# ==============================
@nageursDetails_bp.route("/<int:nageur_id>", methods=["GET"])
def get_nageur_details(nageur_id):
    nageur = Nageur.query.get(nageur_id)
    if not nageur:
        return jsonify({"error": "Nageur introuvable"}), 404

    # --- Helpers d'affichage ---
    def clean_str(x): return (x or "").strip()

    def t2s(t):
        if not t: return None
        t = str(t).strip().lower().replace(",", ".")
        if any(bad in t for bad in ["dsq","disq","disqual","dns","dnf","nc","n.d.","nd","forfait","frf"]):
            return None
        try:
            if ":" in t:
                m, s = t.split(":")
                return float(m) * 60 + float(s)
            return float(t)
        except Exception:
            return None

    def s2t(x):
        if x is None: return None
        if x >= 60:
            m = int(x // 60); s = x % 60
            return f"{m}:{s:05.2f}"
        return f"{x:.2f}"


    def label_champ_with_year(ch: Championnat):
        try:
            return f"{ch.nom or 'Inconnu'} ({ch.datedeb.year})"
        except Exception:
            return f"{ch.nom or 'Inconnu'}"

    def leg_time_only(split_raw: str | None) -> str:
        return clean_str(split_raw)
    
    
    # --- Infos nageur ---
    nageur_data = {
        "id": nageur.id_nageur,
        "nom": nageur.nom,
        "prenom": nageur.prenom,
        "club": nageur.club.nom if nageur.club else None,
        "nationalite": nageur.nationalite,
        "birth_year": nageur.birth_year,
    }

    # --- Individuels ---
    historiques, indiv_secs, indiv_points = [], [], []
    champs_ids_for_tc = set()

    for ri in nageur.resultats_individuels:
        base = ri.base
        cec = base.cec
        ch, epr, cat = cec.championnat, cec.epreuve, cec.categorie
        champs_ids_for_tc.add(ch.champ_id)

        sec = t2s(base.temps)
        if sec is not None and base.statut == "OK":
            indiv_secs.append(sec)
        if base.points is not None:
            indiv_points.append(base.points)

        historiques.append({
            "championnat": label_champ_with_year(ch),
            "saison": ch.saison,
            "epreuve": f"{epr.distance}m {epr.nage} ({epr.genre})",
            "categorie": cat.nom,
            "temps": base.temps,
            "points": base.points,
            "place": base.place,
            "statut": base.statut,
        })

    # --- Relais ---
    relais_resultats = []
    relay_first_leg_secs = []

    for membre in nageur.equipes_membre:
        eq = membre.equipe
        cec = eq.cec
        ch, epr, cat = cec.championnat, cec.epreuve, cec.categorie
        champs_ids_for_tc.add(ch.champ_id)

        base_relais = eq.resultats_relais[0].base if eq.resultats_relais else None

        leg_txt = leg_time_only(membre.split_time)
        leg_sec = t2s(leg_txt)

        if (membre.leg_order == 1 and epr.nage == "Nage Libre"
                and base_relais is not None and base_relais.statut == "OK"
                and leg_sec is not None):
            relay_first_leg_secs.append(leg_sec)

        relais_resultats.append({
            "championnat": label_champ_with_year(ch),
            "saison": ch.saison,
            "epreuve": f"{epr.legs_count}x{epr.distance}m {epr.nage} ({epr.genre})",
            "categorie": cat.nom,
            "club": eq.club.nom if eq.club else None,
            "role": f"Relais {membre.leg_order}",
            "leg_order": membre.leg_order,
            "split_50": leg_txt or "-",
            "split_2nd_50": "",
            "split_time": leg_txt or "-",
            "temps_total": (base_relais.temps if base_relais else None),
            "place": (base_relais.place if base_relais else None),
            "statut": (base_relais.statut if base_relais else None),
            "points": (base_relais.points if base_relais else None),
        })

    # --- Médailles TC (traçabilité) ---
    medailles_tc = []
    for cid in champs_ids_for_tc:
        ch = Championnat.query.get(cid)
        if not ch:
            continue
        # >>> AJOUT DU FILTRE “TC seulement si nom + 4 catégories”
        if not _tc_champ_enabled(ch):
            continue

        podiums = _tc_podiums_for_champ(cid)  # ta fonction existante
        for p in podiums:
            if p["nageur_id"] == nageur.id_nageur:
                medailles_tc.append({
                    "championnat": f"{ch.nom} ({ch.datedeb.year})",
                    "saison": ch.saison,
                    "epreuve": p["epr_label"],
                    "tc_place": p["tc_place"],   # 1, 2 ou 3
                    "points": p["points"],
                    "temps": p["temps"] or "-",
                })

    # --- Analyses ---
    best_candidates = [*indiv_secs, *relay_first_leg_secs]
    best_sec = min(best_candidates) if best_candidates else None
    analyses = {
        "nb_courses": len(historiques),
        "meilleur_temps": s2t(best_sec) if best_sec is not None else None,
        "points_moyens": (sum(indiv_points) / len(indiv_points)) if indiv_points else None,
    }

    # === NOUVEAU: Stats détaillées / tendances / conseils ===
    # 1) Individuels valides (statut OK) pour les métriques
    indiv_valid = []
    for h in historiques:
        if (h.get("statut") or "").upper() != "OK":
            continue
        key_nage, key_dist, key_genre = _event_key(h["epreuve"])
        indiv_valid.append({
            "epreuve": h["epreuve"],
            "nage": key_nage,
            "distance": key_dist,
            "genre": key_genre,
            "temps": h["temps"],
            "sec": t2s(h["temps"]),
            "points": h["points"] or 0,
            "championnat": h["championnat"],
            "saison": h["saison"]
        })

    # 2) Tendance par année (moyenne des points)
    trend_by_year = {}
    for it in indiv_valid:
        # extraire l'année de "xxx (YYYY)"
        year = None
        if it["championnat"]:
            m = str(it["championnat"])
            if "(" in m and ")" in m:
                try:
                    year = int(m[m.find("(")+1:m.find(")")])
                except Exception:
                    year = None
        if year is None:
            continue
        trend_by_year.setdefault(year, []).append(it["points"])
    trend_years = sorted(trend_by_year.keys())
    trend_series = [{"year": y, "avg_points": (sum(trend_by_year[y]) / len(trend_by_year[y]))} for y in trend_years]
    last_change = None
    if len(trend_series) >= 2:
        last_change = trend_series[-1]["avg_points"] - trend_series[-2]["avg_points"]

    # 3) Résumés par (nage, distance)
    events_map = {}  # (nage, distance) -> list
    for it in indiv_valid:
        if it["nage"] and it["distance"]:
            events_map.setdefault((it["nage"], it["distance"]), []).append(it)

    events_summary = []
    minima_fail_hotspots = []
    stroke_points = {}

    for (nage, distance), arr in events_map.items():
        pts = [x["points"] for x in arr if x["points"] is not None]
        secs = [x["sec"] for x in arr if x["sec"] is not None]
        avg_pts = sum(pts)/len(pts) if pts else 0
        best_pts = max(pts) if pts else 0
        best_sec_e = min(secs) if secs else None
        best_time = s2t(best_sec_e) if best_sec_e is not None else None

        # approxim. du taux de minima OK (on tient compte de toutes les tentatives, OK=points>0 & statut OK)
        attempts, ok_minima = 0, 0
        for h in historiques:
            n2, d2, _g2 = _event_key(h["epreuve"])
            if n2 == nage and d2 == distance:
                attempts += 1
                if (h.get("statut") or "").upper() == "OK" and (h.get("points") or 0) > 0:
                    ok_minima += 1
        minima_rate = (ok_minima / attempts) if attempts else None

        events_summary.append({
            "nage": nage, "distance": distance, "starts": attempts,
            "avg_points": round(avg_pts, 1), "best_points": best_pts, "best_time": best_time,
            "minima_success": round(minima_rate*100, 1) if minima_rate is not None else None
        })

        stroke_points.setdefault(nage, []).append(avg_pts)

        if minima_rate is not None and attempts >= 3 and minima_rate < 0.6:
            target_boost = max(0, round((0.75 - minima_rate) * 100))  # objectif simple
            minima_fail_hotspots.append({
                "nage": nage, "distance": distance,
                "attempts": attempts,
                "success": round(minima_rate*100, 1),
                "target_points_boost": target_boost
            })

    # 4) Moyennes par nage
    stroke_averages = {k: round(sum(v)/len(v), 1) for k, v in stroke_points.items() if v}

    # 5) Top 3 meilleures épreuves (≥2 départs)
    best_events = sorted(
        [e for e in events_summary if e["starts"] >= 2],
        key=lambda e: (e["avg_points"], e["best_points"]),
        reverse=True
    )[:3]

    # 6) Versatility: nb de nages différentes nagées ≥2 fois
    versatility = sum(1 for _k, v in events_map.items() if len(v) >= 2)

    # 7) DSQ / DNS / DNF
    dsq = sum(1 for h in historiques if str(h.get("statut")).upper() == "DSQ")
    dns_dnf = sum(1 for h in historiques if str(h.get("statut")).upper() in ("DNS", "DNF"))
    dq_stats = {"dsq": dsq, "dns_dnf": dns_dnf, "total": len(historiques)}  # <- ATTENTION: 'historiques' (avec s)

    # 8) Conseils
    insights_stats = {
        "events_summary": events_summary,
        "best_events": best_events,
        "minima_fail_hotspots": minima_fail_hotspots,
        "versatility": versatility,
        "stroke_averages": stroke_averages
    }
    insights_trend = {"by_year": trend_series, "last_change": round(last_change, 1) if last_change is not None else None}
    suggestions = _build_training_suggestions(insights_stats, insights_trend, dq_stats)

    return jsonify({
        "nageur": nageur_data,
        "historique": historiques,
        "analyses": analyses,
        "relais": relais_resultats,
        "medailles_tc": medailles_tc,
        "insights": {
            "events_summary": events_summary,
            "best_events": best_events,
            "stroke_averages": stroke_averages,
            "versatility": versatility,
            "trend": insights_trend,
            "dq_stats": dq_stats,
            "suggestions": suggestions,
        },
    })

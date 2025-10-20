from flask import Blueprint, request, jsonify
from sqlalchemy import func, or_, and_
from sqlalchemy import asc, desc
from db import (
    db, Championnat, CEC, Categorie, Epreuve,
    ResultatBase, ResultatIndividuel, ResultatRelais,
    Nageur, Club, Equipe, EquipeMembre
)

swimmers_bp = Blueprint("swimmers", __name__, url_prefix="/api/swimmers")


TUN_SET = {"TUN", "TUNISIE", "TN", "TUN."}
def _norm(s: str | None) -> str:
    return (s or "").strip().upper()

@swimmers_bp.get("/approvals")
def list_approvals():
    search     = (request.args.get("search") or "").strip()
    club_id    = request.args.get("club_id", type=int)
    only_pend  = (request.args.get("only_pending") or "0") in {"1","true","True"}
    page       = max(1, request.args.get("page", type=int) or 1)
    page_size  = min(200, request.args.get("page_size", type=int) or 50)

    year_min   = request.args.get("year_min", type=int)
    year_max   = request.args.get("year_max", type=int)

    q = (
        db.session.query(
            Nageur.id_nageur.label("id"),
            Nageur.nom, Nageur.prenom, Nageur.birth_year,
            Nageur.nationalite, Nageur.eligible_points,
            Club.id_club, Club.nom.label("club"),
        )
        .join(Club, Club.id_club == Nageur.id_club)
    )

    # On liste les nageurs non-TUN (ou nationalité vide)
    non_tun_filter = or_(
        Nageur.nationalite.is_(None),
        ~func.upper(Nageur.nationalite).in_(list(TUN_SET))
    )
    q = q.filter(non_tun_filter)

    # Optionnel: ne montrer que ceux non autorisés actuellement
    if only_pend:
        q = q.filter(or_(Nageur.eligible_points.is_(None), Nageur.eligible_points.is_(False)))

    if club_id:
        q = q.filter(Nageur.id_club == club_id)

    if search:
        s = f"%{search.upper()}%"
        q = q.filter(or_(func.upper(Nageur.nom).like(s), func.upper(Nageur.prenom).like(s)))

    if year_min is not None:
        q = q.filter(Nageur.birth_year.isnot(None)).filter(Nageur.birth_year >= year_min)
    if year_max is not None:
        q = q.filter(Nageur.birth_year.isnot(None)).filter(Nageur.birth_year <= year_max)


    total = q.count()
    rows  = (q.order_by(Club.nom.asc(), Nageur.nom.asc(), Nageur.prenom.asc())
               .offset((page-1)*page_size).limit(page_size).all())

    data = [{
        "id": r.id,
        "nom": r.nom,
        "prenom": r.prenom,
        "birth_year": r.birth_year,
        "club_id": r.id_club,
        "club": r.club,
        "nationalite": r.nationalite,   # affichée à titre informatif seulement
        "eligible_points": bool(r.eligible_points) if r.eligible_points is not None else False,
    } for r in rows]

    return jsonify({"items": data, "total": total, "page": page, "page_size": page_size})

@swimmers_bp.patch("/<uuid:public_id>")
def update_swimmer(public_id):
    payload = request.get_json(silent=True) or {}
    n = Nageur.query.filter_by(public_id=public_id).first_or_404()
    if not n:
        return jsonify({"status":"error","message":"Nageur introuvable"}), 404

    if "eligible_points" in payload:
        n.eligible_points = bool(payload["eligible_points"])

    db.session.commit()
    return jsonify({"status":"ok"})

@swimmers_bp.post("/approvals/bulk")
def bulk_update():
    payload = request.get_json(silent=True) or {}
    updates = payload.get("updates", [])  # [{id, eligible_points}, ...]
    if not isinstance(updates, list):
        return jsonify({"status":"error","message":"Format invalide"}), 400

    ids = [u.get("id") for u in updates if "id" in u]
    if not ids:
        return jsonify({"status":"ok","updated":0})

    swimmers = Nageur.query.filter(Nageur.id_nageur.in_(ids)).all()
    by_id = {u["id"]: bool(u.get("eligible_points", False)) for u in updates}

    count = 0
    for s in swimmers:
        val = by_id.get(s.id_nageur, None)
        if val is not None and s.eligible_points != val:
            s.eligible_points = val
            count += 1

    db.session.commit()
    return jsonify({"status":"ok","updated":count})



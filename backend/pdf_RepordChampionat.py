from flask import Blueprint, send_file, jsonify
import requests
from io import BytesIO
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
import os
from datetime import datetime

pdf_report_bp = Blueprint("pdf_report_bp", __name__)
API_BASE = os.environ.get("API_BASE", "http://localhost:5000")


def _header_footer(canvas, doc):
    """En-tête & pied de page PDF."""
    canvas.saveState()
    width, height = landscape(A4)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(30, height - 25, "🏊 Fédération Nationale de Natation — Rapport de Championnat")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - 30, 20, f"Généré le {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    canvas.restoreState()


@pdf_report_bp.route("/api/pdf/report/<uuid:public_id>")
def generate_pdf_report(public_id):
    """
    Génère un rapport PDF du championnat basé sur le public_id (UUID)
    """
    try:
        # 1️⃣ Récupération des données via API
        s_res = requests.get(f"{API_BASE}/api/epreuves/statistiques/cumul/{public_id}", timeout=10)
        c_res = requests.get(f"{API_BASE}/api/bilan/cumul_points_clubs/{public_id}", timeout=10)
        s_res.raise_for_status()
        c_res.raise_for_status()
        stats = s_res.json() or []
        championnat = c_res.json() or {}

        # 2️⃣ Calcul des points totaux
        total_points = {}
        categories = championnat.get("categories", [])
        for cat in categories:
            for cl in (cat.get("classement") or []):
                total_points[cl.get("club")] = total_points.get(cl.get("club"), 0) + (cl.get("points") or 0)

        top_clubs = sorted(
            [{"club": k, "points": v} for k, v in total_points.items()],
            key=lambda x: x["points"],
            reverse=True,
        )
        top3 = top_clubs[:3]
        top_club = top_clubs[0] if top_clubs else {"club": "-", "points": 0}

        # 3️⃣ Préparation du document
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=40,
            leftMargin=40,
            topMargin=60,
            bottomMargin=40,
        )
        elements = []

        # Styles
        styles = getSampleStyleSheet()
        styleH = ParagraphStyle(
            'Heading', parent=styles['Heading1'], fontSize=18, textColor=colors.darkblue, alignment=TA_CENTER
        )
        styleSub = ParagraphStyle(
            'SubHeading', parent=styles['Heading2'], fontSize=14, textColor=colors.darkred, alignment=TA_CENTER
        )
        styleN = ParagraphStyle(
            'Normal', parent=styles['Normal'], fontSize=11, leading=16, alignment=TA_CENTER
        )

        # 4️⃣ En-tête du rapport
        elements.append(Spacer(1, 50))
        elements.append(Paragraph(f"🏆 Rapport de Championnat — {championnat.get('championnat', '-')}", styleH))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Saison : <b>{championnat.get('saison', '-')}</b>", styleN))
        elements.append(Paragraph(f"Dates : {championnat.get('datedeb', '-')} → {championnat.get('datefin', '-')}", styleN))
        elements.append(Spacer(1, 20))

        # 5️⃣ Résumé général
        elements.append(Paragraph("<b>Résumé Général</b>", styleSub))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"🏅 Nombre total de clubs : <b>{len(total_points)}</b>", styleN))
        elements.append(Paragraph(f"🥇 Club leader : <b>{top_club['club']}</b> ({top_club['points']} pts)", styleN))
        elements.append(Spacer(1, 25))

        # 6️⃣ Top 3 clubs
        if top3:
            elements.append(Paragraph("<b>Top 3 — Points cumulés</b>", styleSub))
            data_top3 = [["Rang", "Club", "Points"]]
            for i, c in enumerate(top3, start=1):
                medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉"
                data_top3.append([f"{medal} {i}", c["club"], c["points"]])
            table_top3 = Table(data_top3, hAlign='CENTER', colWidths=[80, 250, 100])
            table_top3.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey])
            ]))
            elements.append(table_top3)
            elements.append(Spacer(1, 25))

        # 7️⃣ Classement par catégorie
        if categories:
            elements.append(Paragraph("<b>Classement détaillé par catégorie</b>", styleSub))
            for cat in categories:
                elements.append(Spacer(1, 10))
                elements.append(Paragraph(f"🏊 Catégorie : <b>{cat.get('categorie', '-')}</b>", styleN))
                data_cat = [["Rang", "Club", "Points"]]
                classement = cat.get("classement", [])
                if not classement:
                    data_cat.append(["—", "Aucun club classé", "—"])
                else:
                    for i, club in enumerate(classement, start=1):
                        medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else str(i)
                        data_cat.append([medal, club.get("club", "-"), club.get("points", 0)])
                table_cat = Table(data_cat, hAlign='CENTER', colWidths=[60, 250, 100])
                table_cat.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkred),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey])
                ]))
                elements.append(table_cat)
                elements.append(Spacer(1, 20))
            elements.append(PageBreak())

        # 8️⃣ Répartition Dames
        if stats:
            elements.append(Paragraph("<b>Répartition — Dames par épreuve</b>", styleSub))
            elements.append(Spacer(1, 10))
            data_dames = [["Distance", "Nage", "Cumul Dames"]]
            for s in stats:
                data_dames.append([f"{s.get('distance')}m", s.get('nage'), s.get('dames', 0)])
            table_dames = Table(data_dames, hAlign='CENTER', colWidths=[100, 150, 120])
            table_dames.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.pink),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey])
            ]))
            elements.append(table_dames)
            elements.append(Spacer(1, 20))

        # 9️⃣ Répartition Messieurs
        if stats:
            elements.append(Paragraph("<b>Répartition — Messieurs par épreuve</b>", styleSub))
            elements.append(Spacer(1, 10))
            data_messieurs = [["Distance", "Nage", "Cumul Messieurs"]]
            for s in stats:
                data_messieurs.append([f"{s.get('distance')}m", s.get('nage'), s.get('messieurs', 0)])
            table_messieurs = Table(data_messieurs, hAlign='CENTER', colWidths=[100, 150, 120])
            table_messieurs.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.blue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey])
            ]))
            elements.append(table_messieurs)
            elements.append(Spacer(1, 20))

        # 🔟 Génération du PDF
        doc.build(elements, onFirstPage=_header_footer, onLaterPages=_header_footer)
        buffer.seek(0)
        filename = f"Rapport_{(championnat.get('championnat') or 'championnat').replace('/', '_')}.pdf"
        return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name=filename)

    except requests.RequestException as re:
        return jsonify({"error": "Impossible de récupérer les données", "details": str(re)}), 500
    except Exception as e:
        return jsonify({"error": "Erreur interne", "details": str(e)}), 500

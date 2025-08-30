import tempfile, os
from flask import Blueprint, request, jsonify
from ocr_service import process_image

ocr_bp = Blueprint("ocr", __name__, url_prefix="/api/ocr")

@ocr_bp.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400

    file = request.files["file"]

    # Crée un fichier temporaire qui sera supprimé automatiquement
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        tmp.write(file.read())  # Écrit le contenu du fichier uploadé
        tmp.flush()             # S’assure que tout est écrit sur le disque
        tmp_name = tmp.name

    try:
        results = process_image(tmp_name)
    finally:
        # Supprime le fichier après lecture
        if os.path.exists(tmp_name):
            os.remove(tmp_name)

    return jsonify(results)

from flask import Blueprint, request, jsonify
from app.middleware.auth import require_auth
from app.services.claude_converter import convert_pdf_to_latex, MAX_FILE_SIZE

convert_bp = Blueprint("convert", __name__, url_prefix="/convert")


@convert_bp.route("/pdf-to-latex", methods=["POST"])
@require_auth
def pdf_to_latex():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "File must be a PDF"}), 400

    pdf_bytes = file.read()
    if len(pdf_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": f"File exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit"}), 413

    try:
        latex = convert_pdf_to_latex(pdf_bytes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 413
    except Exception as e:
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 502

    return jsonify({"latex": latex}), 200

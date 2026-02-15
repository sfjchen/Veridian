import logging
import os
import base64
from typing import Tuple

from flask import Blueprint, Response, request, jsonify, g
from app.middleware.auth import require_auth
from app.services.claude_converter import convert_pdf_to_latex
from app.services.supabase_client import get_supabase_admin_client
from app.services.pdf_preview import render_pdf_first_page_png

log = logging.getLogger(__name__)

convert_bp = Blueprint("convert", __name__, url_prefix="/convert")


@convert_bp.route("/pdf-to-latex", methods=["POST"])
@require_auth
def pdf_to_latex() -> Tuple[Response, int]:
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename provided"}), 400

    _, ext = os.path.splitext(file.filename)
    if ext.lower() != ".pdf":
        return jsonify({"error": "File must be a PDF"}), 400

    pdf_bytes = file.read()

    try:
        latex = convert_pdf_to_latex(pdf_bytes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 413
    except Exception as e:
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 502

    assignment_id: str | None = request.args.get("assignment_id")
    if assignment_id:
        try:
            client = get_supabase_admin_client()
            assignment = client.table("assignments").select("classroom_id").eq(
                "id", assignment_id
            ).execute()
            if not assignment.data:
                log.warning("Assignment %s not found for latex save", assignment_id)
            else:
                classroom_id = assignment.data[0]["classroom_id"]
                classroom = client.table("classrooms").select("teacher_id").eq(
                    "id", classroom_id
                ).execute()
                if not classroom.data or g.user_id != classroom.data[0]["teacher_id"]:
                    log.warning("User %s denied latex save to assignment %s", g.user_id, assignment_id)
                else:
                    client.table("assignments").update({"prompt_latex": latex}).eq(
                        "id", assignment_id
                    ).execute()
        except Exception:
            log.exception("Failed to save prompt_latex to assignment %s", assignment_id)

    return jsonify({"latex": latex}), 200


@convert_bp.route("/pdf-to-preview-image", methods=["POST"])
@require_auth
def pdf_to_preview_image() -> Tuple[Response, int]:
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename provided"}), 400

    _, ext = os.path.splitext(file.filename)
    if ext.lower() != ".pdf":
        return jsonify({"error": "File must be a PDF"}), 400

    pdf_bytes = file.read()

    try:
        png_bytes = render_pdf_first_page_png(pdf_bytes)
    except ValueError as e:
        message = str(e)
        if "exceeds" in message:
            return jsonify({"error": message}), 413
        return jsonify({"error": message}), 400
    except Exception as e:
        return jsonify({"error": f"Preview generation failed: {str(e)}"}), 502

    return jsonify({
        "mime_type": "image/png",
        "image_base64": base64.b64encode(png_bytes).decode("ascii"),
    }), 200

import sys
import uuid
from flask import Blueprint, Response, request, jsonify, g
from app.middleware.auth import require_role, require_auth
from app.services.supabase_client import get_supabase_client
from app.services.storage import generate_upload_url, generate_download_url

corpus_bp = Blueprint("corpus", __name__)

ALLOWED_FILE_TYPES = {"pdf", "txt", "docx", "doc", "md", "tex", "rtf"}


def _validate_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["POST"])
@require_role("teacher")
def create_corpus_file(classroom_id: str) -> tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "display_name and file_type required"}), 400

    display_name = str(data.get("display_name", "")).strip()
    file_type = str(data.get("file_type", "")).strip().lower()

    if not display_name or not file_type:
        return jsonify({"error": "display_name and file_type required"}), 400

    if file_type not in ALLOWED_FILE_TYPES:
        allowed = ", ".join(sorted(ALLOWED_FILE_TYPES))
        return jsonify({"error": f"file_type must be one of: {allowed}"}), 400

    client = get_supabase_client()

    classroom = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", g.user_id).execute()
    if not classroom.data:
        return jsonify({"error": "Classroom not found"}), 404

    file_id = str(uuid.uuid4())
    storage_path = f"{classroom_id}/{file_id}"

    try:
        record = client.table("corpus_files").insert({
            "id": file_id,
            "classroom_id": classroom_id,
            "display_name": display_name,
            "storage_path": storage_path,
            "file_type": file_type,
        }).execute()
    except Exception as e:
        print(f"Failed to insert corpus file: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to create corpus file"}), 500

    if not record.data:
        return jsonify({"error": "Failed to create corpus file"}), 500

    try:
        upload_url = generate_upload_url("corpus", storage_path)
    except Exception as e:
        print(f"Failed to generate upload URL: {e}", file=sys.stderr)
        try:
            client.table("corpus_files").delete().eq("id", file_id).execute()
        except Exception:
            print(f"Failed to clean up orphaned corpus_file {file_id}", file=sys.stderr)
        return jsonify({"error": "Failed to generate upload URL"}), 500

    return jsonify({
        **record.data[0],
        "upload_url": upload_url,
    }), 201


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["GET"])
@require_auth
def list_corpus_files(classroom_id: str) -> tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_client()

    if g.user_role == "teacher":
        check = client.table("classrooms").select("id").eq(
            "id", classroom_id
        ).eq("teacher_id", g.user_id).execute()
    else:
        check = client.table("classroom_memberships").select("classroom_id").eq(
            "classroom_id", classroom_id
        ).eq("student_id", g.user_id).execute()

    if not check.data:
        return jsonify({"error": "Classroom not found or access denied"}), 404

    files = client.table("corpus_files").select("*").eq(
        "classroom_id", classroom_id
    ).order("uploaded_at", desc=True).execute()

    result = []
    for f in files.data:
        try:
            download_url = generate_download_url("corpus", f["storage_path"])
        except Exception as e:
            print(f"Failed to generate download URL for {f['storage_path']}: {e}", file=sys.stderr)
            download_url = None
        result.append({**f, "download_url": download_url})

    return jsonify(result), 200

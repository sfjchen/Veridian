import uuid
from flask import Blueprint, request, jsonify, g
from app.middleware.auth import require_role, require_auth
from app.services.supabase_client import get_supabase_client
from app.services.storage import generate_upload_url, generate_download_url

corpus_bp = Blueprint("corpus", __name__)


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["POST"])
@require_role("teacher")
def create_corpus_file(classroom_id: str):
    data = request.get_json()
    if not data or not data.get("display_name") or not data.get("file_type"):
        return jsonify({"error": "display_name and file_type required"}), 400

    client = get_supabase_client()

    # Verify teacher owns this classroom
    classroom = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", g.user_id).execute()
    if not classroom.data:
        return jsonify({"error": "Classroom not found"}), 404

    file_id = str(uuid.uuid4())
    storage_path = f"{classroom_id}/{file_id}"

    record = client.table("corpus_files").insert({
        "id": file_id,
        "classroom_id": classroom_id,
        "display_name": data["display_name"],
        "storage_path": storage_path,
        "file_type": data["file_type"],
    }).execute()

    upload_url = generate_upload_url("corpus", storage_path)

    return jsonify({
        **record.data[0],
        "upload_url": upload_url,
    }), 201


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["GET"])
@require_auth
def list_corpus_files(classroom_id: str):
    client = get_supabase_client()

    # Verify access: teacher owns or student is member
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
        download_url = generate_download_url("corpus", f["storage_path"])
        result.append({**f, "download_url": download_url})

    return jsonify(result), 200

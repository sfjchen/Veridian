import uuid
from flask import Blueprint, request, jsonify, g
from app.middleware.auth import require_auth, require_role
from app.services.supabase_client import get_supabase_client
from app.services.storage import generate_upload_url, generate_download_url

assignments_bp = Blueprint("assignments", __name__)


@assignments_bp.route("/classrooms/<classroom_id>/assignments", methods=["POST"])
@require_role("teacher")
def create_assignment(classroom_id: str):
    data = request.get_json()
    if not data or not data.get("title"):
        return jsonify({"error": "title required"}), 400

    client = get_supabase_client()

    classroom = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", g.user_id).execute()
    if not classroom.data:
        return jsonify({"error": "Classroom not found"}), 404

    assignment_id = str(uuid.uuid4())
    prompt_path = f"{classroom_id}/{assignment_id}/prompt"
    answer_key_path = f"{classroom_id}/{assignment_id}/answer_key"

    record = client.table("assignments").insert({
        "id": assignment_id,
        "classroom_id": classroom_id,
        "title": data["title"],
        "prompt_storage_path": prompt_path,
        "answer_key_storage_path": answer_key_path,
        "context_file_ids": data.get("context_file_ids", []),
        "due_date": data.get("due_date"),
    }).execute()

    prompt_upload_url = generate_upload_url("assignments", prompt_path)
    answer_key_upload_url = generate_upload_url("assignments", answer_key_path)

    return jsonify({
        **record.data[0],
        "prompt_upload_url": prompt_upload_url,
        "answer_key_upload_url": answer_key_upload_url,
    }), 201


@assignments_bp.route("/classrooms/<classroom_id>/assignments", methods=["GET"])
@require_auth
def list_assignments(classroom_id: str):
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

    assignments = client.table("assignments").select("*").eq(
        "classroom_id", classroom_id
    ).order("created_at", desc=True).execute()

    return jsonify(assignments.data), 200


@assignments_bp.route("/assignments/<assignment_id>", methods=["GET"])
@require_auth
def get_assignment(assignment_id: str):
    client = get_supabase_client()

    assignment = client.table("assignments").select(
        "*, classrooms(teacher_id)"
    ).eq("id", assignment_id).execute()

    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    record = assignment.data[0]
    classroom_teacher_id = record.get("classrooms", {}).get("teacher_id")

    is_teacher = g.user_id == classroom_teacher_id
    if not is_teacher:
        membership = client.table("classroom_memberships").select("student_id").eq(
            "classroom_id", record["classroom_id"]
        ).eq("student_id", g.user_id).execute()
        if not membership.data:
            return jsonify({"error": "Access denied"}), 403

    result = {**record}
    result.pop("classrooms", None)

    if record.get("prompt_storage_path"):
        result["prompt_download_url"] = generate_download_url(
            "assignments", record["prompt_storage_path"]
        )

    if is_teacher and record.get("answer_key_storage_path"):
        result["answer_key_download_url"] = generate_download_url(
            "assignments", record["answer_key_storage_path"]
        )

    return jsonify(result), 200


@assignments_bp.route("/assignments/<assignment_id>/submissions", methods=["POST"])
@require_role("student")
def create_submission(assignment_id: str):
    client = get_supabase_client()

    assignment = client.table("assignments").select("id, classroom_id").eq(
        "id", assignment_id
    ).execute()

    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    classroom_id = assignment.data[0]["classroom_id"]

    membership = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).eq("student_id", g.user_id).execute()

    if not membership.data:
        return jsonify({"error": "Not enrolled in this classroom"}), 403

    submission_id = str(uuid.uuid4())
    storage_path = f"{classroom_id}/{g.user_id}/{submission_id}"

    record = client.table("submissions").insert({
        "id": submission_id,
        "assignment_id": assignment_id,
        "student_id": g.user_id,
        "storage_path": storage_path,
    }).execute()

    upload_url = generate_upload_url("submissions", storage_path)

    return jsonify({
        **record.data[0],
        "upload_url": upload_url,
    }), 201

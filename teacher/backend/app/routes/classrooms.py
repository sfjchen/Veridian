import sys
import uuid
from typing import Tuple

from flask import Blueprint, Response, g, jsonify, request
from postgrest.exceptions import APIError
from supabase import Client

from app.middleware.auth import require_auth, require_role
from app.services.code_generator import generate_class_code
from app.services.storage import delete_object
from app.services.supabase_client import get_supabase_admin_client

classrooms_bp = Blueprint("classrooms", __name__, url_prefix="/classrooms")

POSTGRES_UNIQUE_VIOLATION = "23505"
CODE_GENERATION_MAX_ATTEMPTS = 3
MAX_CLASSROOM_NAME_LENGTH = 200
ASSIGNMENTS_BUCKET = "assignments"


def _validate_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def _classroom_for_id(client: Client, classroom_id: str) -> dict | None:
    result = client.table("classrooms").select("*").eq("id", classroom_id).limit(1).execute()
    if not result.data:
        return None
    return result.data[0]


def _is_class_member(client: Client, classroom_id: str, student_id: str) -> bool:
    membership = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).eq("student_id", student_id).limit(1).execute()
    return bool(membership.data)


@classrooms_bp.route("", methods=["POST"])
@require_role("teacher")
def create_classroom() -> Response | Tuple[Response, int]:
    data = request.get_json()
    name = (data.get("name", "") if data else "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    if len(name) > MAX_CLASSROOM_NAME_LENGTH:
        return jsonify({"error": f"name must be <= {MAX_CLASSROOM_NAME_LENGTH} characters"}), 400

    client = get_supabase_admin_client()
    for attempt in range(CODE_GENERATION_MAX_ATTEMPTS):
        code = generate_class_code()
        try:
            result = client.table("classrooms").insert({
                "teacher_id": g.user_id,
                "name": name,
                "class_code": code,
            }).execute()
            if not result.data:
                return jsonify({"error": "Insert returned no data"}), 500
            return jsonify(result.data[0]), 201
        except APIError as e:
            if e.code == POSTGRES_UNIQUE_VIOLATION and attempt < CODE_GENERATION_MAX_ATTEMPTS - 1:
                continue
            if e.code == POSTGRES_UNIQUE_VIOLATION:
                return jsonify({"error": "Failed to generate unique class code"}), 500
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {e}"}), 500

    return jsonify({"error": "Failed to create classroom"}), 500


@classrooms_bp.route("", methods=["GET"])
@require_auth
def list_classrooms() -> Response | Tuple[Response, int]:
    client = get_supabase_admin_client()
    if g.user_role == "teacher":
        result = client.table("classrooms").select("*").eq(
            "teacher_id", g.user_id
        ).execute()
    else:
        memberships = client.table("classroom_memberships").select(
            "classroom_id"
        ).eq("student_id", g.user_id).execute()
        classroom_ids = [m["classroom_id"] for m in memberships.data]
        if not classroom_ids:
            return jsonify([]), 200
        classrooms = client.table("classrooms").select("*").in_(
            "id", classroom_ids
        ).execute()
        return jsonify(classrooms.data), 200
    return jsonify(result.data), 200


@classrooms_bp.route("/<classroom_id>", methods=["GET"])
@require_auth
def get_classroom(classroom_id: str) -> Response | Tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()
    classroom = _classroom_for_id(client, classroom_id)
    if classroom is None:
        return jsonify({"error": "Classroom not found"}), 404

    is_owner = g.user_role == "teacher" and classroom.get("teacher_id") == g.user_id
    if not is_owner and not _is_class_member(client, classroom_id, g.user_id):
        return jsonify({"error": "Access denied"}), 403

    memberships = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).execute()
    assignments = client.table("assignments").select("id").eq(
        "classroom_id", classroom_id
    ).execute()

    return jsonify({
        **classroom,
        "student_count": len(memberships.data),
        "assignment_count": len(assignments.data),
    }), 200


@classrooms_bp.route("/<classroom_id>", methods=["PATCH"])
@require_role("teacher")
def update_classroom(classroom_id: str) -> Response | Tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    name = data.get("name")
    if not isinstance(name, str):
        return jsonify({"error": "name must be a string"}), 400
    name = name.strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    if len(name) > MAX_CLASSROOM_NAME_LENGTH:
        return jsonify({"error": f"name must be <= {MAX_CLASSROOM_NAME_LENGTH} characters"}), 400

    client = get_supabase_admin_client()
    try:
        updated = client.table("classrooms").update({"name": name}).eq(
            "id", classroom_id
        ).eq("teacher_id", g.user_id).execute()
    except APIError as e:
        print(f"Failed to update classroom {classroom_id}: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to update classroom"}), 500

    if not updated.data:
        return jsonify({"error": "Classroom not found"}), 404
    return jsonify(updated.data[0]), 200


@classrooms_bp.route("/<classroom_id>", methods=["DELETE"])
@require_role("teacher")
def delete_classroom(classroom_id: str) -> Response | Tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()

    assignments = client.table("assignments").select(
        "prompt_storage_path, answer_key_storage_path"
    ).eq("classroom_id", classroom_id).execute()

    try:
        deleted = client.table("classrooms").delete().eq(
            "id", classroom_id
        ).eq("teacher_id", g.user_id).execute()
    except APIError as e:
        print(f"Failed to delete classroom {classroom_id}: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to delete classroom"}), 500

    if not deleted.data:
        return jsonify({"error": "Classroom not found"}), 404

    _cleanup_assignment_storage(assignments.data)
    return Response(status=204)


def _cleanup_assignment_storage(assignments: list[dict]) -> None:
    for assignment in assignments:
        for path in [assignment.get("prompt_storage_path"), assignment.get("answer_key_storage_path")]:
            if not path:
                continue
            try:
                delete_object(ASSIGNMENTS_BUCKET, path)
            except ValueError:
                print(f"Failed to clean up storage object: {path}", file=sys.stderr)


@classrooms_bp.route("/<classroom_id>/students", methods=["GET"])
@require_role("teacher")
def list_classroom_students(classroom_id: str) -> Response | Tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()
    classroom = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", g.user_id).execute()
    if not classroom.data:
        return jsonify({"error": "Classroom not found"}), 404

    memberships = client.table("classroom_memberships").select(
        "student_id, joined_at"
    ).eq("classroom_id", classroom_id).order("joined_at", desc=False).execute()
    if not memberships.data:
        return jsonify([]), 200

    student_ids = [m["student_id"] for m in memberships.data if m.get("student_id")]
    if not student_ids:
        return jsonify([]), 200
    profiles = client.table("profiles").select("id, display_name").in_(
        "id", student_ids
    ).execute()
    profile_by_id = {
        profile["id"]: profile.get("display_name")
        for profile in profiles.data
        if profile.get("id")
    }

    result = []
    for membership in memberships.data:
        result.append({
            "student_id": membership["student_id"],
            "display_name": profile_by_id.get(membership["student_id"]),
            "joined_at": membership["joined_at"],
        })
    return jsonify(result), 200


@classrooms_bp.route("/<classroom_id>/students/<student_id>", methods=["DELETE"])
@require_role("teacher")
def remove_classroom_student(classroom_id: str, student_id: str) -> Response | Tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400
    if not _validate_uuid(student_id):
        return jsonify({"error": "Invalid student ID"}), 400

    client = get_supabase_admin_client()
    classroom = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", g.user_id).limit(1).execute()
    if not classroom.data:
        return jsonify({"error": "Classroom not found"}), 404

    try:
        deleted = client.table("classroom_memberships").delete().eq(
            "classroom_id", classroom_id
        ).eq("student_id", student_id).execute()
    except APIError as e:
        print(
            f"Failed to remove student {student_id} from classroom {classroom_id}: {e}",
            file=sys.stderr,
        )
        return jsonify({"error": "Failed to remove student"}), 500

    if not deleted.data:
        return jsonify({"error": "Student not found in classroom"}), 404
    return Response(status=204)


@classrooms_bp.route("/join", methods=["POST"])
@require_role("student")
def join_classroom() -> Response | Tuple[Response, int]:
    data = request.get_json()
    class_code = (data.get("class_code", "") if data else "").strip().upper()
    if not class_code:
        return jsonify({"error": "class_code required"}), 400

    client = get_supabase_admin_client()
    classroom = client.table("classrooms").select("id").eq(
        "class_code", class_code
    ).execute()
    if not classroom.data:
        return jsonify({"error": "Invalid class code"}), 404

    record = classroom.data[0]
    if "id" not in record:
        return jsonify({"error": "Invalid classroom data structure"}), 500
    classroom_id = record["id"]

    try:
        client.table("classroom_memberships").insert({
            "student_id": g.user_id,
            "classroom_id": classroom_id,
        }).execute()
    except APIError as e:
        if e.code == POSTGRES_UNIQUE_VIOLATION:
            return jsonify({"error": "Already joined this classroom"}), 409
        return jsonify({"error": str(e)}), 400

    return jsonify({"classroom_id": classroom_id}), 201

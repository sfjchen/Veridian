import logging
import uuid
from typing import Any, Tuple

from flask import Blueprint, Response, g, jsonify, request
from postgrest.exceptions import APIError
from supabase import Client

from app.middleware.auth import require_auth, require_role
from app.services.code_generator import generate_class_code
from app.services.config_schema import validate_config
from app.services.storage import delete_object
from app.services.supabase_client import get_supabase_admin_client

log = logging.getLogger(__name__)

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

    config = data.get("config") if data else None
    if config is not None:
        try:
            config = validate_config(config)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    client = get_supabase_admin_client()
    for attempt in range(CODE_GENERATION_MAX_ATTEMPTS):
        code = generate_class_code()
        try:
            insert_data: dict[str, Any] = {
                "teacher_id": g.user_id,
                "name": name,
                "class_code": code,
            }
            if config:
                insert_data["config"] = config
            result = client.table("classrooms").insert(insert_data).execute()
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

    updates: dict[str, Any] = {}
    name = data.get("name")
    if name is not None:
        if not isinstance(name, str):
            return jsonify({"error": "name must be a string"}), 400
        name = name.strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        if len(name) > MAX_CLASSROOM_NAME_LENGTH:
            return jsonify({"error": f"name must be <= {MAX_CLASSROOM_NAME_LENGTH} characters"}), 400
        updates["name"] = name

    if "config" in data:
        try:
            updates["config"] = validate_config(data["config"])
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    client = get_supabase_admin_client()
    try:
        updated = client.table("classrooms").update(updates).eq(
            "id", classroom_id
        ).eq("teacher_id", g.user_id).execute()
    except APIError:
        log.exception("Failed to update classroom %s", classroom_id)
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
    except APIError:
        log.exception("Failed to delete classroom %s", classroom_id)
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
                log.exception("Failed to clean up storage object: %s", path)


def _enrich_memberships_with_profiles(client: Client, memberships: list[dict]) -> list[dict]:
    student_ids = [m["student_id"] for m in memberships if m.get("student_id")]
    if not student_ids:
        return []
    profiles = client.table("profiles").select("id, display_name").in_(
        "id", student_ids
    ).execute()
    profile_by_id = {
        p["id"]: p.get("display_name") for p in profiles.data if p.get("id")
    }
    return [
        {
            "student_id": m["student_id"],
            "display_name": profile_by_id.get(m["student_id"]),
            "joined_at": m["joined_at"],
        }
        for m in memberships
    ]


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

    return jsonify(_enrich_memberships_with_profiles(client, memberships.data)), 200


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
    except APIError:
        log.exception("Failed to remove student %s from classroom %s", student_id, classroom_id)
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

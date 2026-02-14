from typing import Tuple

from flask import Blueprint, Response, request, jsonify, g
from postgrest.exceptions import APIError

from app.middleware.auth import require_auth, require_role
from app.services.supabase_client import get_supabase_admin_client
from app.services.code_generator import generate_class_code

classrooms_bp = Blueprint("classrooms", __name__, url_prefix="/classrooms")

POSTGRES_UNIQUE_VIOLATION = "23505"
CODE_GENERATION_MAX_ATTEMPTS = 3


@classrooms_bp.route("", methods=["POST"])
@require_role("teacher")
def create_classroom() -> Response | Tuple[Response, int]:
    data = request.get_json()
    name = (data.get("name", "") if data else "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400

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


@classrooms_bp.route("/<classroom_id>/students", methods=["GET"])
@require_role("teacher")
def list_classroom_students(classroom_id: str) -> Response | Tuple[Response, int]:
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

    student_ids = [membership["student_id"] for membership in memberships.data]
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

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
            "classrooms(*)"
        ).eq("student_id", g.user_id).execute()
        return jsonify([m["classrooms"] for m in memberships.data if m.get("classrooms")]), 200
    return jsonify(result.data), 200


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

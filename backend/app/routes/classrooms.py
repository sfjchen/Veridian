from flask import Blueprint, request, jsonify, g
from app.middleware.auth import require_auth, require_role
from app.services.supabase_client import get_supabase_client
from app.services.code_generator import generate_class_code

classrooms_bp = Blueprint("classrooms", __name__, url_prefix="/classrooms")


@classrooms_bp.route("", methods=["POST"])
@require_role("teacher")
def create_classroom():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "name required"}), 400

    client = get_supabase_client()
    max_attempts = 3
    for attempt in range(max_attempts):
        code = generate_class_code()
        try:
            result = client.table("classrooms").insert({
                "teacher_id": g.user_id,
                "name": data["name"],
                "class_code": code,
            }).execute()
            return jsonify(result.data[0]), 201
        except Exception as e:
            if "unique" in str(e).lower() and attempt < max_attempts - 1:
                continue
            return jsonify({"error": str(e)}), 400

    return jsonify({"error": "Failed to generate unique class code"}), 500


@classrooms_bp.route("", methods=["GET"])
@require_auth
def list_classrooms():
    client = get_supabase_client()
    if g.user_role == "teacher":
        result = client.table("classrooms").select("*").eq(
            "teacher_id", g.user_id
        ).execute()
    else:
        result = client.table("classroom_memberships").select(
            "classroom_id, joined_at, classrooms(*)"
        ).eq("student_id", g.user_id).execute()
    return jsonify(result.data), 200


@classrooms_bp.route("/join", methods=["POST"])
@require_role("student")
def join_classroom():
    data = request.get_json()
    if not data or not data.get("class_code"):
        return jsonify({"error": "class_code required"}), 400

    client = get_supabase_client()
    classroom = client.table("classrooms").select("id").eq(
        "class_code", data["class_code"]
    ).execute()

    if not classroom.data:
        return jsonify({"error": "Invalid class code"}), 404

    classroom_id = classroom.data[0]["id"]
    try:
        result = client.table("classroom_memberships").insert({
            "student_id": g.user_id,
            "classroom_id": classroom_id,
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return jsonify({"error": "Already joined this classroom"}), 409
        return jsonify({"error": str(e)}), 400

    return jsonify({"classroom_id": classroom_id}), 201

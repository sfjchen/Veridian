from flask import Blueprint, request, jsonify
from app.services.supabase_client import get_supabase_client

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    email = data.get("email")
    password = data.get("password")
    role = data.get("role")
    display_name = data.get("display_name")

    if not all([email, password, role, display_name]):
        return jsonify({"error": "email, password, role, and display_name required"}), 400

    if role not in ("teacher", "student"):
        return jsonify({"error": "role must be 'teacher' or 'student'"}), 400

    client = get_supabase_client()
    try:
        result = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"role": role, "display_name": display_name},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({
        "user_id": result.user.id,
        "email": result.user.email,
        "role": role,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    email = data.get("email")
    password = data.get("password")

    if not all([email, password]):
        return jsonify({"error": "email and password required"}), 400

    client = get_supabase_client()
    try:
        result = client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "role": result.user.user_metadata.get("role", "student"),
            "display_name": result.user.user_metadata.get("display_name", ""),
        },
    }), 200

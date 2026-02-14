import sys
from typing import Tuple

from flask import Blueprint, Response, request, jsonify

from app.constants import EMAIL_REGEX, MIN_PASSWORD_LENGTH, ROLE_STUDENT, VALID_ROLES
from app.services.supabase_client import get_supabase_client

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def _parse_json_body() -> Tuple[dict | None, Tuple[Response, int] | None]:
    if request.content_type is None or "application/json" not in request.content_type:
        return None, (jsonify({"error": "Content-Type must be application/json"}), 400)
    data = request.get_json()
    if not data:
        return None, (jsonify({"error": "Request body required"}), 400)
    return data, None


def _validate_email(email: str) -> Tuple[Response, int] | None:
    if not email or not email.strip():
        return jsonify({"error": "Missing required field: email"}), 400
    if not EMAIL_REGEX.match(email):
        return jsonify({"error": "Invalid email format"}), 400
    return None


def _validate_password(password: str) -> Tuple[Response, int] | None:
    if not password or not password.strip():
        return jsonify({"error": "Missing required field: password"}), 400
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400
    return None


@auth_bp.route("/signup", methods=["POST"])
def signup() -> Tuple[Response, int]:
    data, err = _parse_json_body()
    if err:
        return err

    email = data.get("email", "")
    password = data.get("password", "")
    role = data.get("role", "")
    display_name = data.get("display_name", "")

    if err := _validate_email(email):
        return err
    if err := _validate_password(password):
        return err
    if not display_name or not display_name.strip():
        return jsonify({"error": "Missing required field: display_name"}), 400
    if role not in VALID_ROLES:
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
        print(f"Signup error: {e}", file=sys.stderr)
        return jsonify({"error": "Signup failed"}), 400

    return jsonify({
        "user_id": result.user.id,
        "email": result.user.email,
        "role": role,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login() -> Tuple[Response, int]:
    data, err = _parse_json_body()
    if err:
        return err

    email = data.get("email", "")
    password = data.get("password", "")

    if err := _validate_email(email):
        return err
    if not password or not password.strip():
        return jsonify({"error": "Missing required field: password"}), 400

    client = get_supabase_client()
    try:
        result = client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception as e:
        print(f"Login error: {e}", file=sys.stderr)
        return jsonify({"error": "Login failed"}), 400

    return jsonify({
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "role": result.user.user_metadata.get("role", ROLE_STUDENT),
            "display_name": result.user.user_metadata.get("display_name", ""),
        },
    }), 200

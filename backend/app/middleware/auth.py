import functools
from typing import Callable
import jwt
from flask import request, g, jsonify, current_app


def require_auth(f: Callable) -> Callable:
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                current_app.config["SUPABASE_JWT_SECRET"],
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.user_id = payload["sub"]
        user_metadata = payload.get("user_metadata", {})
        g.user_role = user_metadata.get("role", "student")
        return f(*args, **kwargs)

    return decorated


def require_role(role: str) -> Callable:
    def decorator(f: Callable) -> Callable:
        @functools.wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            if g.user_role != role:
                return jsonify({"error": f"Requires {role} role"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

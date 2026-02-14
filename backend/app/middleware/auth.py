import functools
from typing import Any, Callable, Tuple

import jwt
from flask import Response, request, g, jsonify, current_app

from app.constants import ROLE_STUDENT


def require_auth(f: Callable) -> Callable:
    """Verify JWT and populate g.user_id, g.user_role, g.user_token."""
    @functools.wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Tuple[Response, int] | Response:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                current_app.config["SUPABASE_JWT_SECRET"],
                algorithms=[current_app.config.get("JWT_ALGORITHM", "HS256")],
                audience="authenticated",
                issuer=current_app.config.get("SUPABASE_URL"),
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.user_id = payload["sub"]
        g.user_token = token
        user_metadata = payload.get("user_metadata", {})
        g.user_role = user_metadata.get("role", ROLE_STUDENT)
        return f(*args, **kwargs)

    return decorated


def require_role(role: str) -> Callable:
    """Require the authenticated user to have a specific role."""
    def decorator(f: Callable) -> Callable:
        @functools.wraps(f)
        @require_auth
        def decorated(*args: Any, **kwargs: Any) -> Tuple[Response, int] | Response:
            if g.user_role != role:
                return jsonify({"error": f"Requires {role} role"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

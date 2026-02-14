import functools
from typing import Any, Callable, Tuple

import jwt
from jwt import PyJWKClient
from flask import Response, request, g, jsonify, current_app

from app.constants import ROLE_STUDENT

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        base_url = current_app.config["SUPABASE_URL"].rstrip("/")
        jwks_url = base_url + "/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def require_auth(f: Callable) -> Callable:
    """Verify JWT and populate g.user_id, g.user_role, g.user_token."""
    @functools.wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Tuple[Response, int] | Response:
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0] != "Bearer" or not parts[1]:
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = parts[1]
        try:
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception:
            return jsonify({"error": "Authentication service unavailable"}), 503

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

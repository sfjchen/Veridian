import functools
import logging
from typing import Any, Callable, Tuple

import jwt
from jwt import PyJWKClient
from flask import Response, request, g, jsonify, current_app

from app.constants import ROLE_STUDENT, ROLE_TEACHER
from app.services.supabase_client import get_supabase_admin_client

log = logging.getLogger(__name__)

_jwks_client: PyJWKClient | None = None
VALID_ROLES = {ROLE_STUDENT, ROLE_TEACHER}


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        base_url = current_app.config["SUPABASE_URL"].rstrip("/")
        jwks_url = base_url + "/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def _decode_token(token: str) -> dict[str, Any]:
    """Decode a Supabase JWT.

    Tries HS256 with the configured JWT secret first (standard for most
    Supabase projects), then falls back to JWKS (RS256/ES256) for newer
    projects that use asymmetric signing.
    """
    jwt_secret = current_app.config.get("SUPABASE_JWT_SECRET")

    if jwt_secret:
        try:
            return jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            raise
        except jwt.InvalidTokenError:
            pass  # Fall through to JWKS

    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256", "ES256"],
        audience="authenticated",
    )


def _role_from_payload(payload: dict[str, Any]) -> str | None:
    user_metadata = payload.get("user_metadata", {})
    app_metadata = payload.get("app_metadata", {})
    metadata_role = user_metadata.get("role")
    if metadata_role in VALID_ROLES:
        return metadata_role
    app_role = app_metadata.get("role")
    if app_role in VALID_ROLES:
        return app_role
    return None


def _role_from_profile(user_id: str) -> str | None:
    try:
        client = get_supabase_admin_client()
        profile = client.table("profiles").select("role").eq("id", user_id).execute()
    except Exception:
        log.exception("_role_from_profile query failed for %s", user_id)
        return None

    if not profile.data:
        log.warning("_role_from_profile: no profile row for %s", user_id)
        return None

    record = profile.data[0] if isinstance(profile.data, list) else profile.data
    if not isinstance(record, dict):
        return None

    role = record.get("role")
    if role in VALID_ROLES:
        return role
    return None


def extract_bearer_token(auth_header: str) -> str | None:
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0] != "Bearer" or not parts[1]:
        return None
    return parts[1]


def resolve_user_from_token(token: str) -> tuple[str, str]:
    payload = _decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise jwt.InvalidTokenError("Token missing subject")

    role = _role_from_payload(payload)
    if not role:
        role = _role_from_profile(user_id)
    if not role:
        log.warning("Could not resolve role for %s, defaulting to %s", user_id, ROLE_STUDENT)
    return user_id, role or ROLE_STUDENT


def require_auth(f: Callable) -> Callable:
    """Verify JWT and populate g.user_id, g.user_role, g.user_token."""
    @functools.wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Tuple[Response, int] | Response:
        token = extract_bearer_token(request.headers.get("Authorization", ""))
        if not token:
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        try:
            user_id, role = resolve_user_from_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            log.exception("JWT invalid after all decode attempts")
            return jsonify({"error": "Invalid token"}), 401
        except Exception:
            log.exception("JWT decode error")
            return jsonify({"error": "Authentication service unavailable"}), 503

        g.user_id = user_id
        g.user_token = token
        g.user_role = role
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

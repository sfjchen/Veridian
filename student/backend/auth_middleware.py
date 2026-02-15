import os
import ssl
from functools import wraps
from typing import Any, Callable, Optional

import certifi
import jwt
from jwt import PyJWKClient
from flask import g, jsonify, request

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        jwks_url = base_url + "/auth/v1/.well-known/jwks.json"
        ctx = ssl.create_default_context(cafile=certifi.where())
        _jwks_client = PyJWKClient(jwks_url, ssl_context=ctx)
    return _jwks_client


def _decode_token(token: str) -> dict[str, Any]:
    """Decode a Supabase JWT.

    Tries HS256 with the configured JWT secret first (standard for most
    Supabase projects), then falls back to JWKS (RS256/ES256) for newer
    projects that use asymmetric signing.
    """
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET")

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


def _try_bearer_auth() -> tuple[str, str] | None:
    """Extract and verify bearer token. Returns (user_id, user_role) or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = _decode_token(token)
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")
    except Exception as exc:
        raise ValueError(f"Invalid auth token: {exc}") from exc
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid auth token.")
    user_metadata = payload.get("user_metadata", {}) or {}
    app_metadata = payload.get("app_metadata", {}) or {}
    user_role = user_metadata.get("role") or app_metadata.get("role") or "student"
    return (str(user_id), str(user_role))


def _set_auth_globals(user_id: str, user_role: str) -> None:
    g.user_id = user_id
    g.user_role = user_role


def require_auth(route_handler: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(route_handler)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            result = _try_bearer_auth()
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 401
        if result is None:
            return jsonify({"error": "Missing bearer token."}), 401
        _set_auth_globals(*result)
        return route_handler(*args, **kwargs)

    return wrapper


def require_auth_or_sample(default_user_id: str = "anonymous-sample") -> Callable[..., Any]:
    """Like require_auth, but allows unauthenticated sample requests (is_sample=true, no assignment_id)."""

    def decorator(route_handler: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(route_handler)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                result = _try_bearer_auth()
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 401
            if result is not None:
                _set_auth_globals(*result)
                return route_handler(*args, **kwargs)
            is_sample = request.form.get("is_sample", "false").lower() in ("true", "1", "yes")
            assignment_id = (request.form.get("assignment_id") or "").strip() or None
            if is_sample and not assignment_id:
                _set_auth_globals(default_user_id, "student")
                return route_handler(*args, **kwargs)
            return jsonify({"error": "Missing bearer token."}), 401

        return wrapper

    return decorator


def _chat_assignment_id_from_request(req: Any, kwargs: Any) -> Optional[str]:
    if req.method == "GET":
        return kwargs.get("assignment_id")
    payload = req.get_json(silent=True) or {}
    return (payload.get("assignment_id") or "").strip() or None


def require_auth_or_sample_chat(default_user_id: str = "anonymous-sample") -> Callable[..., Any]:
    """Like require_auth, but allows unauthenticated access when assignment_id is 'sample-algebra'."""

    def decorator(route_handler: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(route_handler)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                result = _try_bearer_auth()
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 401
            if result is not None:
                _set_auth_globals(*result)
                return route_handler(*args, **kwargs)
            assignment_id = _chat_assignment_id_from_request(request, kwargs)
            if assignment_id == "sample-algebra":
                _set_auth_globals(default_user_id, "student")
                return route_handler(*args, **kwargs)
            return jsonify({"error": "Missing bearer token."}), 401

        return wrapper

    return decorator

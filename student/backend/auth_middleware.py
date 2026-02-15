from functools import wraps
from typing import Any, Callable, Optional

from flask import g, jsonify, request

from supabase_service import get_supabase_auth_client


def _get_field(value: Any, field: str, default: Any = None) -> Any:
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(field, default)
    return getattr(value, field, default)


def _extract_user_from_auth_response(response: Any) -> Any:
    user = _get_field(response, "user")
    if user is not None:
        return user
    data = _get_field(response, "data")
    if data is not None:
        return _get_field(data, "user")
    return None


def _try_bearer_auth() -> tuple[str, str] | None:
    """Extract and verify bearer token. Returns (user_id, user_role) or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        auth_response = get_supabase_auth_client().auth.get_user(token)
        user = _extract_user_from_auth_response(auth_response)
    except Exception as exc:
        raise ValueError(f"Invalid auth token: {exc}") from exc
    user_id = _get_field(user, "id")
    if not user_id:
        raise ValueError("Invalid auth token.")
    user_metadata = _get_field(user, "user_metadata", {}) or {}
    app_metadata = _get_field(user, "app_metadata", {}) or {}
    user_role = user_metadata.get("role") or app_metadata.get("role") or "unknown"
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

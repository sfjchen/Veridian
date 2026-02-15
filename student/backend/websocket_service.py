import logging
import os
from typing import Any, Dict

from flask import Flask, request
from flask_socketio import SocketIO, join_room

from supabase_service import get_supabase_auth_client

log = logging.getLogger(__name__)

# Module-level singleton; initialised once via init_socketio()
socketio: SocketIO | None = None


def _cors_origins() -> list[str] | str:
    raw = os.getenv("WS_CORS_ORIGINS", "")
    if not raw.strip():
        return "*"
    return [o.strip() for o in raw.split(",") if o.strip()]


def init_socketio(app: Flask) -> SocketIO:
    global socketio
    socketio = SocketIO(
        app,
        cors_allowed_origins=_cors_origins(),
        async_mode="threading",
    )
    _register_events(socketio)
    return socketio


def _verify_token(token: str) -> str | None:
    try:
        resp = get_supabase_auth_client().auth.get_user(token)
        user = getattr(resp, "user", None) or (resp or {}).get("user")
        if user is None:
            data = getattr(resp, "data", None)
            if data is not None:
                user = getattr(data, "user", None)
        return str(getattr(user, "id", None) or user.get("id", "")) or None
    except Exception as exc:
        log.warning("WebSocket token verification failed: %s", exc)
        return None


def _register_events(sio: SocketIO) -> None:
    @sio.on("connect")
    def _on_connect(auth: Dict[str, Any] | None = None) -> bool:
        token = (auth or {}).get("token", "")
        if not token:
            return False
        user_id = _verify_token(token)
        if not user_id:
            return False
        join_room(user_id)
        log.info("WebSocket connected: user=%s", user_id)
        return True

    @sio.on("disconnect")
    def _on_disconnect() -> None:
        log.info("WebSocket disconnected: sid=%s", request.sid)


def emit_result_ready(student_id: str, problem_num: int, result: Dict[str, Any]) -> None:
    """Push a result_ready event to the student's room."""
    if socketio is None:
        return
    payload = {
        "assignment_id": result.get("assignment_id"),
        "problem_num": problem_num,
        "status": "complete",
        "mistake_count": result.get("mistake_count"),
        "mistakes": result.get("mistakes", []),
    }
    socketio.emit("result_ready", payload, room=student_id)

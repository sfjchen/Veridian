"""
WebSocket endpoints for real-time conversion progress updates.
"""

from dataclasses import dataclass
import logging
from threading import Lock
from typing import Any
import uuid

import jwt
from flask import request
from flask_socketio import join_room, leave_room

from app.constants import ROLE_TEACHER
from app.middleware.auth import extract_bearer_token, resolve_user_from_token
from app.services.supabase_client import get_supabase_admin_client
from .. import socketio

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class SocketIdentity:
    user_id: str
    role: str


_CONNECTED_CLIENTS: dict[str, SocketIdentity] = {}
_ACTIVE_JOBS: dict[str, str] = {}
_ACTIVE_JOBS_LOCK = Lock()


def register_conversion_job(job_id: str, teacher_id: str) -> None:
    with _ACTIVE_JOBS_LOCK:
        _ACTIVE_JOBS[job_id] = teacher_id


def complete_conversion_job(job_id: str) -> None:
    with _ACTIVE_JOBS_LOCK:
        _ACTIVE_JOBS.pop(job_id, None)


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def _extract_token(auth_payload: Any) -> str | None:
    if isinstance(auth_payload, dict):
        raw_token = auth_payload.get("token")
        if isinstance(raw_token, str) and raw_token.strip():
            token = raw_token.strip()
            bearer_token = extract_bearer_token(token)
            return bearer_token or token

    token = extract_bearer_token(request.headers.get("Authorization", ""))
    if token:
        return token

    query_token = request.args.get("token", "").strip()
    if query_token:
        return query_token

    return None


def _job_owner(job_id: str) -> str | None:
    with _ACTIVE_JOBS_LOCK:
        teacher_id = _ACTIVE_JOBS.get(job_id)
    if teacher_id:
        return teacher_id

    client = get_supabase_admin_client()

    assignment = client.table("assignments").select("classroom_id").eq("id", job_id).limit(1).execute()
    if assignment.data:
        classroom_id = assignment.data[0]["classroom_id"]
        classroom = client.table("classrooms").select("teacher_id").eq("id", classroom_id).limit(1).execute()
        if classroom.data:
            return classroom.data[0]["teacher_id"]

    corpus_file = client.table("corpus_files").select("classroom_id").eq("id", job_id).limit(1).execute()
    if corpus_file.data:
        classroom_id = corpus_file.data[0]["classroom_id"]
        classroom = client.table("classrooms").select("teacher_id").eq("id", classroom_id).limit(1).execute()
        if classroom.data:
            return classroom.data[0]["teacher_id"]

    return None


@socketio.on("connect", namespace="/conversion")
def handle_connect(auth: Any = None) -> bool:
    """Handle WebSocket connection with JWT authentication."""
    token = _extract_token(auth)
    if not token:
        log.warning("Rejected conversion websocket connection: missing token")
        return False

    try:
        user_id, role = resolve_user_from_token(token)
    except jwt.ExpiredSignatureError:
        log.warning("Rejected conversion websocket connection: expired token")
        return False
    except jwt.InvalidTokenError:
        log.warning("Rejected conversion websocket connection: invalid token")
        return False
    except Exception:
        log.exception("Rejected conversion websocket connection: auth backend unavailable")
        return False

    if role != ROLE_TEACHER:
        log.warning("Rejected conversion websocket connection for non-teacher user %s", user_id)
        return False

    _CONNECTED_CLIENTS[request.sid] = SocketIdentity(user_id=user_id, role=role)
    log.debug("Teacher %s connected to /conversion namespace", user_id)
    return True


@socketio.on("disconnect", namespace="/conversion")
def handle_disconnect() -> None:
    """Handle WebSocket disconnection."""
    identity = _CONNECTED_CLIENTS.pop(request.sid, None)
    if identity:
        log.debug("Teacher %s disconnected from /conversion namespace", identity.user_id)


@socketio.on("subscribe", namespace="/conversion")
def handle_subscribe(data: dict[str, Any] | None) -> None:
    """
    Subscribe client to a conversion job's progress updates.

    Expects:
        data: {"job_id": "uuid"}
    """
    identity = _CONNECTED_CLIENTS.get(request.sid)
    if not identity:
        log.warning("Rejected subscribe request for disconnected sid %s", request.sid)
        return

    job_id = str((data or {}).get("job_id", "")).strip()
    if not job_id or not _is_valid_uuid(job_id):
        log.warning("Rejected subscribe request from %s: invalid job_id %r", identity.user_id, job_id)
        return

    owner_id = _job_owner(job_id)
    if owner_id != identity.user_id:
        log.warning("Rejected subscribe request from %s for unauthorized job %s", identity.user_id, job_id)
        return

    room = f"conversion_{job_id}"
    join_room(room)
    log.debug("Teacher %s subscribed to conversion job %s", identity.user_id, job_id)


@socketio.on("unsubscribe", namespace="/conversion")
def handle_unsubscribe(data: dict[str, Any] | None) -> None:
    """
    Unsubscribe client from a conversion job's progress updates.

    Expects:
        data: {"job_id": "uuid"}
    """
    identity = _CONNECTED_CLIENTS.get(request.sid)
    if not identity:
        return

    job_id = str((data or {}).get("job_id", "")).strip()
    if not job_id or not _is_valid_uuid(job_id):
        return

    room = f"conversion_{job_id}"
    leave_room(room)
    log.debug("Teacher %s unsubscribed from conversion job %s", identity.user_id, job_id)

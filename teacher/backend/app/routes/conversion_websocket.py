"""
WebSocket endpoints for real-time conversion progress updates.
"""

import logging
from flask_socketio import join_room, leave_room
from .. import socketio

log = logging.getLogger(__name__)


@socketio.on("connect", namespace="/conversion")
def handle_connect():
    """Handle WebSocket connection."""
    log.info("Client connected to /conversion namespace")


@socketio.on("disconnect", namespace="/conversion")
def handle_disconnect():
    """Handle WebSocket disconnection."""
    log.info("Client disconnected from /conversion namespace")


@socketio.on("subscribe", namespace="/conversion")
def handle_subscribe(data: dict):
    """
    Subscribe client to a conversion job's progress updates.

    Expects:
        data: {"job_id": "uuid"}
    """
    job_id = data.get("job_id")
    if not job_id:
        log.warning("Subscribe request missing job_id")
        return

    room = f"conversion_{job_id}"
    join_room(room)
    log.info(f"Client subscribed to job {job_id}")


@socketio.on("unsubscribe", namespace="/conversion")
def handle_unsubscribe(data: dict):
    """
    Unsubscribe client from a conversion job's progress updates.

    Expects:
        data: {"job_id": "uuid"}
    """
    job_id = data.get("job_id")
    if not job_id:
        log.warning("Unsubscribe request missing job_id")
        return

    room = f"conversion_{job_id}"
    leave_room(room)
    log.info(f"Client unsubscribed from job {job_id}")

"""Analytics endpoints for teacher insights dashboard.

FAQ aggregation from chat messages and mistake heatmap from problem results.
"""

import logging
from typing import Any, Tuple

from flask import Blueprint, Response, g, jsonify

from app.middleware.auth import require_role
from app.services.analytics import (
    aggregate_faq,
    build_classroom_overview,
    build_classroom_trends,
    build_mistake_heatmap,
    build_student_profile,
    fetch_classroom_chat_messages,
    fetch_classroom_results,
    get_student_count,
)
from app.services.live_monitoring import validate_uuid
from app.services.supabase_client import get_supabase_admin_client

log = logging.getLogger(__name__)
analytics_bp = Blueprint("analytics", __name__)


def _err(msg: str, code: int) -> Tuple[Response, int]:
    return jsonify({"error": msg}), code


def _require_classroom_owner(client: Any, classroom_id: str) -> dict[str, Any] | Tuple[Response, int]:
    """Validate classroom exists and teacher owns it. Returns classroom row or error tuple."""
    if not validate_uuid(classroom_id):
        return _err("Invalid classroom ID", 400)
    resp = client.table("classrooms").select("id,teacher_id,name").eq("id", classroom_id).limit(1).execute()
    rows = resp.data or []
    if not rows:
        return _err("Classroom not found", 404)
    classroom = rows[0]
    if classroom["teacher_id"] != g.user_id:
        return _err("Access denied", 403)
    return classroom


def _student_names_for_classroom(client: Any, classroom_id: str) -> dict[str, str]:
    """Get display names for all students in a classroom."""
    members = client.table("classroom_memberships").select("student_id").eq("classroom_id", classroom_id).execute()
    sids = [r["student_id"] for r in (members.data or [])]
    if not sids:
        return {}
    profiles = client.table("profiles").select("id,display_name").in_("id", sids).execute()
    return {r["id"]: r.get("display_name", "") for r in (profiles.data or [])}


@analytics_bp.route("/analytics/classrooms/<classroom_id>/overview", methods=["GET"])
@require_role("teacher")
def get_classroom_overview(classroom_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    check = _require_classroom_owner(client, classroom_id)
    if isinstance(check, tuple):
        return check
    try:
        results = fetch_classroom_results(client, classroom_id)
        student_count = get_student_count(client, classroom_id)
        overview = build_classroom_overview(results, student_count)
    except Exception as exc:
        log.exception("Failed to compute overview for %s", classroom_id)
        return _err("Failed to compute overview data", 500)
    return jsonify({"classroom_id": classroom_id, **overview}), 200


@analytics_bp.route("/analytics/classrooms/<classroom_id>/trends", methods=["GET"])
@require_role("teacher")
def get_classroom_trends(classroom_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    check = _require_classroom_owner(client, classroom_id)
    if isinstance(check, tuple):
        return check
    try:
        results = fetch_classroom_results(client, classroom_id)
        trends = build_classroom_trends(client, results)
    except Exception as exc:
        log.exception("Failed to compute trends for %s", classroom_id)
        return _err("Failed to compute trend data", 500)
    return jsonify({"classroom_id": classroom_id, "assignments": trends}), 200


@analytics_bp.route("/analytics/classrooms/<classroom_id>/faq", methods=["GET"])
@require_role("teacher")
def get_classroom_faq(classroom_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    check = _require_classroom_owner(client, classroom_id)
    if isinstance(check, tuple):
        return check
    try:
        messages = fetch_classroom_chat_messages(client, classroom_id)
        student_count = get_student_count(client, classroom_id)
        faq = aggregate_faq(messages, student_count)
    except Exception as exc:
        log.exception("Failed to compute FAQ for %s", classroom_id)
        return _err("Failed to compute FAQ data", 500)
    return jsonify({"classroom_id": classroom_id, "student_count": student_count, "topics": faq}), 200


@analytics_bp.route("/analytics/teacher/faq", methods=["GET"])
@require_role("teacher")
def get_teacher_faq() -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    try:
        classrooms = client.table("classrooms").select("id").eq("teacher_id", g.user_id).execute()
        cids = [r["id"] for r in (classrooms.data or [])]
    except Exception as exc:
        log.exception("Failed to fetch classrooms for teacher FAQ")
        return _err("Failed to fetch classrooms", 500)
    if not cids:
        return jsonify({"topics": [], "total_students": 0}), 200
    try:
        all_messages: list[dict[str, Any]] = []
        total_students = 0
        for cid in cids:
            all_messages.extend(fetch_classroom_chat_messages(client, cid))
            total_students += get_student_count(client, cid)
        faq = aggregate_faq(all_messages, total_students)
    except Exception as exc:
        log.exception("Failed to compute teacher FAQ")
        return _err("Failed to compute FAQ data", 500)
    return jsonify({"topics": faq, "total_students": total_students}), 200


@analytics_bp.route("/analytics/classrooms/<classroom_id>/mistakes", methods=["GET"])
@require_role("teacher")
def get_classroom_mistakes(classroom_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    check = _require_classroom_owner(client, classroom_id)
    if isinstance(check, tuple):
        return check
    try:
        results = fetch_classroom_results(client, classroom_id)
        names = _student_names_for_classroom(client, classroom_id)
        heatmap = build_mistake_heatmap(results, names)
    except Exception as exc:
        log.exception("Failed to compute mistake heatmap for %s", classroom_id)
        return _err("Failed to compute mistake data", 500)
    return jsonify(heatmap), 200


@analytics_bp.route("/analytics/classrooms/<classroom_id>/students/<student_id>/mistakes", methods=["GET"])
@require_role("teacher")
def get_student_mistakes(classroom_id: str, student_id: str) -> Tuple[Response, int]:
    if not validate_uuid(student_id):
        return _err("Invalid student ID", 400)
    client = get_supabase_admin_client()
    check = _require_classroom_owner(client, classroom_id)
    if isinstance(check, tuple):
        return check
    try:
        profile = build_student_profile(client, student_id, classroom_id)
    except Exception as exc:
        log.exception("Failed to compute student profile for %s/%s", classroom_id, student_id)
        return _err("Failed to compute student mistake profile", 500)
    return jsonify(profile), 200

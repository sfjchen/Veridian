import sys
from datetime import datetime
from typing import Any, Tuple

from flask import Blueprint, Response, g, jsonify, request
from postgrest.exceptions import APIError

from app.middleware.auth import require_auth, require_role
from app.models.live_models import ErrorLogPayload, ProgressUpdatePayload, ValidationError
from app.services.insight_engine import (
    InsightSettings,
    build_student_failure_summary,
    build_teacher_insights,
    categorize_error,
)
from app.services.live_monitoring import (
    enrich_with_display_names,
    fetch_assignment_context,
    fetch_latest_progress_per_student,
    generate_error_fingerprint,
    insert_error_log,
    insert_progress_event,
    latest_progress_by_student,
    list_classroom_student_ids,
    list_display_names_by_student_id,
    list_error_logs,
    list_progress_events,
    parse_iso8601_timestamp,
    parse_positive_int,
    user_can_access_assignment,
    user_can_access_student_assignment_data,
    validate_uuid,
)
from app.services.supabase_client import get_supabase_admin_client

live_monitoring_bp = Blueprint("live_monitoring", __name__)


def _json_error(message: str, status_code: int) -> Tuple[Response, int]:
    return jsonify({"error": message}), status_code


def _parse_limit_query(default_value: int, max_value: int) -> int:
    return parse_positive_int(request.args.get("limit"), default_value, max_value)


def _parse_since_query() -> datetime | None:
    return parse_iso8601_timestamp(request.args.get("since"))


@live_monitoring_bp.route("/assignments/<assignment_id>/live/errors", methods=["POST"])
@require_role("student")
def ingest_assignment_error(assignment_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _json_error("Invalid assignment ID", 400)

    try:
        payload = ErrorLogPayload.from_payload(request.get_json())
    except ValidationError as exc:
        return _json_error(str(exc), 400)

    client = get_supabase_admin_client()
    context = fetch_assignment_context(client, assignment_id)
    if context is None:
        return _json_error("Assignment not found", 404)
    if not user_can_access_assignment(client, context, g.user_id, g.user_role):
        return _json_error("Access denied", 403)

    error_category = categorize_error(
        error_message=payload.error_message,
        topic=payload.topic,
        metadata=payload.metadata,
    )
    error_fingerprint = payload.error_fingerprint or generate_error_fingerprint(
        payload.error_message,
        payload.assignment_part,
        payload.topic,
        error_category,
    )

    try:
        record = insert_error_log(
            client=client,
            context=context,
            student_id=g.user_id,
            error_message=payload.error_message,
            assignment_part=payload.assignment_part,
            topic=payload.topic,
            error_category=error_category,
            error_fingerprint=error_fingerprint,
            metadata=payload.metadata,
            occurred_at=payload.occurred_at,
        )
    except APIError as exc:
        print(f"Failed to insert assignment error log: {exc}", file=sys.stderr)
        return _json_error("Failed to persist error log", 500)
    except ValueError as exc:
        print(f"Failed to insert assignment error log: {exc}", file=sys.stderr)
        return _json_error("Failed to persist error log", 500)

    return jsonify(record), 201


@live_monitoring_bp.route("/assignments/<assignment_id>/live/errors", methods=["GET"])
@require_auth
def get_assignment_error_logs(assignment_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _json_error("Invalid assignment ID", 400)

    client = get_supabase_admin_client()
    context = fetch_assignment_context(client, assignment_id)
    if context is None:
        return _json_error("Assignment not found", 404)
    if not user_can_access_assignment(client, context, g.user_id, g.user_role):
        return _json_error("Access denied", 403)

    target_student_id = request.args.get("student_id")
    if g.user_role != "teacher":
        target_student_id = g.user_id
    elif target_student_id:
        if not validate_uuid(target_student_id):
            return _json_error("Invalid student ID", 400)
        if not user_can_access_student_assignment_data(
            client, context,
            requester_id=g.user_id,
            requester_role=g.user_role,
            student_id=target_student_id,
        ):
            return _json_error("Student not found in classroom", 404)

    try:
        limit = _parse_limit_query(default_value=100, max_value=1000)
        since = _parse_since_query()
    except ValueError as exc:
        return _json_error(str(exc), 400)

    try:
        logs = list_error_logs(
            client=client,
            assignment_id=assignment_id,
            limit=limit,
            student_id=target_student_id,
            since=since,
        )
    except APIError as exc:
        print(f"Failed to query assignment error logs: {exc}", file=sys.stderr)
        return _json_error("Failed to fetch error logs", 500)

    if g.user_role == "teacher":
        enrich_with_display_names(logs, client)

    return jsonify({
        "assignment_id": assignment_id,
        "count": len(logs),
        "logs": logs,
    }), 200


@live_monitoring_bp.route("/assignments/<assignment_id>/live/progress", methods=["POST"])
@require_role("student")
def ingest_assignment_progress(assignment_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _json_error("Invalid assignment ID", 400)

    try:
        payload = ProgressUpdatePayload.from_payload(request.get_json())
    except ValidationError as exc:
        return _json_error(str(exc), 400)

    client = get_supabase_admin_client()
    context = fetch_assignment_context(client, assignment_id)
    if context is None:
        return _json_error("Assignment not found", 404)
    if not user_can_access_assignment(client, context, g.user_id, g.user_role):
        return _json_error("Access denied", 403)

    try:
        record = insert_progress_event(
            client=client,
            context=context,
            student_id=g.user_id,
            completion_percentage=payload.completion_percentage,
            state=payload.state,
            assignment_part=payload.assignment_part,
            topic=payload.topic,
            active_error_fingerprint=payload.active_error_fingerprint,
            metadata=payload.metadata,
            last_active_at=payload.last_active_at,
        )
    except APIError as exc:
        print(f"Failed to insert assignment progress: {exc}", file=sys.stderr)
        return _json_error("Failed to persist progress event", 500)
    except ValueError as exc:
        print(f"Failed to insert assignment progress: {exc}", file=sys.stderr)
        return _json_error("Failed to persist progress event", 500)

    return jsonify(record), 201


@live_monitoring_bp.route("/assignments/<assignment_id>/live/progress", methods=["GET"])
@require_auth
def get_assignment_progress(assignment_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _json_error("Invalid assignment ID", 400)

    client = get_supabase_admin_client()
    context = fetch_assignment_context(client, assignment_id)
    if context is None:
        return _json_error("Assignment not found", 404)
    if not user_can_access_assignment(client, context, g.user_id, g.user_role):
        return _json_error("Access denied", 403)

    target_student_id = request.args.get("student_id")
    if g.user_role != "teacher":
        target_student_id = g.user_id
    elif target_student_id:
        if not validate_uuid(target_student_id):
            return _json_error("Invalid student ID", 400)
        if not user_can_access_student_assignment_data(
            client, context,
            requester_id=g.user_id,
            requester_role=g.user_role,
            student_id=target_student_id,
        ):
            return _json_error("Student not found in classroom", 404)

    include_events = request.args.get("include_events", "false").lower() == "true"
    try:
        limit = _parse_limit_query(default_value=250, max_value=5000)
        since = _parse_since_query()
    except ValueError as exc:
        return _json_error(str(exc), 400)

    try:
        latest_progress_map = fetch_latest_progress_per_student(
            client, assignment_id, since,
        )
    except APIError as exc:
        print(f"Failed to query assignment progress: {exc}", file=sys.stderr)
        return _json_error("Failed to fetch progress events", 500)

    latest_records: list[dict[str, Any]]
    if target_student_id is None:
        latest_records = list(latest_progress_map.values())
    elif target_student_id in latest_progress_map:
        latest_records = [latest_progress_map[target_student_id]]
    else:
        latest_records = []

    if g.user_role == "teacher":
        enrich_with_display_names(latest_records, client)

    response: dict[str, Any] = {
        "assignment_id": assignment_id,
        "latest_count": len(latest_records),
        "latest_progress": latest_records,
    }
    if include_events:
        try:
            progress_events = list_progress_events(
                client=client,
                assignment_id=assignment_id,
                limit=limit,
                student_id=target_student_id,
                since=since,
            )
        except APIError as exc:
            print(f"Failed to query progress events: {exc}", file=sys.stderr)
            return _json_error("Failed to fetch progress events", 500)
        response["events"] = progress_events
        response["event_count"] = len(progress_events)
    return jsonify(response), 200


@live_monitoring_bp.route("/assignments/<assignment_id>/insights", methods=["GET"])
@require_role("teacher")
def get_assignment_teacher_insights(assignment_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _json_error("Invalid assignment ID", 400)

    client = get_supabase_admin_client()
    context = fetch_assignment_context(client, assignment_id)
    if context is None:
        return _json_error("Assignment not found", 404)
    if context.teacher_id != g.user_id:
        return _json_error("Access denied", 403)

    try:
        settings = InsightSettings.from_query_args(request.args)
        since = _parse_since_query()
        error_limit = parse_positive_int(request.args.get("error_limit"), 3000, 20000)
    except ValueError as exc:
        return _json_error(str(exc), 400)

    try:
        student_ids = list_classroom_student_ids(client, context.classroom_id)
        display_names = list_display_names_by_student_id(client, student_ids)
        error_logs = list_error_logs(
            client=client,
            assignment_id=assignment_id,
            limit=error_limit,
            student_id=None,
            since=since,
        )
        latest_progress_map = fetch_latest_progress_per_student(
            client, assignment_id, since,
        )
    except APIError as exc:
        print(f"Failed to query assignment insights data: {exc}", file=sys.stderr)
        return _json_error("Failed to fetch insight data", 500)

    insights = build_teacher_insights(
        assignment_id=assignment_id,
        student_ids=student_ids,
        student_display_names=display_names,
        error_logs=error_logs,
        latest_progress_by_student_id=latest_progress_map,
        settings=settings,
    )
    return jsonify(insights), 200


@live_monitoring_bp.route(
    "/assignments/<assignment_id>/students/<student_id>/failure-summary",
    methods=["GET"],
)
@require_auth
def get_assignment_failure_summary(assignment_id: str, student_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _json_error("Invalid assignment ID", 400)
    if not validate_uuid(student_id):
        return _json_error("Invalid student ID", 400)

    client = get_supabase_admin_client()
    context = fetch_assignment_context(client, assignment_id)
    if context is None:
        return _json_error("Assignment not found", 404)
    if not user_can_access_student_assignment_data(
        client=client,
        context=context,
        requester_id=g.user_id,
        requester_role=g.user_role,
        student_id=student_id,
    ):
        return _json_error("Access denied", 403)

    try:
        settings = InsightSettings.from_query_args(request.args)
        error_logs = list_error_logs(
            client=client,
            assignment_id=assignment_id,
            limit=parse_positive_int(request.args.get("error_limit"), 500, 5000),
            student_id=student_id,
            since=None,
        )
        progress_events = list_progress_events(
            client=client,
            assignment_id=assignment_id,
            limit=parse_positive_int(request.args.get("progress_limit"), 200, 5000),
            student_id=student_id,
            since=None,
        )
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except APIError as exc:
        print(f"Failed to query failure summary data: {exc}", file=sys.stderr)
        return _json_error("Failed to fetch failure summary data", 500)

    display_names = list_display_names_by_student_id(client, [student_id])
    latest_progress = latest_progress_by_student(progress_events).get(student_id)
    summary = build_student_failure_summary(
        assignment_id=assignment_id,
        student_id=student_id,
        display_name=display_names.get(student_id, ""),
        error_logs=error_logs,
        latest_progress=latest_progress,
        settings=settings,
    )
    return jsonify(summary), 200

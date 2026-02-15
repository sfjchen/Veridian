import logging
from datetime import datetime
from typing import Any, Tuple

from flask import Blueprint, Response, g, jsonify, request
from postgrest.exceptions import APIError

from app.middleware.auth import require_auth, require_role
from app.models.live_models import ErrorLogPayload, ProgressUpdatePayload, ValidationError
from app.services.insight_engine import (
    FailureSummaryInput,
    InsightData,
    InsightSettings,
    build_student_failure_summary,
    build_teacher_insights,
    categorize_error,
)
from app.services.live_monitoring import (
    AssignmentContext,
    ErrorLogRecord,
    ListQuery,
    ProgressRecord,
    enrich_with_display_names,
    fetch_assignment_context,
    fetch_latest_progress_per_student,
    generate_error_fingerprint,
    insert_error_log,
    insert_progress_event,
    latest_progress_by_student,
    list_classroom_student_ids,
    list_display_names,
    list_error_logs,
    list_progress_events,
    parse_iso8601_timestamp,
    parse_positive_int,
    user_can_access_assignment,
    user_can_access_student_data,
    validate_uuid,
)
from app.services.supabase_client import get_supabase_admin_client

log = logging.getLogger(__name__)

live_monitoring_bp = Blueprint("live_monitoring", __name__)


def _err(msg: str, code: int) -> Tuple[Response, int]:
    return jsonify({"error": msg}), code


def _limit(default: int, maximum: int) -> int:
    return parse_positive_int(request.args.get("limit"), default, maximum)


def _since() -> datetime | None:
    return parse_iso8601_timestamp(request.args.get("since"))


def _require_ctx(client: Any, aid: str) -> AssignmentContext | Tuple[Response, int]:
    if not validate_uuid(aid):
        return _err("Invalid assignment ID", 400)
    ctx = fetch_assignment_context(client, aid)
    if ctx is None:
        return _err("Assignment not found", 404)
    if not user_can_access_assignment(client, ctx, g.user_id, g.user_role):
        return _err("Access denied", 403)
    return ctx


def _student_filter(client: Any, ctx: AssignmentContext) -> str | None | Tuple[Response, int]:
    if g.user_role != "teacher":
        return g.user_id
    target = request.args.get("student_id")
    if not target:
        return None
    if not validate_uuid(target):
        return _err("Invalid student ID", 400)
    if not user_can_access_student_data(client, ctx, g.user_id, g.user_role, target):
        return _err("Student not found in classroom", 404)
    return target


@live_monitoring_bp.route("/assignments/<assignment_id>/live/errors", methods=["POST"])
@require_role("student")
def ingest_error(assignment_id: str) -> Tuple[Response, int]:
    try:
        payload = ErrorLogPayload.from_payload(request.get_json())
    except ValidationError as exc:
        return _err(str(exc), 400)
    client = get_supabase_admin_client()
    ctx = _require_ctx(client, assignment_id)
    if isinstance(ctx, tuple):
        return ctx
    return _persist_error(client, ctx, payload)


def _persist_error(client: Any, ctx: AssignmentContext, p: ErrorLogPayload) -> Tuple[Response, int]:
    cat = categorize_error(p.error_message, p.topic, p.metadata)
    fp = p.error_fingerprint or generate_error_fingerprint(p.error_message, p.assignment_part, p.topic, cat)
    rec = ErrorLogRecord(p.error_message, p.assignment_part, p.topic, cat, fp, p.metadata, p.occurred_at)
    try:
        row = insert_error_log(client, ctx, g.user_id, rec)
    except (APIError, ValueError):
        log.exception("Failed to insert error log")
        return _err("Failed to persist error log", 500)
    return jsonify(row), 201


@live_monitoring_bp.route("/assignments/<assignment_id>/live/errors", methods=["GET"])
@require_auth
def get_error_logs(assignment_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    ctx = _require_ctx(client, assignment_id)
    if isinstance(ctx, tuple):
        return ctx
    sf = _student_filter(client, ctx)
    if isinstance(sf, tuple):
        return sf
    try:
        q = ListQuery(assignment_id, _limit(100, 1000), sf, _since())
    except ValueError as exc:
        return _err(str(exc), 400)
    try:
        logs = list_error_logs(client, q)
    except APIError:
        log.exception("Failed to query error logs")
        return _err("Failed to fetch error logs", 500)
    if g.user_role == "teacher":
        enrich_with_display_names(logs, client)
    return jsonify({"assignment_id": assignment_id, "count": len(logs), "logs": logs}), 200


@live_monitoring_bp.route("/assignments/<assignment_id>/live/progress", methods=["POST"])
@require_role("student")
def ingest_progress(assignment_id: str) -> Tuple[Response, int]:
    try:
        p = ProgressUpdatePayload.from_payload(request.get_json())
    except ValidationError as exc:
        return _err(str(exc), 400)
    client = get_supabase_admin_client()
    ctx = _require_ctx(client, assignment_id)
    if isinstance(ctx, tuple):
        return ctx
    rec = ProgressRecord(
        p.completion_percentage, p.state, p.assignment_part,
        p.topic, p.active_error_fingerprint, p.metadata, p.last_active_at,
    )
    try:
        row = insert_progress_event(client, ctx, g.user_id, rec)
    except (APIError, ValueError):
        log.exception("Failed to insert progress")
        return _err("Failed to persist progress event", 500)
    return jsonify(row), 201


@live_monitoring_bp.route("/assignments/<assignment_id>/live/progress", methods=["GET"])
@require_auth
def get_progress(assignment_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()
    ctx = _require_ctx(client, assignment_id)
    if isinstance(ctx, tuple):
        return ctx
    sf = _student_filter(client, ctx)
    if isinstance(sf, tuple):
        return sf
    try:
        lim = _limit(250, 5000)
        since = _since()
    except ValueError as exc:
        return _err(str(exc), 400)
    try:
        pmap = fetch_latest_progress_per_student(client, assignment_id, since)
    except APIError:
        log.exception("Failed to query progress")
        return _err("Failed to fetch progress events", 500)
    recs = list(pmap.values()) if sf is None else ([pmap[sf]] if sf in pmap else [])
    if g.user_role == "teacher":
        enrich_with_display_names(recs, client)
    q = ListQuery(assignment_id, lim, sf, since)
    return _progress_resp(client, recs, q)


def _progress_resp(
    client: Any, recs: list[dict[str, Any]], q: ListQuery,
) -> Tuple[Response, int]:
    resp: dict[str, Any] = {"assignment_id": q.assignment_id, "latest_count": len(recs), "latest_progress": recs}
    if request.args.get("include_events", "false").lower() == "true":
        try:
            evts = list_progress_events(client, q)
        except APIError:
            log.exception("Failed to query events")
            return _err("Failed to fetch progress events", 500)
        resp["events"] = evts
        resp["event_count"] = len(evts)
    return jsonify(resp), 200


@live_monitoring_bp.route("/assignments/<assignment_id>/insights", methods=["GET"])
@require_role("teacher")
def get_insights(assignment_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _err("Invalid assignment ID", 400)
    client = get_supabase_admin_client()
    ctx = fetch_assignment_context(client, assignment_id)
    if ctx is None:
        return _err("Assignment not found", 404)
    if ctx.teacher_id != g.user_id:
        return _err("Access denied", 403)
    try:
        settings = InsightSettings.from_query_args(request.args)
        since = _since()
        elim = parse_positive_int(request.args.get("error_limit"), 3000, 20000)
    except ValueError as exc:
        return _err(str(exc), 400)
    return _do_insights(client, ctx, settings, since, elim)


def _do_insights(
    client: Any, ctx: AssignmentContext,
    settings: InsightSettings, since: datetime | None, elim: int,
) -> Tuple[Response, int]:
    try:
        sids = list_classroom_student_ids(client, ctx.classroom_id)
        names = list_display_names(client, sids)
        errs = list_error_logs(client, ListQuery(ctx.assignment_id, elim, None, since))
        pmap = fetch_latest_progress_per_student(client, ctx.assignment_id, since)
    except APIError:
        log.exception("Failed to query insights")
        return _err("Failed to fetch insight data", 500)
    roster = {sid: names.get(sid, "") for sid in sids}
    data = InsightData(error_logs=errs, progress_map=pmap)
    return jsonify(build_teacher_insights(ctx.assignment_id, roster, data, settings)), 200


@live_monitoring_bp.route(
    "/assignments/<assignment_id>/students/<student_id>/failure-summary", methods=["GET"],
)
@require_auth
def get_failure_summary(assignment_id: str, student_id: str) -> Tuple[Response, int]:
    if not validate_uuid(assignment_id):
        return _err("Invalid assignment ID", 400)
    if not validate_uuid(student_id):
        return _err("Invalid student ID", 400)
    client = get_supabase_admin_client()
    ctx = fetch_assignment_context(client, assignment_id)
    if ctx is None:
        return _err("Assignment not found", 404)
    if not user_can_access_student_data(client, ctx, g.user_id, g.user_role, student_id):
        return _err("Access denied", 403)
    return _do_failure_summary(client, assignment_id, student_id)


def _do_failure_summary(client: Any, aid: str, sid: str) -> Tuple[Response, int]:
    try:
        settings = InsightSettings.from_query_args(request.args)
        errs = list_error_logs(client, ListQuery(aid, parse_positive_int(request.args.get("error_limit"), 500, 5000), sid))
        prog = list_progress_events(client, ListQuery(aid, parse_positive_int(request.args.get("progress_limit"), 200, 5000), sid))
    except ValueError as exc:
        return _err(str(exc), 400)
    except APIError:
        log.exception("Failed to query failure summary")
        return _err("Failed to fetch failure summary data", 500)
    names = list_display_names(client, [sid])
    who = FailureSummaryInput(aid, sid, names.get(sid, ""))
    latest = latest_progress_by_student(prog).get(sid)
    return jsonify(build_student_failure_summary(who, errs, latest, settings)), 200

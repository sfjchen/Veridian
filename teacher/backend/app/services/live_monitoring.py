from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from supabase import Client

ERROR_TABLE = "assignment_error_logs"
PROGRESS_TABLE = "assignment_progress_events"


@dataclass(frozen=True)
class AssignmentContext:
    assignment_id: str
    classroom_id: str
    teacher_id: str


@dataclass(frozen=True)
class ErrorLogRecord:
    error_message: str
    assignment_part: str | None
    topic: str | None
    error_category: str
    error_fingerprint: str
    metadata: dict[str, Any]
    occurred_at: datetime


@dataclass(frozen=True)
class ProgressRecord:
    completion_percentage: float
    state: str
    assignment_part: str | None
    topic: str | None
    active_error_fingerprint: str | None
    metadata: dict[str, Any]
    last_active_at: datetime


@dataclass(frozen=True)
class ListQuery:
    assignment_id: str
    limit: int
    student_id: str | None = None
    since: datetime | None = None


def validate_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def parse_iso8601_timestamp(value: str | None) -> datetime | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    try:
        parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_positive_int(value: str | None, default: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError("Value must be a positive integer") from exc
    if parsed <= 0:
        raise ValueError("Value must be a positive integer")
    return min(parsed, maximum)


def _iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(value.strip().lower().split())


def generate_error_fingerprint(
    error_message: str,
    assignment_part: str | None,
    topic: str | None,
    category: str,
) -> str:
    src = "|".join([
        normalize_text(error_message), normalize_text(assignment_part),
        normalize_text(topic), normalize_text(category),
    ])
    return hashlib.sha256(src.encode("utf-8")).hexdigest()[:32]


def parse_record_timestamp(rec: dict[str, Any], key: str) -> datetime | None:
    value = rec.get(key)
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def fetch_assignment_context(client: Client, aid: str) -> AssignmentContext | None:
    result = client.table("assignments").select("id, classroom_id").eq("id", aid).limit(1).execute()
    if not result.data:
        return None
    return _resolve_classroom(client, result.data[0])


def _resolve_classroom(client: Client, rec: dict[str, Any]) -> AssignmentContext | None:
    result = client.table("classrooms").select("id, teacher_id").eq("id", rec["classroom_id"]).limit(1).execute()
    if not result.data:
        return None
    return AssignmentContext(rec["id"], rec["classroom_id"], result.data[0]["teacher_id"])


def _is_member(client: Client, cid: str, uid: str) -> bool:
    r = client.table("classroom_memberships").select("student_id").eq("classroom_id", cid).eq("student_id", uid).limit(1).execute()
    return bool(r.data)


def user_can_access_assignment(client: Client, ctx: AssignmentContext, uid: str, role: str) -> bool:
    if role == "teacher":
        return ctx.teacher_id == uid
    return _is_member(client, ctx.classroom_id, uid)


def user_can_access_student_data(
    client: Client, ctx: AssignmentContext,
    requester_id: str, requester_role: str, student_id: str,
) -> bool:
    if requester_role == "teacher":
        return requester_id == ctx.teacher_id and _is_member(client, ctx.classroom_id, student_id)
    return requester_id == student_id and _is_member(client, ctx.classroom_id, requester_id)


def list_classroom_student_ids(client: Client, cid: str) -> list[str]:
    r = client.table("classroom_memberships").select("student_id").eq("classroom_id", cid).execute()
    return [row["student_id"] for row in r.data if row.get("student_id")]


def list_display_names(client: Client, sids: list[str]) -> dict[str, str]:
    if not sids:
        return {}
    r = client.table("profiles").select("id, display_name").in_("id", sids).execute()
    return {row["id"]: row.get("display_name") or "" for row in r.data if row.get("id")}


def enrich_with_display_names(records: list[dict[str, Any]], client: Client) -> None:
    sids = sorted({r["student_id"] for r in records if r.get("student_id")})
    if not sids:
        return
    names = list_display_names(client, sids)
    for row in records:
        sid = row.get("student_id")
        row["student_display_name"] = names.get(sid, "") if sid else ""


def _error_row(ctx: AssignmentContext, sid: str, rec: ErrorLogRecord) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()), "assignment_id": ctx.assignment_id,
        "classroom_id": ctx.classroom_id, "student_id": sid,
        "assignment_part": rec.assignment_part, "topic": rec.topic,
        "error_message": rec.error_message, "error_category": rec.error_category,
        "error_fingerprint": rec.error_fingerprint, "metadata": rec.metadata,
        "occurred_at": _iso_utc(rec.occurred_at),
    }


def insert_error_log(client: Client, ctx: AssignmentContext, sid: str, rec: ErrorLogRecord) -> dict[str, Any]:
    result = client.table(ERROR_TABLE).insert(_error_row(ctx, sid, rec)).execute()
    if not result.data:
        raise ValueError("Failed to persist error log")
    return result.data[0]


def _progress_row(ctx: AssignmentContext, sid: str, rec: ProgressRecord) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()), "assignment_id": ctx.assignment_id,
        "classroom_id": ctx.classroom_id, "student_id": sid,
        "completion_percentage": rec.completion_percentage, "state": rec.state,
        "assignment_part": rec.assignment_part, "topic": rec.topic,
        "active_error_fingerprint": rec.active_error_fingerprint,
        "metadata": rec.metadata, "last_active_at": _iso_utc(rec.last_active_at),
    }


def insert_progress_event(client: Client, ctx: AssignmentContext, sid: str, rec: ProgressRecord) -> dict[str, Any]:
    result = client.table(PROGRESS_TABLE).insert(_progress_row(ctx, sid, rec)).execute()
    if not result.data:
        raise ValueError("Failed to persist progress event")
    return result.data[0]


def _apply_filters(q: Any, lq: ListQuery, tf: str) -> Any:
    if lq.student_id is not None:
        q = q.eq("student_id", lq.student_id)
    if lq.since is not None:
        q = q.gte(tf, _iso_utc(lq.since))
    return q.order(tf, desc=True).limit(lq.limit)


def list_error_logs(client: Client, q: ListQuery) -> list[dict[str, Any]]:
    query = client.table(ERROR_TABLE).select("*").eq("assignment_id", q.assignment_id)
    return [dict(r) for r in _apply_filters(query, q, "occurred_at").execute().data]


def list_progress_events(client: Client, q: ListQuery) -> list[dict[str, Any]]:
    query = client.table(PROGRESS_TABLE).select("*").eq("assignment_id", q.assignment_id)
    return [dict(r) for r in _apply_filters(query, q, "last_active_at").execute().data]


def latest_progress_by_student(events: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in events:
        sid = row.get("student_id")
        if not sid or sid in latest:
            continue
        latest[sid] = row
    return latest


def fetch_latest_progress_per_student(
    client: Client, aid: str, since: datetime | None = None,
) -> dict[str, dict[str, Any]]:
    q = client.table(PROGRESS_TABLE).select("*").eq("assignment_id", aid)
    if since is not None:
        q = q.gte("last_active_at", _iso_utc(since))
    result = q.order("last_active_at", desc=True).limit(10000).execute()
    return latest_progress_by_student([dict(r) for r in result.data])

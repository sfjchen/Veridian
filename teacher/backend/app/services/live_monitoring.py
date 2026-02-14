from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from supabase import Client

ASSIGNMENT_ERROR_LOG_TABLE = "assignment_error_logs"
ASSIGNMENT_PROGRESS_TABLE = "assignment_progress_events"


@dataclass(frozen=True)
class AssignmentContext:
    assignment_id: str
    classroom_id: str
    teacher_id: str


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


def parse_positive_int(value: str | None, default_value: int, max_value: int) -> int:
    if value is None:
        return default_value
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError("Value must be a positive integer") from exc
    if parsed <= 0:
        raise ValueError("Value must be a positive integer")
    return min(parsed, max_value)


def _isoformat_utc(value: datetime) -> str:
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
    fingerprint_source = "|".join([
        normalize_text(error_message),
        normalize_text(assignment_part),
        normalize_text(topic),
        normalize_text(category),
    ])
    digest = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()
    return digest[:32]


def parse_record_timestamp(record: dict[str, Any], key: str) -> datetime | None:
    value = record.get(key)
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def fetch_assignment_context(client: Client, assignment_id: str) -> AssignmentContext | None:
    assignment = client.table("assignments").select("id, classroom_id").eq(
        "id", assignment_id
    ).limit(1).execute()
    if not assignment.data:
        return None

    record = assignment.data[0]
    classroom = client.table("classrooms").select("id, teacher_id").eq(
        "id", record["classroom_id"]
    ).limit(1).execute()
    if not classroom.data:
        return None

    return AssignmentContext(
        assignment_id=record["id"],
        classroom_id=record["classroom_id"],
        teacher_id=classroom.data[0]["teacher_id"],
    )


def user_is_classroom_student(client: Client, classroom_id: str, user_id: str) -> bool:
    membership = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).eq("student_id", user_id).limit(1).execute()
    return bool(membership.data)


def user_can_access_assignment(
    client: Client, context: AssignmentContext, user_id: str, user_role: str,
) -> bool:
    if user_role == "teacher":
        return context.teacher_id == user_id
    return user_is_classroom_student(client, context.classroom_id, user_id)


def user_can_access_student_assignment_data(
    client: Client,
    context: AssignmentContext,
    requester_id: str,
    requester_role: str,
    student_id: str,
) -> bool:
    if requester_role == "teacher":
        if requester_id != context.teacher_id:
            return False
        return user_is_classroom_student(client, context.classroom_id, student_id)
    return requester_id == student_id and user_is_classroom_student(
        client, context.classroom_id, requester_id
    )


def list_classroom_student_ids(client: Client, classroom_id: str) -> list[str]:
    memberships = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).execute()
    return [row["student_id"] for row in memberships.data if row.get("student_id")]


def list_display_names_by_student_id(
    client: Client, student_ids: list[str],
) -> dict[str, str]:
    if not student_ids:
        return {}
    profiles = client.table("profiles").select("id, display_name").in_(
        "id", student_ids
    ).execute()
    return {
        row["id"]: row.get("display_name") or ""
        for row in profiles.data
        if row.get("id")
    }


def enrich_with_display_names(
    records: list[dict[str, Any]], client: Client, field: str = "student_id",
) -> None:
    student_ids = sorted({row[field] for row in records if row.get(field)})
    if not student_ids:
        return
    display_names = list_display_names_by_student_id(client, student_ids)
    for row in records:
        sid = row.get(field)
        row["student_display_name"] = display_names.get(sid, "") if sid else ""


def insert_error_log(
    client: Client,
    context: AssignmentContext,
    student_id: str,
    error_message: str,
    assignment_part: str | None,
    topic: str | None,
    error_category: str,
    error_fingerprint: str,
    metadata: dict[str, Any],
    occurred_at: datetime,
) -> dict[str, Any]:
    result = client.table(ASSIGNMENT_ERROR_LOG_TABLE).insert({
        "id": str(uuid.uuid4()),
        "assignment_id": context.assignment_id,
        "classroom_id": context.classroom_id,
        "student_id": student_id,
        "assignment_part": assignment_part,
        "topic": topic,
        "error_message": error_message,
        "error_category": error_category,
        "error_fingerprint": error_fingerprint,
        "metadata": metadata,
        "occurred_at": _isoformat_utc(occurred_at),
    }).execute()
    if not result.data:
        raise ValueError("Failed to persist error log")
    return result.data[0]


def insert_progress_event(
    client: Client,
    context: AssignmentContext,
    student_id: str,
    completion_percentage: float,
    state: str,
    assignment_part: str | None,
    topic: str | None,
    active_error_fingerprint: str | None,
    metadata: dict[str, Any],
    last_active_at: datetime,
) -> dict[str, Any]:
    result = client.table(ASSIGNMENT_PROGRESS_TABLE).insert({
        "id": str(uuid.uuid4()),
        "assignment_id": context.assignment_id,
        "classroom_id": context.classroom_id,
        "student_id": student_id,
        "completion_percentage": completion_percentage,
        "state": state,
        "assignment_part": assignment_part,
        "topic": topic,
        "active_error_fingerprint": active_error_fingerprint,
        "metadata": metadata,
        "last_active_at": _isoformat_utc(last_active_at),
    }).execute()
    if not result.data:
        raise ValueError("Failed to persist progress event")
    return result.data[0]


def list_error_logs(
    client: Client,
    assignment_id: str,
    limit: int,
    student_id: str | None,
    since: datetime | None,
) -> list[dict[str, Any]]:
    query = client.table(ASSIGNMENT_ERROR_LOG_TABLE).select("*").eq("assignment_id", assignment_id)
    if student_id is not None:
        query = query.eq("student_id", student_id)
    if since is not None:
        query = query.gte("occurred_at", _isoformat_utc(since))
    result = query.order("occurred_at", desc=True).limit(limit).execute()
    return [dict(row) for row in result.data]


def list_progress_events(
    client: Client,
    assignment_id: str,
    limit: int,
    student_id: str | None,
    since: datetime | None,
) -> list[dict[str, Any]]:
    query = client.table(ASSIGNMENT_PROGRESS_TABLE).select("*").eq("assignment_id", assignment_id)
    if student_id is not None:
        query = query.eq("student_id", student_id)
    if since is not None:
        query = query.gte("last_active_at", _isoformat_utc(since))
    result = query.order("last_active_at", desc=True).limit(limit).execute()
    return [dict(row) for row in result.data]


def latest_progress_by_student(progress_events: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in progress_events:
        student_id = row.get("student_id")
        if not student_id or student_id in latest:
            continue
        latest[student_id] = row
    return latest


def fetch_latest_progress_per_student(
    client: Client, assignment_id: str, since: datetime | None = None,
) -> dict[str, dict[str, Any]]:
    query = client.table(ASSIGNMENT_PROGRESS_TABLE).select("*").eq(
        "assignment_id", assignment_id,
    )
    if since is not None:
        query = query.gte("last_active_at", _isoformat_utc(since))
    result = query.order("last_active_at", desc=True).limit(10000).execute()
    return latest_progress_by_student([dict(r) for r in result.data])

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

MAX_FREE_TEXT_LENGTH = 4000
MAX_LABEL_LENGTH = 200
ALLOWED_PROGRESS_STATES = {
    "not_started",
    "in_progress",
    "stuck",
    "completed",
}


class ValidationError(ValueError):
    """Raised when request payload validation fails."""


def _parse_datetime(value: Any, field_name: str) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            raise ValidationError(f"{field_name} must be a valid ISO-8601 timestamp")
        try:
            parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValidationError(f"{field_name} must be a valid ISO-8601 timestamp") from exc
    else:
        raise ValidationError(f"{field_name} must be a valid ISO-8601 timestamp")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_optional_text(value: Any, field_name: str, max_length: int = MAX_LABEL_LENGTH) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field_name} must be a string")
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > max_length:
        raise ValidationError(f"{field_name} must be <= {max_length} characters")
    return trimmed


def _parse_metadata(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValidationError("metadata must be an object")
    return value


def _parse_completion_percentage(value: Any) -> float:
    try:
        completion_percentage = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("completion_percentage must be a number between 0 and 100") from exc
    if not (0 <= completion_percentage <= 100):
        raise ValidationError("completion_percentage must be a number between 0 and 100")
    return round(completion_percentage, 2)


@dataclass(frozen=True)
class ErrorLogPayload:
    error_message: str
    assignment_part: str | None
    topic: str | None
    error_fingerprint: str | None
    metadata: dict[str, Any]
    occurred_at: datetime

    @classmethod
    def from_payload(cls, payload: dict[str, Any] | None) -> "ErrorLogPayload":
        if not payload:
            raise ValidationError("Request body required")

        raw_message = payload.get("error_message")
        if not isinstance(raw_message, str):
            raise ValidationError("error_message required")
        error_message = raw_message.strip()
        if not error_message:
            raise ValidationError("error_message required")
        if len(error_message) > MAX_FREE_TEXT_LENGTH:
            raise ValidationError(f"error_message must be <= {MAX_FREE_TEXT_LENGTH} characters")

        occurred_at = (
            _parse_datetime(payload["occurred_at"], "occurred_at")
            if "occurred_at" in payload
            else datetime.now(timezone.utc)
        )

        return cls(
            error_message=error_message,
            assignment_part=_parse_optional_text(payload.get("assignment_part"), "assignment_part"),
            topic=_parse_optional_text(payload.get("topic"), "topic"),
            error_fingerprint=_parse_optional_text(
                payload.get("error_fingerprint"),
                "error_fingerprint",
                max_length=MAX_FREE_TEXT_LENGTH,
            ),
            metadata=_parse_metadata(payload.get("metadata")),
            occurred_at=occurred_at,
        )


@dataclass(frozen=True)
class ProgressUpdatePayload:
    completion_percentage: float
    state: str
    assignment_part: str | None
    topic: str | None
    active_error_fingerprint: str | None
    metadata: dict[str, Any]
    last_active_at: datetime

    @classmethod
    def from_payload(cls, payload: dict[str, Any] | None) -> "ProgressUpdatePayload":
        if not payload:
            raise ValidationError("Request body required")
        if "completion_percentage" not in payload:
            raise ValidationError("completion_percentage required")

        state_value = payload.get("state", "in_progress")
        if not isinstance(state_value, str):
            raise ValidationError("state must be a string")
        state = state_value.strip().lower()
        if state not in ALLOWED_PROGRESS_STATES:
            allowed = ", ".join(sorted(ALLOWED_PROGRESS_STATES))
            raise ValidationError(f"state must be one of: {allowed}")

        last_active_at = (
            _parse_datetime(payload["last_active_at"], "last_active_at")
            if "last_active_at" in payload
            else datetime.now(timezone.utc)
        )

        return cls(
            completion_percentage=_parse_completion_percentage(payload.get("completion_percentage")),
            state=state,
            assignment_part=_parse_optional_text(payload.get("assignment_part"), "assignment_part"),
            topic=_parse_optional_text(payload.get("topic"), "topic"),
            active_error_fingerprint=_parse_optional_text(
                payload.get("active_error_fingerprint"),
                "active_error_fingerprint",
                max_length=MAX_FREE_TEXT_LENGTH,
            ),
            metadata=_parse_metadata(payload.get("metadata")),
            last_active_at=last_active_at,
        )

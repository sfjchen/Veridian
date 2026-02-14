from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.services.live_monitoring import parse_record_timestamp

UNKNOWN_BUCKET = "unclassified"
SYNTAX_CATEGORY = "syntax_error"
LOGIC_CATEGORY = "logical_fallacy"
COMPLEXITY_CATEGORY = "time_complexity_issue"
RUNTIME_CATEGORY = "runtime_error"
CONCEPT_CATEGORY = "conceptual_gap"

SYNTAX_HINTS = {
    "syntax",
    "token",
    "parse",
    "parenthesis",
    "parentheses",
    "bracket",
    "indent",
    "semicolon",
    "unterminated",
    "unexpected",
}
LOGIC_HINTS = {
    "logic",
    "wrong answer",
    "incorrect",
    "off by one",
    "edge case",
    "condition",
    "branch",
    "fallacy",
    "counterexample",
}
COMPLEXITY_HINTS = {
    "complexity",
    "big-o",
    "time limit",
    "timeout",
    "quadratic",
    "cubic",
    "n^2",
    "n log n",
    "performance",
}
RUNTIME_HINTS = {
    "exception",
    "runtime",
    "stack overflow",
    "nullpointer",
    "index out of range",
    "division by zero",
    "segmentation fault",
}


@dataclass(frozen=True)
class InsightSettings:
    failing_ratio_threshold: float = 0.30
    inactivity_minutes: int = 30
    stuck_minutes: int = 20
    stuck_repeat_threshold: int = 3
    mastery_target: float = 0.70
    min_topic_events: int = 3

    @classmethod
    def from_query_args(cls, query_args: Any) -> "InsightSettings":
        return cls(
            failing_ratio_threshold=_parse_ratio(query_args.get("failing_ratio_threshold"), 0.30),
            inactivity_minutes=_parse_positive_int(query_args.get("inactivity_minutes"), 30),
            stuck_minutes=_parse_positive_int(query_args.get("stuck_minutes"), 20),
            stuck_repeat_threshold=_parse_positive_int(query_args.get("stuck_repeat_threshold"), 3),
            mastery_target=_parse_ratio(query_args.get("mastery_target"), 0.70),
            min_topic_events=_parse_positive_int(query_args.get("min_topic_events"), 3),
        )


def _parse_ratio(value: Any, default_value: float) -> float:
    if value is None:
        return default_value
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Ratio values must be decimal numbers in the interval (0, 1]") from exc
    if parsed <= 0 or parsed > 1:
        raise ValueError("Ratio values must be in the interval (0, 1]")
    return parsed


def _parse_positive_int(value: Any, default_value: int) -> int:
    if value is None:
        return default_value
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Expected a positive integer") from exc
    if parsed <= 0:
        raise ValueError("Expected a positive integer")
    return parsed


def _normalize_bucket(value: Any, default_value: str = UNKNOWN_BUCKET) -> str:
    if not isinstance(value, str):
        return default_value
    normalized = value.strip()
    if not normalized:
        return default_value
    return normalized


def _contains_any(text: str, hints: set[str]) -> bool:
    for hint in hints:
        if hint in text:
            return True
    return False


def categorize_error(
    error_message: str,
    topic: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    metadata = metadata or {}
    explicit = metadata.get("category")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip().lower()

    normalized_message = error_message.strip().lower()
    normalized_topic = (topic or "").strip().lower()
    combined_text = normalized_message + " " + normalized_topic

    if _contains_any(combined_text, SYNTAX_HINTS):
        return SYNTAX_CATEGORY
    if _contains_any(combined_text, COMPLEXITY_HINTS):
        return COMPLEXITY_CATEGORY
    if _contains_any(combined_text, LOGIC_HINTS):
        return LOGIC_CATEGORY
    if _contains_any(combined_text, RUNTIME_HINTS):
        return RUNTIME_CATEGORY
    return CONCEPT_CATEGORY


def _minutes_since(now: datetime, timestamp: datetime | None) -> int | None:
    if timestamp is None:
        return None
    delta = now - timestamp
    return max(0, int(delta.total_seconds() // 60))


def _error_group_key(error_log: dict[str, Any]) -> str:
    fingerprint = error_log.get("error_fingerprint")
    if isinstance(fingerprint, str) and fingerprint.strip():
        return fingerprint.strip()
    category = _normalize_bucket(error_log.get("error_category"))
    assignment_part = _normalize_bucket(error_log.get("assignment_part"), "unknown_part")
    return category + ":" + assignment_part


def _sort_errors_desc(error_logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        error_logs,
        key=lambda row: parse_record_timestamp(row, "occurred_at") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )


def _latest_error_timestamps(error_logs: list[dict[str, Any]]) -> dict[str, datetime]:
    latest_by_student: dict[str, datetime] = {}
    for row in _sort_errors_desc(error_logs):
        student_id = row.get("student_id")
        if not student_id or student_id in latest_by_student:
            continue
        timestamp = parse_record_timestamp(row, "occurred_at")
        if timestamp is not None:
            latest_by_student[student_id] = timestamp
    return latest_by_student


def _consecutive_same_error_window(
    student_error_logs: list[dict[str, Any]],
) -> tuple[int, int]:
    if not student_error_logs:
        return 0, 0
    sorted_logs = _sort_errors_desc(student_error_logs)
    first_key = _error_group_key(sorted_logs[0])
    count = 0
    oldest_timestamp = parse_record_timestamp(sorted_logs[0], "occurred_at")
    latest_timestamp = oldest_timestamp
    for row in sorted_logs:
        if _error_group_key(row) != first_key:
            break
        count += 1
        timestamp = parse_record_timestamp(row, "occurred_at")
        if timestamp is not None:
            oldest_timestamp = timestamp
    if latest_timestamp is None or oldest_timestamp is None:
        return count, 0
    minutes = max(0, int((latest_timestamp - oldest_timestamp).total_seconds() // 60))
    return count, minutes


def build_teacher_insights(
    assignment_id: str,
    student_ids: list[str],
    student_display_names: dict[str, str],
    error_logs: list[dict[str, Any]],
    latest_progress_by_student_id: dict[str, dict[str, Any]],
    settings: InsightSettings,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    enrolled_students = sorted(set(student_ids))
    enrolled_student_set = set(enrolled_students)
    student_count = len(enrolled_students)
    if student_count == 0:
        return {
            "assignment_id": assignment_id,
            "generated_at": now.isoformat(),
            "student_count": 0,
            "common_stumbling_blocks": [],
            "engagement_metrics": {"inactive_students": [], "stuck_students": []},
            "concept_mastery": {
                "mastered": [],
                "needs_review": [],
                "insufficient_data": [],
            },
        }

    errors_by_student: dict[str, list[dict[str, Any]]] = defaultdict(list)
    part_to_students: dict[str, set[str]] = defaultdict(set)
    part_to_category_counts: dict[str, Counter[str]] = defaultdict(Counter)
    topic_to_students: dict[str, set[str]] = defaultdict(set)
    topic_events: Counter[str] = Counter()

    for row in error_logs:
        student_id = row.get("student_id")
        if student_id not in enrolled_student_set:
            continue
        errors_by_student[student_id].append(row)
        assignment_part = _normalize_bucket(row.get("assignment_part"), "unlabeled_part")
        part_to_students[assignment_part].add(student_id)
        category = _normalize_bucket(row.get("error_category"))
        part_to_category_counts[assignment_part][category] += 1
        topic = _normalize_bucket(row.get("topic"))
        topic_to_students[topic].add(student_id)
        topic_events[topic] += 1

    stumbling_blocks: list[dict[str, Any]] = []
    for assignment_part, students in part_to_students.items():
        failing_ratio = len(students) / student_count
        if failing_ratio <= settings.failing_ratio_threshold:
            continue
        top_categories = [
            category for category, _ in part_to_category_counts[assignment_part].most_common(3)
        ]
        stumbling_blocks.append({
            "assignment_part": assignment_part,
            "failing_students": len(students),
            "failing_ratio": round(failing_ratio, 4),
            "primary_error_categories": top_categories,
            "student_ids": sorted(students),
        })
    stumbling_blocks.sort(key=lambda row: row["failing_ratio"], reverse=True)

    latest_error_timestamp_by_student = _latest_error_timestamps(error_logs)
    inactive_students: list[dict[str, Any]] = []
    stuck_students: list[dict[str, Any]] = []
    for student_id in enrolled_students:
        progress = latest_progress_by_student_id.get(student_id, {})
        progress_timestamp = parse_record_timestamp(progress, "last_active_at")
        error_timestamp = latest_error_timestamp_by_student.get(student_id)
        last_active = progress_timestamp or error_timestamp
        minutes_inactive = _minutes_since(now, last_active)
        if minutes_inactive is None or minutes_inactive >= settings.inactivity_minutes:
            inactive_students.append({
                "student_id": student_id,
                "display_name": student_display_names.get(student_id, ""),
                "minutes_inactive": minutes_inactive,
                "last_active_at": last_active.isoformat() if last_active is not None else None,
            })

        recent_errors = errors_by_student.get(student_id, [])
        repeated_count, stuck_minutes = _consecutive_same_error_window(recent_errors)
        progress_state = _normalize_bucket(progress.get("state"), "unknown")
        if repeated_count >= settings.stuck_repeat_threshold and stuck_minutes >= settings.stuck_minutes:
            stuck_students.append({
                "student_id": student_id,
                "display_name": student_display_names.get(student_id, ""),
                "repeated_error_count": repeated_count,
                "stuck_minutes": stuck_minutes,
            })
        elif progress_state == "stuck":
            stuck_students.append({
                "student_id": student_id,
                "display_name": student_display_names.get(student_id, ""),
                "repeated_error_count": repeated_count,
                "stuck_minutes": stuck_minutes,
            })

    mastered: list[dict[str, Any]] = []
    needs_review: list[dict[str, Any]] = []
    insufficient_data: list[dict[str, Any]] = []
    for topic, students in topic_to_students.items():
        if topic == UNKNOWN_BUCKET:
            continue
        error_rate = len(students) / student_count
        mastery_score = max(0.0, 1.0 - error_rate)
        entry = {
            "topic": topic,
            "error_event_count": int(topic_events[topic]),
            "error_student_count": len(students),
            "error_rate": round(error_rate, 4),
            "mastery_score": round(mastery_score, 4),
        }
        if topic_events[topic] < settings.min_topic_events:
            insufficient_data.append(entry)
        elif mastery_score >= settings.mastery_target:
            mastered.append(entry)
        else:
            needs_review.append(entry)

    mastered.sort(key=lambda row: row["mastery_score"], reverse=True)
    needs_review.sort(key=lambda row: row["error_rate"], reverse=True)
    insufficient_data.sort(key=lambda row: row["error_event_count"], reverse=True)

    return {
        "assignment_id": assignment_id,
        "generated_at": now.isoformat(),
        "student_count": student_count,
        "common_stumbling_blocks": stumbling_blocks,
        "engagement_metrics": {
            "inactive_students": sorted(
                inactive_students,
                key=lambda row: row["minutes_inactive"] if row["minutes_inactive"] is not None else 10 ** 9,
                reverse=True,
            ),
            "stuck_students": sorted(
                stuck_students,
                key=lambda row: (row["stuck_minutes"], row["repeated_error_count"]),
                reverse=True,
            ),
        },
        "concept_mastery": {
            "mastered": mastered,
            "needs_review": needs_review,
            "insufficient_data": insufficient_data,
        },
    }


def _dominant_categories(error_logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    category_counts = Counter(
        _normalize_bucket(row.get("error_category"))
        for row in error_logs
    )
    total = sum(category_counts.values())
    if total == 0:
        return []
    output: list[dict[str, Any]] = []
    for category, count in category_counts.most_common(3):
        output.append({
            "category": category,
            "count": count,
            "share": round(count / total, 4),
        })
    return output


def _dominant_topics(error_logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    topic_counts = Counter(
        _normalize_bucket(row.get("topic"))
        for row in error_logs
        if _normalize_bucket(row.get("topic")) != UNKNOWN_BUCKET
    )
    total = sum(topic_counts.values())
    if total == 0:
        return []
    output: list[dict[str, Any]] = []
    for topic, count in topic_counts.most_common(3):
        output.append({
            "topic": topic,
            "count": count,
            "share": round(count / total, 4),
        })
    return output


def _build_recommendations(reason_codes: list[str]) -> list[str]:
    recommendations: list[str] = []
    if "low_completion" in reason_codes:
        recommendations.append("Schedule a short checkpoint to unblock assignment progress.")
    if "inactive" in reason_codes:
        recommendations.append("Re-engage the student with a time-bound mini task.")
    if "repeated_error_pattern" in reason_codes:
        recommendations.append("Review one worked example targeting the repeated error pattern.")
    if "high_error_volume" in reason_codes:
        recommendations.append("Reduce scope temporarily and validate understanding after each step.")
    if "dominant_complexity_issue" in reason_codes:
        recommendations.append("Reinforce algorithmic complexity tradeoffs with simpler benchmarks.")
    if "dominant_logic_issue" in reason_codes:
        recommendations.append("Use trace tables to verify branch logic and edge cases.")
    if "dominant_syntax_issue" in reason_codes:
        recommendations.append("Assign a syntax-focused linting drill before the next attempt.")
    return recommendations


def build_student_failure_summary(
    assignment_id: str,
    student_id: str,
    display_name: str,
    error_logs: list[dict[str, Any]],
    latest_progress: dict[str, Any] | None,
    settings: InsightSettings,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    sorted_errors = _sort_errors_desc(error_logs)
    latest_progress = latest_progress or {}
    completion_percentage = float(latest_progress.get("completion_percentage") or 0.0)
    progress_state = _normalize_bucket(latest_progress.get("state"), "not_started")
    last_active = parse_record_timestamp(latest_progress, "last_active_at")
    if last_active is None and sorted_errors:
        last_active = parse_record_timestamp(sorted_errors[0], "occurred_at")

    minutes_since_last_active = _minutes_since(now, last_active)
    repeated_count, repeated_minutes = _consecutive_same_error_window(sorted_errors)
    category_breakdown = _dominant_categories(sorted_errors)
    topic_breakdown = _dominant_topics(sorted_errors)

    reason_codes: list[str] = []
    if completion_percentage < 70:
        reason_codes.append("low_completion")
    if minutes_since_last_active is None or minutes_since_last_active >= settings.inactivity_minutes:
        reason_codes.append("inactive")
    if len(sorted_errors) >= 3:
        reason_codes.append("high_error_volume")
    if repeated_count >= settings.stuck_repeat_threshold and repeated_minutes >= settings.stuck_minutes:
        reason_codes.append("repeated_error_pattern")
    if progress_state == "stuck":
        reason_codes.append("progress_marked_stuck")
    if category_breakdown:
        dominant_category = category_breakdown[0]["category"]
        if dominant_category == COMPLEXITY_CATEGORY:
            reason_codes.append("dominant_complexity_issue")
        elif dominant_category == LOGIC_CATEGORY:
            reason_codes.append("dominant_logic_issue")
        elif dominant_category == SYNTAX_CATEGORY:
            reason_codes.append("dominant_syntax_issue")

    unique_reason_codes = []
    for code in reason_codes:
        if code not in unique_reason_codes:
            unique_reason_codes.append(code)

    return {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "display_name": display_name,
        "generated_at": now.isoformat(),
        "is_failing": bool(unique_reason_codes),
        "failure_reasons": unique_reason_codes,
        "recommended_actions": _build_recommendations(unique_reason_codes),
        "evidence": {
            "completion_percentage": round(completion_percentage, 2),
            "progress_state": progress_state,
            "minutes_since_last_active": minutes_since_last_active,
            "last_active_at": last_active.isoformat() if last_active is not None else None,
            "recent_error_count": len(sorted_errors),
            "repeated_error_count": repeated_count,
            "repeated_error_minutes": repeated_minutes,
            "dominant_error_categories": category_breakdown,
            "dominant_topics": topic_breakdown,
        },
    }

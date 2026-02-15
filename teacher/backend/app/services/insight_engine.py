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

INACTIVE_SENTINEL = float("inf")

SYNTAX_HINTS = {
    "syntax", "token", "parse", "parenthesis", "parentheses",
    "bracket", "indent", "semicolon", "unterminated", "unexpected",
}
LOGIC_HINTS = {
    "logic", "wrong answer", "incorrect", "off by one", "edge case",
    "condition", "branch", "fallacy", "counterexample",
}
COMPLEXITY_HINTS = {
    "complexity", "big-o", "time limit", "timeout",
    "quadratic", "cubic", "n^2", "n log n", "performance",
}
RUNTIME_HINTS = {
    "exception", "runtime", "stack overflow", "nullpointer",
    "index out of range", "division by zero", "segmentation fault",
}

CATEGORY_REASON_MAP = {
    COMPLEXITY_CATEGORY: "dominant_complexity_issue",
    LOGIC_CATEGORY: "dominant_logic_issue",
    SYNTAX_CATEGORY: "dominant_syntax_issue",
}

RECOMMENDATION_MAP = {
    "low_completion": "Schedule a short checkpoint to unblock assignment progress.",
    "inactive": "Re-engage the student with a time-bound mini task.",
    "repeated_error_pattern": "Review one worked example targeting the repeated error pattern.",
    "high_error_volume": "Reduce scope temporarily and validate understanding after each step.",
    "progress_marked_stuck": "Check in with the student directly to identify the specific blocker.",
    "dominant_complexity_issue": "Reinforce algorithmic complexity tradeoffs with simpler benchmarks.",
    "dominant_logic_issue": "Use trace tables to verify branch logic and edge cases.",
    "dominant_syntax_issue": "Assign a syntax-focused linting drill before the next attempt.",
}


@dataclass(frozen=True)
class InsightSettings:
    failing_ratio_threshold: float = 0.30
    inactivity_minutes: int = 30
    stuck_minutes: int = 20
    stuck_repeat_threshold: int = 3
    mastery_target: float = 0.70
    min_topic_events: int = 3
    low_completion_threshold: float = 70.0

    @classmethod
    def from_query_args(cls, args: Any) -> "InsightSettings":
        return cls(
            failing_ratio_threshold=_parse_ratio(args.get("failing_ratio_threshold"), 0.30),
            inactivity_minutes=_parse_pos_int(args.get("inactivity_minutes"), 30),
            stuck_minutes=_parse_pos_int(args.get("stuck_minutes"), 20),
            stuck_repeat_threshold=_parse_pos_int(args.get("stuck_repeat_threshold"), 3),
            mastery_target=_parse_ratio(args.get("mastery_target"), 0.70),
            min_topic_events=_parse_pos_int(args.get("min_topic_events"), 3),
            low_completion_threshold=_parse_pct(args.get("low_completion_threshold"), 70.0),
        )


@dataclass(frozen=True)
class InsightContext:
    enrolled_students: list[str]
    display_names: dict[str, str]
    settings: InsightSettings


@dataclass(frozen=True)
class InsightData:
    error_logs: list[dict[str, Any]]
    progress_map: dict[str, dict[str, Any]]


@dataclass(frozen=True)
class ErrorAgg:
    by_student: dict[str, list[dict[str, Any]]]
    part_to_students: dict[str, set[str]]
    part_to_cats: dict[str, Counter[str]]
    topic_to_students: dict[str, set[str]]
    topic_events: Counter[str]


@dataclass(frozen=True)
class FailureEvidence:
    completion_pct: float
    minutes_inactive: int | None
    error_count: int
    repeated_count: int
    repeated_minutes: int
    progress_state: str
    dominant_category: str | None


def _parse_ratio(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Ratio must be in (0, 1]") from exc
    if parsed <= 0 or parsed > 1:
        raise ValueError("Ratio must be in (0, 1]")
    return parsed


def _parse_pos_int(value: Any, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Expected a positive integer") from exc
    if parsed <= 0:
        raise ValueError("Expected a positive integer")
    return parsed


def _parse_pct(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Percentage must be 0-100") from exc
    if not (0 <= parsed <= 100):
        raise ValueError("Percentage must be 0-100")
    return parsed


def _norm(value: Any, default: str = UNKNOWN_BUCKET) -> str:
    if not isinstance(value, str):
        return default
    trimmed = value.strip()
    return trimmed if trimmed else default


def _has_hint(text: str, hints: set[str]) -> bool:
    return any(h in text for h in hints)


def categorize_error(
    error_message: str,
    topic: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    meta = metadata or {}
    explicit = meta.get("category")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip().lower()
    combined = error_message.strip().lower() + " " + (topic or "").strip().lower()
    return _match_category(combined)


def _match_category(text: str) -> str:
    if _has_hint(text, SYNTAX_HINTS):
        return SYNTAX_CATEGORY
    if _has_hint(text, COMPLEXITY_HINTS):
        return COMPLEXITY_CATEGORY
    if _has_hint(text, LOGIC_HINTS):
        return LOGIC_CATEGORY
    if _has_hint(text, RUNTIME_HINTS):
        return RUNTIME_CATEGORY
    return CONCEPT_CATEGORY


def _mins_since(now: datetime, ts: datetime | None) -> int | None:
    if ts is None:
        return None
    return max(0, int((now - ts).total_seconds() // 60))


def _group_key(row: dict[str, Any]) -> str:
    fp = row.get("error_fingerprint")
    if isinstance(fp, str) and fp.strip():
        return fp.strip()
    return _norm(row.get("error_category")) + ":" + _norm(row.get("assignment_part"), "unknown_part")


def _sort_desc(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    epoch = datetime.min.replace(tzinfo=timezone.utc)
    return sorted(logs, key=lambda r: parse_record_timestamp(r, "occurred_at") or epoch, reverse=True)


def _latest_error_ts(logs: list[dict[str, Any]]) -> dict[str, datetime]:
    out: dict[str, datetime] = {}
    for row in _sort_desc(logs):
        sid = row.get("student_id")
        if not sid or sid in out:
            continue
        ts = parse_record_timestamp(row, "occurred_at")
        if ts is not None:
            out[sid] = ts
    return out


def _count_matching(sorted_logs: list[dict[str, Any]], key: str) -> tuple[int, datetime | None, datetime | None]:
    count = 0
    latest: datetime | None = None
    oldest: datetime | None = None
    for row in sorted_logs:
        if _group_key(row) != key:
            break
        count += 1
        ts = parse_record_timestamp(row, "occurred_at")
        if ts is not None:
            if latest is None:
                latest = ts
            oldest = ts
    return count, oldest, latest


def _consec_error_window(logs: list[dict[str, Any]]) -> tuple[int, int]:
    if not logs:
        return 0, 0
    sl = _sort_desc(logs)
    count, oldest, latest = _count_matching(sl, _group_key(sl[0]))
    if latest is None or oldest is None:
        return count, 0
    return count, max(0, int((latest - oldest).total_seconds() // 60))


def _agg_errors(logs: list[dict[str, Any]], enrolled: set[str]) -> ErrorAgg:
    by_s: dict[str, list[dict[str, Any]]] = defaultdict(list)
    p_s: dict[str, set[str]] = defaultdict(set)
    p_c: dict[str, Counter[str]] = defaultdict(Counter)
    t_s: dict[str, set[str]] = defaultdict(set)
    t_e: Counter[str] = Counter()
    for row in logs:
        sid = row.get("student_id")
        if sid not in enrolled:
            continue
        by_s[sid].append(row)
        part = _norm(row.get("assignment_part"), "unlabeled_part")
        p_s[part].add(sid)
        p_c[part][_norm(row.get("error_category"))] += 1
        topic = _norm(row.get("topic"))
        t_s[topic].add(sid)
        t_e[topic] += 1
    return ErrorAgg(by_s, p_s, p_c, t_s, t_e)


def _empty_insights(aid: str, now: datetime) -> dict[str, Any]:
    return {
        "assignment_id": aid, "generated_at": now.isoformat(), "student_count": 0,
        "common_stumbling_blocks": [],
        "engagement_metrics": {"inactive_students": [], "stuck_students": []},
        "concept_mastery": {"mastered": [], "needs_review": [], "insufficient_data": []},
    }


def build_teacher_insights(
    assignment_id: str,
    roster: dict[str, str],
    data: InsightData,
    settings: InsightSettings,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    enrolled = sorted(roster.keys())
    if not enrolled:
        return _empty_insights(assignment_id, now)
    ctx = InsightContext(enrolled, roster, settings)
    agg = _agg_errors(data.error_logs, set(enrolled))
    n = len(enrolled)
    return {
        "assignment_id": assignment_id,
        "generated_at": now.isoformat(),
        "student_count": n,
        "common_stumbling_blocks": _stumbling_blocks(agg, n, settings),
        "engagement_metrics": _engagement(ctx, data.progress_map, agg, _latest_error_ts(data.error_logs), now),
        "concept_mastery": _concept_mastery(agg, n, settings),
    }


def _stumbling_blocks(agg: ErrorAgg, n: int, s: InsightSettings) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for part, students in agg.part_to_students.items():
        ratio = len(students) / n if n > 0 else 0.0
        if ratio <= s.failing_ratio_threshold:
            continue
        top = [c for c, _ in agg.part_to_cats[part].most_common(3)]
        blocks.append({
            "assignment_part": part, "failing_students": len(students),
            "failing_ratio": round(ratio, 4), "primary_error_categories": top,
            "student_ids": sorted(students),
        })
    blocks.sort(key=lambda r: r["failing_ratio"], reverse=True)
    return blocks


def _inactive_key(r: dict[str, Any]) -> float:
    v = r["minutes_inactive"]
    return v if v is not None else INACTIVE_SENTINEL


def _stuck_key(r: dict[str, Any]) -> tuple[int, int]:
    return (r["stuck_minutes"], r["repeated_error_count"])


def _engagement(
    ctx: InsightContext, pmap: dict[str, dict[str, Any]],
    agg: ErrorAgg, ets: dict[str, datetime], now: datetime,
) -> dict[str, list[dict[str, Any]]]:
    inactive: list[dict[str, Any]] = []
    stuck: list[dict[str, Any]] = []
    for sid in ctx.enrolled_students:
        prog = pmap.get(sid, {})
        entry = _check_inactive(sid, prog, ets, ctx, now)
        if entry:
            inactive.append(entry)
        entry = _check_stuck(sid, prog, agg.by_student, ctx)
        if entry:
            stuck.append(entry)
    return {
        "inactive_students": sorted(inactive, key=_inactive_key, reverse=True),
        "stuck_students": sorted(stuck, key=_stuck_key, reverse=True),
    }


def _check_inactive(
    sid: str, prog: dict[str, Any], ets: dict[str, datetime],
    ctx: InsightContext, now: datetime,
) -> dict[str, Any] | None:
    last = parse_record_timestamp(prog, "last_active_at") or ets.get(sid)
    mins = _mins_since(now, last)
    if mins is not None and mins < ctx.settings.inactivity_minutes:
        return None
    return {
        "student_id": sid, "display_name": ctx.display_names.get(sid, ""),
        "minutes_inactive": mins, "last_active_at": last.isoformat() if last else None,
    }


def _check_stuck(
    sid: str, prog: dict[str, Any],
    by_student: dict[str, list[dict[str, Any]]],
    ctx: InsightContext,
) -> dict[str, Any] | None:
    reps, smins = _consec_error_window(by_student.get(sid, []))
    state = _norm(prog.get("state"), "unknown")
    stuck = reps >= ctx.settings.stuck_repeat_threshold and smins >= ctx.settings.stuck_minutes
    if not stuck and state != "stuck":
        return None
    return {
        "student_id": sid, "display_name": ctx.display_names.get(sid, ""),
        "repeated_error_count": reps, "stuck_minutes": smins,
    }


def _concept_mastery(agg: ErrorAgg, n: int, s: InsightSettings) -> dict[str, list[dict[str, Any]]]:
    m: list[dict[str, Any]] = []
    nr: list[dict[str, Any]] = []
    ins: list[dict[str, Any]] = []
    for topic, students in agg.topic_to_students.items():
        if topic == UNKNOWN_BUCKET:
            continue
        entry = _mastery_entry(topic, students, n, agg)
        _classify_mastery(entry, s, m, nr, ins)
    m.sort(key=lambda r: r["mastery_score"], reverse=True)
    nr.sort(key=lambda r: r["error_rate"], reverse=True)
    ins.sort(key=lambda r: r["error_event_count"], reverse=True)
    return {"mastered": m, "needs_review": nr, "insufficient_data": ins}


def _mastery_entry(topic: str, students: set[str], n: int, agg: ErrorAgg) -> dict[str, Any]:
    rate = len(students) / n if n > 0 else 0.0
    return {
        "topic": topic, "error_event_count": int(agg.topic_events[topic]),
        "error_student_count": len(students), "error_rate": round(rate, 4),
        "mastery_score": round(max(0.0, 1.0 - rate), 4),
    }


def _classify_mastery(e: dict[str, Any], s: InsightSettings, m: list[dict], nr: list[dict], ins: list[dict]) -> None:
    if e["error_event_count"] < s.min_topic_events:
        ins.append(e)
    elif e["mastery_score"] >= s.mastery_target:
        m.append(e)
    else:
        nr.append(e)


def _dom_categories(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    c = Counter(_norm(r.get("error_category")) for r in logs)
    t = sum(c.values())
    if t == 0:
        return []
    return [{"category": k, "count": v, "share": round(v / t, 4)} for k, v in c.most_common(3)]


def _dom_topics(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    c = Counter(_norm(r.get("topic")) for r in logs if _norm(r.get("topic")) != UNKNOWN_BUCKET)
    t = sum(c.values())
    if t == 0:
        return []
    return [{"topic": k, "count": v, "share": round(v / t, 4)} for k, v in c.most_common(3)]


def _recommendations(codes: list[str]) -> list[str]:
    return [RECOMMENDATION_MAP[c] for c in codes if c in RECOMMENDATION_MAP]


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _last_active(prog: dict[str, Any], errs: list[dict[str, Any]]) -> datetime | None:
    la = parse_record_timestamp(prog, "last_active_at")
    if la is None and errs:
        la = parse_record_timestamp(errs[0], "occurred_at")
    return la


def _failure_evidence(errs: list[dict[str, Any]], prog: dict[str, Any], now: datetime) -> FailureEvidence:
    la = _last_active(prog, errs)
    reps, rmins = _consec_error_window(errs)
    cats = _dom_categories(errs)
    return FailureEvidence(
        completion_pct=_safe_float(prog.get("completion_percentage")),
        minutes_inactive=_mins_since(now, la),
        error_count=len(errs), repeated_count=reps, repeated_minutes=rmins,
        progress_state=_norm(prog.get("state"), "not_started"),
        dominant_category=cats[0]["category"] if cats else None,
    )


@dataclass(frozen=True)
class FailureSummaryInput:
    assignment_id: str
    student_id: str
    display_name: str


def build_student_failure_summary(
    who: FailureSummaryInput,
    error_logs: list[dict[str, Any]],
    latest_progress: dict[str, Any] | None,
    settings: InsightSettings,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    errs = _sort_desc(error_logs)
    prog = latest_progress or {}
    ev = _failure_evidence(errs, prog, now)
    reasons = list(dict.fromkeys(_failure_reasons(ev, settings)))
    la = _last_active(prog, errs)
    return _fmt_summary(who, now, reasons, ev, errs, la)


def _fmt_summary(
    who: FailureSummaryInput, now: datetime,
    reasons: list[str], ev: FailureEvidence,
    errs: list[dict[str, Any]], la: datetime | None,
) -> dict[str, Any]:
    return {
        "assignment_id": who.assignment_id, "student_id": who.student_id,
        "display_name": who.display_name,
        "generated_at": now.isoformat(), "is_failing": bool(reasons),
        "failure_reasons": reasons, "recommended_actions": _recommendations(reasons),
        "evidence": {
            "completion_percentage": round(ev.completion_pct, 2),
            "progress_state": ev.progress_state,
            "minutes_since_last_active": ev.minutes_inactive,
            "last_active_at": la.isoformat() if la else None,
            "recent_error_count": ev.error_count,
            "repeated_error_count": ev.repeated_count,
            "repeated_error_minutes": ev.repeated_minutes,
            "dominant_error_categories": _dom_categories(errs),
            "dominant_topics": _dom_topics(errs),
        },
    }


def _failure_reasons(ev: FailureEvidence, s: InsightSettings) -> list[str]:
    r: list[str] = []
    if ev.completion_pct < s.low_completion_threshold:
        r.append("low_completion")
    if ev.minutes_inactive is None or ev.minutes_inactive >= s.inactivity_minutes:
        r.append("inactive")
    if ev.error_count >= 3:
        r.append("high_error_volume")
    if ev.repeated_count >= s.stuck_repeat_threshold and ev.repeated_minutes >= s.stuck_minutes:
        r.append("repeated_error_pattern")
    if ev.progress_state == "stuck":
        r.append("progress_marked_stuck")
    if ev.dominant_category in CATEGORY_REASON_MAP:
        r.append(CATEGORY_REASON_MAP[ev.dominant_category])
    return r

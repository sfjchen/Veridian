"""FAQ aggregation and mistake analytics for teacher insights.

Computes analytics from chat_messages and problem_results tables.
No LLM calls — keyword matching for topic extraction, pure aggregation
for mistake heatmaps.
"""

import logging
from collections import Counter, defaultdict
from typing import Any

log = logging.getLogger(__name__)

ALL_TAGS = [
    "wrong-theorem", "misunderstood-definition", "domain-error",
    "incorrect-assumption", "flawed-logic",
    "wrong-method", "skipped-step", "incorrect-application", "order-of-operations",
    "sign-error", "arithmetic-error", "algebra-error", "lost-term",
    "ambiguous-notation", "missing-quantifier", "inconsistent-variables",
]
_ALL_TAGS_SET = frozenset(ALL_TAGS)

TAG_TO_SEVERITY: dict[str, str] = {
    "wrong-theorem": "conceptual", "misunderstood-definition": "conceptual",
    "domain-error": "conceptual", "incorrect-assumption": "conceptual",
    "flawed-logic": "conceptual",
    "wrong-method": "procedural", "skipped-step": "procedural",
    "incorrect-application": "procedural", "order-of-operations": "procedural",
    "sign-error": "mechanical", "arithmetic-error": "mechanical",
    "algebra-error": "mechanical", "lost-term": "mechanical",
    "ambiguous-notation": "notational", "missing-quantifier": "notational",
    "inconsistent-variables": "notational",
}

MATH_TOPIC_KEYWORDS: dict[str, list[str]] = {
    "algebra": ["algebra", "algebraic", "variable", "equation", "expression", "polynomial", "factor", "quadratic"],
    "arithmetic": ["arithmetic", "addition", "subtraction", "multiplication", "division", "remainder"],
    "fractions": ["fraction", "numerator", "denominator", "mixed number", "improper fraction"],
    "decimals": ["decimal", "decimal point"],
    "percentages": ["percent", "percentage"],
    "ratios": ["ratio", "proportion", "unit rate"],
    "geometry": ["geometry", "angle", "triangle", "circle", "rectangle", "area", "perimeter", "volume"],
    "trigonometry": ["trigonometry", "sine", "cosine", "tangent"],
    "calculus": ["calculus", "derivative", "integral", "differentiation", "integration"],
    "statistics": ["statistics", "mean", "median", "mode", "standard deviation", "probability"],
    "exponents": ["exponent", "power", "square root", "cube root", "radical"],
    "logarithms": ["logarithm", "natural log"],
    "inequalities": ["inequality"],
    "absolute-value": ["absolute value"],
    "functions": ["function", "domain", "range", "inverse", "composition"],
    "graphing": ["graph", "coordinate", "slope", "intercept"],
    "linear-equations": ["linear", "y-intercept", "point-slope"],
    "systems-of-equations": ["system of equations", "substitution", "elimination"],
    "matrices": ["matrix", "matrices", "determinant"],
    "sequences": ["sequence", "series", "arithmetic sequence", "geometric sequence"],
    "combinatorics": ["permutation", "combination", "factorial"],
    "number-theory": ["prime", "divisibility", "gcd", "lcm"],
}

# Multi-word keywords need substring matching — separate them out.
_MULTIWORD_KEYWORDS: list[tuple[str, str]] = [
    (kw.lower(), topic)
    for topic, keywords in MATH_TOPIC_KEYWORDS.items()
    for kw in keywords if " " in kw
]
_SINGLE_WORDS: dict[str, str] = {
    kw.lower(): topic
    for topic, keywords in MATH_TOPIC_KEYWORDS.items()
    for kw in keywords if " " not in kw
}


def _strip_suffix(word: str) -> str:
    """Strip common English suffixes for basic stemming."""
    for suffix in ("ing", "tion", "sion", "ment", "ness", "ies", "es", "ed", "ly", "s"):
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def extract_topics(content: str) -> list[str]:
    """Extract up to 3 math topics from a message via keyword matching."""
    lower = content.lower()
    matched: set[str] = set()
    for phrase, topic in _MULTIWORD_KEYWORDS:
        if len(matched) >= 3:
            break
        if phrase in lower:
            matched.add(topic)
    if len(matched) < 3:
        words = lower.split()
        for word in words:
            if len(matched) >= 3:
                break
            cleaned = word.strip(".,!?;:'\"()[]{}").rstrip("s")
            topic = _SINGLE_WORDS.get(word) or _SINGLE_WORDS.get(cleaned)
            if not topic:
                stemmed = _strip_suffix(word.strip(".,!?;:'\"()[]{}"))
                topic = _SINGLE_WORDS.get(stemmed)
            if topic:
                matched.add(topic)
    return list(matched)[:3]


def _get_classroom_assignment_ids(client: Any, classroom_id: str) -> list[str]:
    resp = client.table("assignments").select("id").eq("classroom_id", classroom_id).execute()
    return [r["id"] for r in (resp.data or [])]


def fetch_classroom_chat_messages(client: Any, classroom_id: str) -> list[dict[str, Any]]:
    """Get student-role chat messages for all assignments in a classroom."""
    assignment_ids = _get_classroom_assignment_ids(client, classroom_id)
    if not assignment_ids:
        return []
    resp = (
        client.table("chat_messages")
        .select("student_id,content,created_at")
        .eq("role", "student")
        .in_("assignment_id", assignment_ids)
        .execute()
    )
    return resp.data or []


def _build_topic_groups(messages: list[dict[str, Any]]) -> tuple[dict[str, set[str]], dict[str, list[str]]]:
    topic_students: dict[str, set[str]] = defaultdict(set)
    topic_messages: dict[str, list[str]] = defaultdict(list)
    for msg in messages:
        content = msg.get("content", "")
        sid = msg.get("student_id", "")
        for topic in extract_topics(content):
            topic_students[topic].add(sid)
            topic_messages[topic].append(content)
    return topic_students, topic_messages


def aggregate_faq(messages: list[dict[str, Any]], student_count: int) -> list[dict[str, Any]]:
    """Group messages by topic, count unique students, normalize by class size."""
    topic_students, topic_messages = _build_topic_groups(messages)
    divisor = max(student_count, 1)
    result = [
        {
            "topic": topic,
            "message_count": len(topic_messages[topic]),
            "unique_students": len(sids),
            "student_percentage": round(len(sids) / divisor * 100, 1),
            "sample_questions": topic_messages[topic][:3],
        }
        for topic, sids in topic_students.items()
    ]
    result.sort(key=lambda x: x["student_percentage"], reverse=True)
    return result


def get_student_count(client: Any, classroom_id: str) -> int:
    resp = (
        client.table("classroom_memberships")
        .select("student_id", count="exact")
        .eq("classroom_id", classroom_id)
        .execute()
    )
    return resp.count or 0


def fetch_classroom_results(client: Any, classroom_id: str) -> list[dict[str, Any]]:
    """Get all problem_results for assignments in a classroom."""
    assignment_ids = _get_classroom_assignment_ids(client, classroom_id)
    if not assignment_ids:
        return []
    resp = (
        client.table("problem_results")
        .select("student_id,assignment_id,problem_num,mistakes,mistake_count,created_at")
        .in_("assignment_id", assignment_ids)
        .execute()
    )
    return resp.data or []


def _count_tags_in_results(results: list[dict[str, Any]]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for row in results:
        for m in (row.get("mistakes") or []):
            tag = m.get("tag") if isinstance(m, dict) else None
            if tag and tag in _ALL_TAGS_SET:
                counts[tag] += 1
    return counts


def _format_student_row(sid: str, counts: Counter[str], names: dict[str, str]) -> dict[str, Any]:
    return {
        "student_id": sid,
        "display_name": names.get(sid, ""),
        "tag_counts": dict(counts),
        "total": sum(counts.values()),
    }


def build_mistake_heatmap(results: list[dict[str, Any]], student_names: dict[str, str]) -> dict[str, Any]:
    """Build a heatmap of mistake tags per student."""
    per_student: dict[str, Counter[str]] = defaultdict(Counter)
    tag_totals: Counter[str] = Counter()
    for row in results:
        sid = row.get("student_id", "")
        for m in (row.get("mistakes") or []):
            tag = m.get("tag") if isinstance(m, dict) else None
            if tag and tag in _ALL_TAGS_SET:
                per_student[sid][tag] += 1
                tag_totals[tag] += 1
    students = [
        _format_student_row(sid, counts, student_names)
        for sid, counts in sorted(per_student.items(), key=lambda x: sum(x[1].values()), reverse=True)
    ]
    return {"tags": ALL_TAGS, "students": students, "tag_totals": dict(tag_totals)}


def _fetch_display_name(client: Any, student_id: str) -> str:
    resp = client.table("profiles").select("display_name").eq("id", student_id).limit(1).execute()
    rows = resp.data or []
    if not rows:
        log.warning("No profile found for student %s", student_id)
        return ""
    return rows[0].get("display_name", "")


def _group_by_assignment(results: list[dict[str, Any]]) -> tuple[Counter[str], dict[str, list[dict[str, Any]]]]:
    tag_counts: Counter[str] = Counter()
    by_assignment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in results:
        aid = row.get("assignment_id", "")
        for m in (row.get("mistakes") or []):
            tag = m.get("tag") if isinstance(m, dict) else None
            if tag:
                tag_counts[tag] += 1
        by_assignment[aid].append(row)
    return tag_counts, by_assignment


def _fetch_assignment_info(client: Any, aids: list[str]) -> dict[str, dict[str, Any]]:
    if not aids:
        return {}
    resp = client.table("assignments").select("id,title,created_at").in_("id", aids).execute()
    return {r["id"]: r for r in (resp.data or [])}


def _build_temporal_entry(aid: str, rows: list[dict[str, Any]], info: dict[str, Any]) -> dict[str, Any]:
    tag_counts = _count_tags_in_results(rows)
    return {
        "assignment_id": aid,
        "assignment_title": info.get("title", ""),
        "date": info.get("created_at", ""),
        "mistake_count": sum(tag_counts.values()),
        "tags": dict(tag_counts),
    }


def _build_temporal(client: Any, by_assignment: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    if not by_assignment:
        return []
    assignment_info = _fetch_assignment_info(client, list(by_assignment.keys()))
    temporal = [
        _build_temporal_entry(aid, rows, assignment_info.get(aid, {}))
        for aid, rows in by_assignment.items()
    ]
    temporal.sort(key=lambda x: x["date"], reverse=True)
    return temporal


def build_student_profile(client: Any, student_id: str, classroom_id: str) -> dict[str, Any]:
    """Build a single student's mistake profile with temporal breakdown."""
    results = fetch_classroom_results(client, classroom_id)
    student_results = [r for r in results if r.get("student_id") == student_id]
    tag_counts, by_assignment = _group_by_assignment(student_results)
    top_tags = [
        {"tag": t, "count": c, "severity": TAG_TO_SEVERITY.get(t, "")}
        for t, c in tag_counts.most_common(10)
    ]
    total = sum(tag_counts.values())
    attempted = len(student_results)
    return {
        "student_id": student_id,
        "display_name": _fetch_display_name(client, student_id),
        "total_mistakes": total,
        "problems_attempted": attempted,
        "mistake_rate": round(total / attempted, 2) if attempted else 0.0,
        "severity_distribution": _severity_distribution(tag_counts),
        "top_tags": top_tags,
        "temporal": _build_temporal(client, by_assignment),
    }


def _severity_distribution(tag_counts: Counter[str]) -> dict[str, int]:
    dist: dict[str, int] = {"conceptual": 0, "procedural": 0, "mechanical": 0, "notational": 0}
    for tag, count in tag_counts.items():
        sev = TAG_TO_SEVERITY.get(tag, "")
        if sev in dist:
            dist[sev] += count
    return dist


def build_classroom_overview(results: list[dict[str, Any]], student_count: int) -> dict[str, Any]:
    """Build summary stats for a classroom."""
    unique_students = {r.get("student_id") for r in results if r.get("student_id")}
    tag_counts = _count_tags_in_results(results)
    total = sum(tag_counts.values())
    top_tag = tag_counts.most_common(1)[0] if tag_counts else None
    return {
        "student_count": student_count,
        "active_students": len(unique_students),
        "total_problems": len(results),
        "total_mistakes": total,
        "avg_mistakes_per_student": round(total / len(unique_students), 1) if unique_students else 0.0,
        "avg_mistakes_per_problem": round(total / len(results), 2) if results else 0.0,
        "most_common_tag": top_tag[0] if top_tag else None,
        "most_common_tag_count": top_tag[1] if top_tag else 0,
        "severity_distribution": _severity_distribution(tag_counts),
    }


def build_classroom_trends(client: Any, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build per-assignment mistake trends for the whole classroom."""
    by_assignment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in results:
        aid = row.get("assignment_id", "")
        by_assignment[aid].append(row)
    if not by_assignment:
        return []
    assignment_info = _fetch_assignment_info(client, list(by_assignment.keys()))
    trends = []
    for aid, rows in by_assignment.items():
        info = assignment_info.get(aid, {})
        tag_counts = _count_tags_in_results(rows)
        students = {r.get("student_id") for r in rows if r.get("student_id")}
        trends.append({
            "assignment_id": aid,
            "assignment_title": info.get("title", ""),
            "date": info.get("created_at", ""),
            "student_count": len(students),
            "problem_count": len(rows),
            "total_mistakes": sum(tag_counts.values()),
            "severity_distribution": _severity_distribution(tag_counts),
        })
    trends.sort(key=lambda x: x["date"], reverse=True)
    return trends

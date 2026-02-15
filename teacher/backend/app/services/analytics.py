"""FAQ aggregation and mistake analytics for teacher insights.

Computes analytics from chat_messages and problem_results tables.
No LLM calls — keyword matching for topic extraction, pure aggregation
for mistake heatmaps.
"""

import re
from collections import Counter, defaultdict
from typing import Any

ALL_TAGS = [
    "wrong-theorem", "misunderstood-definition", "domain-error",
    "incorrect-assumption", "flawed-logic",
    "wrong-method", "skipped-step", "incorrect-application", "order-of-operations",
    "sign-error", "arithmetic-error", "algebra-error", "lost-term",
    "ambiguous-notation", "missing-quantifier", "inconsistent-variables",
]

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
    "decimals": ["decimal", "decimal point", "tenths", "hundredths"],
    "percentages": ["percent", "percentage", "percent change"],
    "ratios": ["ratio", "proportion", "rate", "unit rate"],
    "geometry": ["geometry", "angle", "triangle", "circle", "rectangle", "area", "perimeter", "volume"],
    "trigonometry": ["trigonometry", "sine", "cosine", "tangent", "sin", "cos", "tan"],
    "calculus": ["calculus", "derivative", "integral", "limit", "differentiation", "integration"],
    "statistics": ["statistics", "mean", "median", "mode", "standard deviation", "probability"],
    "exponents": ["exponent", "power", "square root", "cube root", "radical"],
    "logarithms": ["logarithm", "log", "ln", "natural log"],
    "inequalities": ["inequality", "greater than", "less than"],
    "absolute-value": ["absolute value"],
    "functions": ["function", "domain", "range", "inverse", "composition"],
    "graphing": ["graph", "plot", "coordinate", "x-axis", "y-axis", "slope", "intercept"],
    "linear-equations": ["linear", "slope", "y-intercept", "point-slope"],
    "systems-of-equations": ["system of equations", "substitution", "elimination"],
    "matrices": ["matrix", "matrices", "determinant"],
    "sequences": ["sequence", "series", "arithmetic sequence", "geometric sequence"],
    "combinatorics": ["permutation", "combination", "factorial"],
    "number-theory": ["prime", "factor", "multiple", "divisibility", "gcd", "lcm"],
    "sign-error": ["sign error", "sign mistake", "negative sign", "positive sign", "sign"],
    "arithmetic-error": ["arithmetic error", "calculation mistake", "computation error"],
    "algebra-error": ["algebra error", "simplification error"],
    "lost-term": ["lost term", "dropped term", "missing term"],
    "wrong-theorem": ["wrong theorem", "incorrect theorem"],
    "misunderstood-definition": ["misunderstood", "definition"],
    "domain-error": ["domain error", "undefined", "division by zero"],
    "incorrect-assumption": ["incorrect assumption", "wrong assumption"],
    "flawed-logic": ["flawed logic", "logical error", "invalid reasoning"],
    "wrong-method": ["wrong method", "incorrect method", "wrong approach"],
    "skipped-step": ["skipped step", "missing step"],
    "incorrect-application": ["incorrect application", "misapplied"],
    "order-of-operations": ["order of operations", "pemdas", "bodmas"],
    "ambiguous-notation": ["ambiguous notation", "unclear notation"],
    "missing-quantifier": ["missing quantifier", "quantifier"],
    "inconsistent-variables": ["inconsistent variable", "variable mismatch"],
}

_KEYWORD_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (topic, re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE))
    for topic, keywords in MATH_TOPIC_KEYWORDS.items()
    for kw in keywords
]


def extract_topics(content: str) -> list[str]:
    """Extract up to 3 math topics from a message via keyword matching."""
    matched: set[str] = set()
    for topic, pattern in _KEYWORD_PATTERNS:
        if len(matched) >= 3:
            break
        if pattern.search(content):
            matched.add(topic)
    return list(matched)[:3]


def fetch_classroom_chat_messages(client: Any, classroom_id: str) -> list[dict[str, Any]]:
    """Get student-role chat messages for all assignments in a classroom."""
    aids_resp = client.table("assignments").select("id").eq("classroom_id", classroom_id).execute()
    assignment_ids = [r["id"] for r in (aids_resp.data or [])]
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


def aggregate_faq(messages: list[dict[str, Any]], student_count: int) -> list[dict[str, Any]]:
    """Group messages by topic, count unique students, normalize by class size."""
    topic_students: dict[str, set[str]] = defaultdict(set)
    topic_messages: dict[str, list[str]] = defaultdict(list)
    for msg in messages:
        topics = extract_topics(msg.get("content", ""))
        sid = msg.get("student_id", "")
        content = msg.get("content", "")
        for topic in topics:
            topic_students[topic].add(sid)
            topic_messages[topic].append(content)
    divisor = max(student_count, 1)
    result = []
    for topic, sids in topic_students.items():
        samples = topic_messages[topic][:3]
        result.append({
            "topic": topic,
            "message_count": len(topic_messages[topic]),
            "unique_students": len(sids),
            "student_percentage": round(len(sids) / divisor * 100, 1),
            "sample_questions": samples,
        })
    result.sort(key=lambda x: x["student_percentage"], reverse=True)
    return result


def get_student_count(client: Any, classroom_id: str) -> int:
    resp = client.table("classroom_memberships").select("student_id", count="exact").eq("classroom_id", classroom_id).execute()
    return resp.count or 0


def fetch_classroom_results(client: Any, classroom_id: str) -> list[dict[str, Any]]:
    """Get all problem_results for assignments in a classroom."""
    aids_resp = client.table("assignments").select("id").eq("classroom_id", classroom_id).execute()
    assignment_ids = [r["id"] for r in (aids_resp.data or [])]
    if not assignment_ids:
        return []
    resp = (
        client.table("problem_results")
        .select("student_id,assignment_id,problem_num,mistakes,mistake_count,created_at")
        .in_("assignment_id", assignment_ids)
        .execute()
    )
    return resp.data or []


def build_mistake_heatmap(results: list[dict[str, Any]], student_names: dict[str, str]) -> dict[str, Any]:
    """Build a heatmap of mistake tags per student."""
    per_student: dict[str, Counter[str]] = defaultdict(Counter)
    tag_totals: Counter[str] = Counter()
    for row in results:
        sid = row.get("student_id", "")
        mistakes = row.get("mistakes") or []
        for m in mistakes:
            tag = m.get("tag") if isinstance(m, dict) else None
            if tag and tag in ALL_TAGS:
                per_student[sid][tag] += 1
                tag_totals[tag] += 1
    students = []
    for sid, counts in sorted(per_student.items(), key=lambda x: sum(x[1].values()), reverse=True):
        students.append({
            "student_id": sid,
            "display_name": student_names.get(sid, ""),
            "tag_counts": dict(counts),
            "total": sum(counts.values()),
        })
    return {"tags": ALL_TAGS, "students": students, "tag_totals": dict(tag_totals)}


def build_student_profile(client: Any, student_id: str, classroom_id: str) -> dict[str, Any]:
    """Build a single student's mistake profile with temporal breakdown."""
    results = fetch_classroom_results(client, classroom_id)
    student_results = [r for r in results if r.get("student_id") == student_id]
    return _compile_profile(client, student_id, classroom_id, student_results, ALL_TAGS, TAG_TO_SEVERITY)


def _compile_profile(
    client: Any, student_id: str, classroom_id: str,
    results: list[dict[str, Any]], all_tags: list[str], tag_severity: dict[str, str],
) -> dict[str, Any]:
    tag_counts: Counter[str] = Counter()
    by_assignment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in results:
        mistakes = row.get("mistakes") or []
        aid = row.get("assignment_id", "")
        for m in mistakes:
            tag = m.get("tag") if isinstance(m, dict) else None
            if tag:
                tag_counts[tag] += 1
        by_assignment[aid].append(row)
    names = _fetch_display_name(client, student_id)
    top_tags = [
        {"tag": t, "count": c, "severity": tag_severity.get(t, "")}
        for t, c in tag_counts.most_common(10)
    ]
    temporal = _build_temporal(client, by_assignment)
    return {
        "student_id": student_id,
        "display_name": names,
        "total_mistakes": sum(tag_counts.values()),
        "problems_attempted": len(results),
        "top_tags": top_tags,
        "temporal": temporal,
    }


def _fetch_display_name(client: Any, student_id: str) -> str:
    resp = client.table("profiles").select("display_name").eq("id", student_id).limit(1).execute()
    rows = resp.data or []
    return rows[0].get("display_name", "") if rows else ""


def _build_temporal(client: Any, by_assignment: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    if not by_assignment:
        return []
    aids = list(by_assignment.keys())
    resp = client.table("assignments").select("id,title,created_at").in_("id", aids).execute()
    assignment_info = {r["id"]: r for r in (resp.data or [])}
    temporal = []
    for aid, rows in by_assignment.items():
        info = assignment_info.get(aid, {})
        tag_counts: Counter[str] = Counter()
        for row in rows:
            for m in (row.get("mistakes") or []):
                tag = m.get("tag") if isinstance(m, dict) else None
                if tag:
                    tag_counts[tag] += 1
        temporal.append({
            "assignment_id": aid,
            "assignment_title": info.get("title", ""),
            "date": info.get("created_at", ""),
            "mistake_count": sum(tag_counts.values()),
            "tags": dict(tag_counts),
        })
    temporal.sort(key=lambda x: x["date"])
    return temporal

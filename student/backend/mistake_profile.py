import logging
from collections import Counter
from typing import Any, Dict, List, Optional

from supabase_service import get_supabase_service_client, unwrap_supabase_data

log = logging.getLogger(__name__)

RESULTS_TABLE = "problem_results"
ASSIGNMENTS_TABLE = "assignments"


def _get_classroom_id(assignment_id: str) -> Optional[str]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table(ASSIGNMENTS_TABLE)
        .select("classroom_id")
        .eq("id", assignment_id)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if not isinstance(rows, list) or not rows:
        return None
    return rows[0].get("classroom_id")


def _get_classroom_assignment_ids(classroom_id: str) -> List[str]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table(ASSIGNMENTS_TABLE)
        .select("id")
        .eq("classroom_id", classroom_id)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if not isinstance(rows, list):
        return []
    return [r["id"] for r in rows if isinstance(r, dict) and r.get("id")]


def _get_student_results(student_id: str, assignment_ids: List[str]) -> List[Dict[str, Any]]:
    if not assignment_ids:
        return []
    supabase = get_supabase_service_client()
    response = (
        supabase.table(RESULTS_TABLE)
        .select("mistakes")
        .eq("student_id", student_id)
        .in_("assignment_id", assignment_ids)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return rows if isinstance(rows, list) else []


def _count_mistake_tags(results: List[Dict[str, Any]]) -> Counter:
    counts: Counter = Counter()
    for row in results:
        mistakes = row.get("mistakes")
        if not isinstance(mistakes, list):
            continue
        for m in mistakes:
            tag = m.get("tag") if isinstance(m, dict) else None
            if tag:
                counts[tag] += 1
    return counts


def _format_summary(counts: Counter) -> str:
    if not counts:
        return ""
    ranked = counts.most_common(10)
    tags_str = ", ".join(f"{tag} ({n}x)" for tag, n in ranked)
    return (
        f"Student's common mistakes across this classroom: {tags_str}. "
        "Use this pattern to guide hints toward areas where the student struggles most."
    )


def build_chat_mistake_context(student_id: str, assignment_id: str) -> str:
    classroom_id = _get_classroom_id(assignment_id)
    if not classroom_id:
        return ""
    assignment_ids = _get_classroom_assignment_ids(classroom_id)
    results = _get_student_results(student_id, assignment_ids)
    counts = _count_mistake_tags(results)
    return _format_summary(counts)

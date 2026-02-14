from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase_service import get_supabase_service_client, unwrap_supabase_data

RESULTS_TABLE = "problem_results"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# NOTE: 4 params here exceeds the 3-param convention. Kept as-is for
# backward-compatibility with get_coords.py callers; will consolidate into
# a ResultKey TypedDict once the get_coords.py refactor completes.
def upsert_result(student_id: str, assignment_id: str, problem_num: int, result: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase_service_client()
    payload = {
        "student_id": student_id,
        "assignment_id": assignment_id,
        "problem_num": problem_num,
        "student_tex": result.get("student_tex", ""),
        "annotated_tex": result.get("annotated_tex", ""),
        "continuation_tex": result.get("continuation_tex", ""),
        "mistake_count": result.get("mistake_count", 0),
        "mistakes": result.get("mistakes", []),
        "status": "complete",
        "error_message": None,
        "updated_at": _now_iso(),
    }
    response = (
        supabase.table(RESULTS_TABLE)
        .upsert(payload, on_conflict="student_id,assignment_id,problem_num")
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return rows[0] if isinstance(rows, list) and rows else payload


def set_result_status(
    student_id: str, assignment_id: str, problem_num: int, status: str, error_message: str | None = None,
) -> None:
    supabase = get_supabase_service_client()
    update: Dict[str, Any] = {"status": status, "updated_at": _now_iso()}
    if status == "error":
        update["error_message"] = error_message or "Analysis failed"
    (
        supabase.table(RESULTS_TABLE)
        .upsert(
            {"student_id": student_id, "assignment_id": assignment_id, "problem_num": problem_num, **update},
            on_conflict="student_id,assignment_id,problem_num",
        )
        .execute()
    )


def get_result(student_id: str, assignment_id: str, problem_num: int) -> Optional[Dict[str, Any]]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table(RESULTS_TABLE)
        .select("*")
        .eq("student_id", student_id)
        .eq("assignment_id", assignment_id)
        .eq("problem_num", problem_num)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return rows[0] if isinstance(rows, list) and rows else None


def get_assignment_results(student_id: str, assignment_id: str) -> List[Dict[str, Any]]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table(RESULTS_TABLE)
        .select("*")
        .eq("student_id", student_id)
        .eq("assignment_id", assignment_id)
        .order("problem_num")
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return rows if isinstance(rows, list) else []

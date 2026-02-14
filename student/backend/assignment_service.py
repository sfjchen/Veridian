from typing import Any, Dict, List, Optional

from config_schema import resolve_config, validate_config
from supabase_service import get_supabase_service_client, unwrap_supabase_data

ASSIGNMENTS_TABLE = "assignments"


def get_assignment(assignment_id: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table(ASSIGNMENTS_TABLE)
        .select("*")
        .eq("id", assignment_id)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return rows[0] if isinstance(rows, list) and rows else None


def get_problems(assignment_id: str) -> List[Dict[str, Any]]:
    assignment = get_assignment(assignment_id)
    if not assignment:
        raise ValueError(f"Assignment not found: {assignment_id}")
    problems = assignment.get("problems", [])
    if not isinstance(problems, list):
        return []
    return problems


def get_problem(assignment_id: str, problem_num: int) -> Dict[str, Any]:
    problems = get_problems(assignment_id)
    for p in problems:
        if isinstance(p, dict) and p.get("num") == problem_num:
            return p
    raise ValueError(f"Problem {problem_num} not found in assignment {assignment_id}")


def _fetch_classroom_config(classroom_id: str) -> Dict[str, Any]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table("classrooms")
        .select("config")
        .eq("id", classroom_id)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if not isinstance(rows, list) or not rows:
        return {}
    return rows[0].get("config") or {}


def get_resolved_config(assignment_id: str) -> Dict[str, Any]:
    assignment = get_assignment(assignment_id)
    if not assignment:
        raise ValueError(f"Assignment not found: {assignment_id}")
    classroom_id = assignment.get("classroom_id")
    classroom_config = _fetch_classroom_config(classroom_id) if classroom_id else {}
    assignment_config = assignment.get("config") or {}
    return validate_config(resolve_config(classroom_config, assignment_config))

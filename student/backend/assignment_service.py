from typing import Any, Dict, List, Optional

from config_schema import resolve_config, validate_config
from supabase_service import get_supabase_service_client, unwrap_supabase_data

ASSIGNMENTS_TABLE = "assignments"
MEMBERSHIPS_TABLE = "classroom_memberships"


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
    config = rows[0].get("config")
    return config if isinstance(config, dict) else {}


def _is_classroom_member(classroom_id: str, student_id: str) -> bool:
    supabase = get_supabase_service_client()
    response = (
        supabase.table(MEMBERSHIPS_TABLE)
        .select("classroom_id")
        .eq("classroom_id", classroom_id)
        .eq("student_id", student_id)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return isinstance(rows, list) and len(rows) > 0


def _is_classroom_teacher(classroom_id: str, user_id: str) -> bool:
    supabase = get_supabase_service_client()
    response = (
        supabase.table("classrooms")
        .select("id")
        .eq("id", classroom_id)
        .eq("teacher_id", user_id)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return isinstance(rows, list) and len(rows) > 0


def can_student_access_assignment(
    assignment_id: str, user_id: str, user_role: str = "student",
    assignment: Optional[Dict[str, Any]] = None,
) -> bool:
    if assignment is None:
        assignment = get_assignment(assignment_id)
    if not assignment:
        return False
    classroom_id = assignment.get("classroom_id")
    if not isinstance(classroom_id, str) or not classroom_id:
        return False
    if user_role == "teacher":
        return _is_classroom_teacher(classroom_id, user_id)
    return _is_classroom_member(classroom_id, user_id)


def get_resolved_config(
    assignment_id: str, assignment: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if assignment is None:
        assignment = get_assignment(assignment_id)
    if not assignment:
        raise ValueError(f"Assignment not found: {assignment_id}")
    classroom_id = assignment.get("classroom_id")
    classroom_config = _fetch_classroom_config(classroom_id) if classroom_id else {}
    assignment_config = assignment.get("config") or {}
    if not isinstance(assignment_config, dict):
        assignment_config = {}
    return validate_config(resolve_config(classroom_config, assignment_config))

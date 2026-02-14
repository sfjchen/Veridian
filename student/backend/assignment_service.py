from typing import Any, Dict, List, Optional

from supabase_service import get_supabase_service_client, unwrap_supabase_data

ASSIGNMENTS_TABLE = "assignments"

DEFAULT_HINT_LEVEL = "guided"
DEFAULT_REVEAL_MODE = "single-tap"
DEFAULT_AUTO_ANALYZE = True
DEFAULT_ANALYSIS_DEBOUNCE_SECONDS = 15
DEFAULT_NOTIFICATION_LEVEL = "nudge"
DEFAULT_CHAT_ENABLED = False


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


def get_assignment_settings(assignment_id: str) -> Dict[str, Any]:
    assignment = get_assignment(assignment_id)
    if not assignment:
        raise ValueError(f"Assignment not found: {assignment_id}")
    return {
        "hint_level": assignment.get("hint_level", DEFAULT_HINT_LEVEL),
        "reveal_mode": assignment.get("reveal_mode", DEFAULT_REVEAL_MODE),
        "auto_analyze": assignment.get("auto_analyze", DEFAULT_AUTO_ANALYZE),
        "analysis_debounce_seconds": assignment.get("analysis_debounce_seconds", DEFAULT_ANALYSIS_DEBOUNCE_SECONDS),
        "notification_level": assignment.get("notification_level", DEFAULT_NOTIFICATION_LEVEL),
        "chat_enabled": assignment.get("chat_enabled", DEFAULT_CHAT_ENABLED),
    }

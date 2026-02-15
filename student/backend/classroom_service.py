import logging
from typing import Any, Dict, List

from postgrest.exceptions import APIError
from supabase_service import get_supabase_service_client, unwrap_supabase_data

log = logging.getLogger(__name__)

MEMBERSHIPS_TABLE = "classroom_memberships"
CLASSROOMS_TABLE = "classrooms"
ASSIGNMENTS_TABLE = "assignments"


def list_classrooms_for_student(student_id: str) -> List[Dict[str, Any]]:
    supabase = get_supabase_service_client()
    memberships = (
        supabase.table(MEMBERSHIPS_TABLE)
        .select("classroom_id")
        .eq("student_id", student_id)
        .execute()
    )
    rows = unwrap_supabase_data(memberships) or []
    if not isinstance(rows, list) or not rows:
        return []
    classroom_ids = [r.get("classroom_id") for r in rows if r.get("classroom_id")]
    if not classroom_ids:
        return []
    result = (
        supabase.table(CLASSROOMS_TABLE)
        .select("*")
        .in_("id", classroom_ids)
        .execute()
    )
    data = unwrap_supabase_data(result) or []
    return data if isinstance(data, list) else []


def _is_classroom_member(supabase: Any, classroom_id: str, student_id: str) -> bool:
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


def join_classroom_by_code(student_id: str, class_code: str) -> Dict[str, Any]:
    normalized = class_code.strip().upper()
    if not normalized:
        raise ValueError("class_code is required")
    supabase = get_supabase_service_client()
    result = (
        supabase.table(CLASSROOMS_TABLE)
        .select("id, name, class_code")
        .eq("class_code", normalized)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(result) or []
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"Invalid class code: {normalized}")
    classroom = rows[0]
    try:
        supabase.table(MEMBERSHIPS_TABLE).insert({
            "student_id": student_id,
            "classroom_id": classroom["id"],
        }).execute()
    except APIError as exc:
        if exc.code == "23505":
            log.info("Duplicate join: student %s → classroom %s", student_id, classroom["id"])
            raise ValueError("Already joined this classroom") from exc
        raise
    return classroom


_STUDENT_ASSIGNMENT_FIELDS = (
    "id, classroom_id, title, due_date, config, "
    "prompt_storage_path, prompt_latex, problems, created_at, updated_at"
)


def list_assignments_for_classroom(
    classroom_id: str, student_id: str
) -> List[Dict[str, Any]]:
    supabase = get_supabase_service_client()
    if not _is_classroom_member(supabase, classroom_id, student_id):
        return []
    response = (
        supabase.table(ASSIGNMENTS_TABLE)
        .select(_STUDENT_ASSIGNMENT_FIELDS)
        .eq("classroom_id", classroom_id)
        .order("created_at", desc=True)
        .execute()
    )
    data = unwrap_supabase_data(response) or []
    return data if isinstance(data, list) else []

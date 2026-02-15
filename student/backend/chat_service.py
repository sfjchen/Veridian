import logging
from typing import Any, Dict, List, TypedDict

from postgrest.exceptions import APIError

from assignment_service import (
    can_student_access_assignment,
    get_assignment,
    get_problem,
    get_resolved_config,
)
from context_loader import CHAT_TOKEN_BUDGET, load_corpus_context, truncate_to_budget
from result_service import get_result
from supabase_service import get_supabase_service_client, unwrap_supabase_data

log = logging.getLogger(__name__)

CHAT_TABLE = "chat_messages"
DEFAULT_HISTORY_LIMIT = 50

SAMPLE_ALGEBRA_ASSIGNMENT_ID = "sample-algebra"
SAMPLE_ALGEBRA_PROBLEMS: List[Dict[str, Any]] = [
    {"num": 1, "statement_tex": "2x + 5 = 13"},
    {"num": 2, "statement_tex": "3(x - 4) = 15"},
    {"num": 3, "statement_tex": "4x + 2 - 3x + 7"},
    {"num": 4, "statement_tex": "x/2 + 3 = 8"},
    {"num": 5, "statement_tex": "x + y = 10,\\; 2x - y = 2"},
]


class ChatMessageInsert(TypedDict):
    message_id: str
    student_id: str
    assignment_id: str
    problem_num: int
    role: str
    content: str


def get_chat_history(student_id: str, assignment_id: str, problem_num: int, limit: int = DEFAULT_HISTORY_LIMIT) -> List[Dict[str, Any]]:
    if assignment_id == SAMPLE_ALGEBRA_ASSIGNMENT_ID:
        return []
    supabase = get_supabase_service_client()
    response = (
        supabase.table(CHAT_TABLE)
        .select("role, content, created_at")
        .eq("student_id", student_id)
        .eq("assignment_id", assignment_id)
        .eq("problem_num", problem_num)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    return rows if isinstance(rows, list) else []


def _chat_insert_payload(message: ChatMessageInsert) -> Dict[str, Any]:
    return {
        "id": message["message_id"],
        "student_id": message["student_id"],
        "assignment_id": message["assignment_id"],
        "problem_num": message["problem_num"],
        "role": message["role"],
        "content": message["content"],
    }


def _is_duplicate_chat_insert_error(exc: APIError) -> bool:
    return exc.code == "23505"


def save_message(message: ChatMessageInsert) -> Dict[str, Any]:
    if message["assignment_id"] == SAMPLE_ALGEBRA_ASSIGNMENT_ID:
        return _chat_insert_payload(message)
    supabase = get_supabase_service_client()
    payload = _chat_insert_payload(message)
    try:
        response = supabase.table(CHAT_TABLE).insert(payload).execute()
    except APIError as exc:
        if _is_duplicate_chat_insert_error(exc):
            return payload
        raise
    rows = unwrap_supabase_data(response) or []
    return rows[0] if isinstance(rows, list) and rows else payload


def build_chat_context(student_id: str, assignment_id: str, problem_num: int) -> Dict[str, Any]:
    context: Dict[str, Any] = {
        "problem_statement": "",
        "annotated_tex": "",
        "mistakes": [],
    }
    context = _load_problem_statement(assignment_id, problem_num, context)
    context = _load_result_data(student_id, assignment_id, problem_num, context)
    return _load_reference_materials(assignment_id, student_id, context)


def _fetch_corpus_text(assignment: Dict[str, Any]) -> str:
    context_file_ids = assignment.get("context_file_ids") or []
    classroom_id = assignment.get("classroom_id", "")
    try:
        result = load_corpus_context(context_file_ids, classroom_id)
        for w in result.warnings:
            log.warning("corpus load warning: %s", w)
        return truncate_to_budget(result.text, CHAT_TOKEN_BUDGET)
    except Exception as exc:
        log.exception("Failed to load corpus context: %s", exc)
        return ""


def _load_reference_materials(
    assignment_id: str, student_id: str, context: Dict[str, Any]
) -> Dict[str, Any]:
    if assignment_id == SAMPLE_ALGEBRA_ASSIGNMENT_ID:
        return context
    assignment = get_assignment(assignment_id)
    if not assignment:
        return context
    if not can_student_access_assignment(assignment_id, student_id, assignment=assignment):
        log.warning("Unauthorized corpus access attempt: student=%s, assignment=%s", student_id, assignment_id)
        return context
    try:
        config = get_resolved_config(assignment_id, assignment)
    except ValueError:
        return context
    if config.get("hint_level") != "detailed":
        return context
    text = _fetch_corpus_text(assignment)
    if text:
        context["reference_materials"] = text
    return context


def _get_problem_statement(assignment_id: str, problem_num: int) -> str:
    if assignment_id == SAMPLE_ALGEBRA_ASSIGNMENT_ID:
        for p in SAMPLE_ALGEBRA_PROBLEMS:
            if isinstance(p, dict) and p.get("num") == problem_num:
                return p.get("statement_tex", "")
        return ""
    try:
        problem = get_problem(assignment_id, problem_num)
        return problem.get("statement_tex", "")
    except ValueError:
        return ""


def _load_problem_statement(assignment_id: str, problem_num: int, context: Dict[str, Any]) -> Dict[str, Any]:
    context["problem_statement"] = _get_problem_statement(assignment_id, problem_num)
    return context


def _load_result_data(
    student_id: str, assignment_id: str, problem_num: int, context: Dict[str, Any]
) -> Dict[str, Any]:
    if assignment_id == SAMPLE_ALGEBRA_ASSIGNMENT_ID:
        return context
    result = get_result(student_id, assignment_id, problem_num)
    if not result:
        return context
    context["annotated_tex"] = result.get("annotated_tex", "")
    context["mistakes"] = result.get("mistakes", [])
    return context

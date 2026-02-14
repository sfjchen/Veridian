from typing import Any, Dict, List, TypedDict

from postgrest.exceptions import APIError
from assignment_service import get_problem
from result_service import get_result
from supabase_service import get_supabase_service_client, unwrap_supabase_data

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
    return _load_result_data(student_id, assignment_id, problem_num, context)


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

"""Context loading service for student analysis and chat.

Fetches teacher-provided answer keys and corpus files from Supabase storage,
extracts text content, and gates access by hint_level policy.
"""

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Dict, List, Optional

from supabase_service import get_supabase_service_client

log = logging.getLogger(__name__)

ASSIGNMENTS_BUCKET = "assignments"
CORPUS_BUCKET = "corpus"

ANALYSIS_TOKEN_BUDGET = 50_000
CHAT_TOKEN_BUDGET = 100_000

EXTRACTABLE_TEXT_TYPES = frozenset({"tex", "txt", "md"})
EXTRACTABLE_PDF_TYPES = frozenset({"pdf"})
ALL_EXTRACTABLE_TYPES = EXTRACTABLE_TEXT_TYPES | EXTRACTABLE_PDF_TYPES


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------


@dataclass
class ContextResult:
    text: str = ""
    warnings: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Low-level: file download + extraction
# ---------------------------------------------------------------------------


@lru_cache(maxsize=128)
def _fetch_file_bytes(bucket: str, storage_path: str) -> Optional[bytes]:
    supabase = get_supabase_service_client()
    raw = supabase.storage.from_(bucket).download(storage_path)
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw)
    if isinstance(raw, dict) and isinstance(raw.get("data"), (bytes, bytearray)):
        return bytes(raw["data"])
    data_attr = getattr(raw, "data", None)
    if isinstance(data_attr, (bytes, bytearray)):
        return bytes(data_attr)
    return None


def _extract_text_content(content_bytes: bytes, file_type: str) -> str:
    if file_type in EXTRACTABLE_TEXT_TYPES:
        return content_bytes.decode("utf-8", errors="replace")
    if file_type in EXTRACTABLE_PDF_TYPES:
        return _extract_pdf_text(content_bytes)
    if not file_type:
        text = _try_extract_any_type(content_bytes)
        if text:
            return text
    raise ValueError(f"Unsupported file type: {file_type}")


def _extract_pdf_text(content_bytes: bytes) -> str:
    from io import BytesIO

    try:
        from PyPDF2 import PdfReader
    except ImportError:
        raise ImportError("PyPDF2 not installed")

    try:
        reader = PdfReader(BytesIO(content_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    except Exception as exc:
        raise ValueError(f"PDF parsing failed: {exc}")


def _try_extract_any_type(content_bytes: bytes) -> str:
    try:
        return _extract_pdf_text(content_bytes)
    except (ImportError, ValueError):
        pass
    try:
        return content_bytes.decode("utf-8", errors="replace")
    except Exception:
        pass
    return ""


def _fetch_and_extract_file(
    bucket: str, storage_path: str, file_type: str,
) -> tuple[str, List[str]]:
    warnings: List[str] = []
    try:
        raw = _fetch_file_bytes(bucket, storage_path)
    except Exception as exc:
        msg = f"Failed to download {storage_path}: {exc}"
        log.warning(msg)
        return "", [msg]
    if raw is None:
        msg = f"Empty or unreadable file at {storage_path}"
        log.warning(msg)
        return "", [msg]
    try:
        text = _extract_text_content(raw, file_type)
    except Exception as exc:
        msg = f"Failed to extract text from {storage_path}: {exc}"
        log.warning(msg)
        return "", [msg]
    return text, warnings


def _infer_file_type(storage_path: str) -> str:
    dot = storage_path.rfind(".")
    if dot == -1:
        return ""
    return storage_path[dot + 1:].lower()


# ---------------------------------------------------------------------------
# Answer key loading (hint-level gated)
# ---------------------------------------------------------------------------


def load_answer_key(
    assignment: Dict[str, Any], hint_level: str,
) -> ContextResult:
    if hint_level == "minimal":
        return ContextResult()

    # Prefer converted LaTeX (higher quality than raw PDF extraction)
    answer_key_latex = assignment.get("answer_key_latex")
    if answer_key_latex and answer_key_latex.strip():
        return ContextResult(text=answer_key_latex)

    # Fall back to downloading the original file from storage
    storage_path = assignment.get("answer_key_storage_path")
    if not storage_path:
        return ContextResult()

    file_type = _infer_file_type(storage_path)
    if file_type and file_type not in ALL_EXTRACTABLE_TYPES:
        msg = f"Unsupported answer key file type: {file_type}"
        log.warning(msg)
        return ContextResult(warnings=[msg])

    text, warnings = _fetch_and_extract_file(ASSIGNMENTS_BUCKET, storage_path, file_type)
    return ContextResult(text=text, warnings=warnings)


def load_solution_for_problem(
    assignment: Dict[str, Any], problem_num: int, hint_level: str,
) -> Optional[str]:
    """Load the solution_tex for a specific problem from the solutions array."""
    if hint_level == "minimal":
        return None
    solutions = assignment.get("solutions")
    if not isinstance(solutions, list):
        return None
    for s in solutions:
        if isinstance(s, dict) and s.get("num") == problem_num:
            tex = s.get("solution_tex", "")
            return tex if tex.strip() else None
    return None


# ---------------------------------------------------------------------------
# Corpus context loading
# ---------------------------------------------------------------------------


def _fetch_corpus_file_rows(
    context_file_ids: List[str], classroom_id: str,
) -> List[Dict[str, Any]]:
    supabase = get_supabase_service_client()
    response = (
        supabase.table("corpus_files")
        .select("id, storage_path, file_type, display_name")
        .eq("classroom_id", classroom_id)
        .in_("id", context_file_ids)
        .execute()
    )
    rows = getattr(response, "data", None)
    if isinstance(rows, list):
        return rows
    return []


def _aggregate_corpus_files(rows: List[Dict[str, Any]]) -> tuple[str, List[str]]:
    warnings: List[str] = []
    parts: List[str] = []
    for row in rows:
        ft = row.get("file_type", "") or _infer_file_type(row.get("storage_path", ""))
        text, w = _fetch_and_extract_file(CORPUS_BUCKET, row["storage_path"], ft)
        warnings.extend(w)
        if text:
            label = row.get("display_name", row["id"])
            parts.append(f"--- {label} ---\n{text}")
    return "\n\n".join(parts), warnings


def load_corpus_context(
    context_file_ids: List[str], classroom_id: str,
) -> ContextResult:
    if not context_file_ids or not classroom_id:
        return ContextResult()

    rows = _fetch_corpus_file_rows(context_file_ids, classroom_id)
    if not rows:
        msg = f"No corpus files found for ids={context_file_ids}"
        log.warning(msg)
        return ContextResult(warnings=[msg])

    found_ids = {r["id"] for r in rows}
    missing = [fid for fid in context_file_ids if fid not in found_ids]
    warnings: List[str] = []
    if missing:
        msg = f"Missing corpus files: {missing}"
        log.warning(msg)
        warnings.append(msg)

    text, agg_warnings = _aggregate_corpus_files(rows)
    warnings.extend(agg_warnings)
    return ContextResult(text=text, warnings=warnings)


# ---------------------------------------------------------------------------
# Token budget enforcement
# ---------------------------------------------------------------------------


def truncate_to_budget(text: str, budget: int = ANALYSIS_TOKEN_BUDGET) -> str:
    if len(text) <= budget:
        return text
    return text[:budget] + "\n[...truncated]"


# ---------------------------------------------------------------------------
# High-level: resolve full context for analysis
# ---------------------------------------------------------------------------


def resolve_assignment_context(
    assignment: Dict[str, Any], hint_level: str,
) -> tuple[str, str, List[str]]:
    """Load answer key + corpus context for an assignment.

    Returns (reference_tex, corpus_context, warnings).
    """
    ak = load_answer_key(assignment, hint_level)
    reference = truncate_to_budget(ak.text, ANALYSIS_TOKEN_BUDGET)

    context_file_ids = assignment.get("context_file_ids") or []
    classroom_id = assignment.get("classroom_id", "")
    corpus = load_corpus_context(context_file_ids, classroom_id)
    corpus_text = truncate_to_budget(corpus.text, ANALYSIS_TOKEN_BUDGET)

    warnings = ak.warnings + corpus.warnings
    return reference, corpus_text, warnings

import base64
import json
import logging
import os
import re
import sys
import threading
import time
import uuid
from collections import defaultdict
from contextlib import contextmanager
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any, Callable, Dict, Iterator, List, Optional, TypedDict

from anthropic import Anthropic
from artifact_service import (
    VALID_ARTIFACT_TYPES,
    create_artifact_from_bytes,
    create_artifact_upload,
    create_coord_run,
    create_latex_artifact_from_content,
    download_artifact_bytes,
    get_artifact,
    get_signed_download_url,
    list_artifacts,
    mark_artifact_uploaded,
)
from assignment_service import (
    can_student_access_assignment,
    get_assignment,
    get_problem,
    get_resolved_config,
)
from auth_middleware import (
    require_auth,
    require_auth_or_sample,
    require_auth_or_sample_chat,
)
from classroom_service import join_classroom_by_code, list_assignments_for_classroom, list_classrooms_for_student
from chat import generate_chat_response
from context_loader import load_solution_for_problem, resolve_assignment_context
from chat_service import SAMPLE_ALGEBRA_ASSIGNMENT_ID, get_chat_history
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from mistake_analysis.client import MistakeAnalyzer
from mistake_analysis.constants import ALL_TAGS, SEVERITIES, TAG_TO_SEVERITY
from result_service import get_assignment_results, get_result, set_result_status, upsert_result
from websocket_service import emit_result_ready, init_socketio
from PIL import Image, UnidentifiedImageError
from supabase_service import get_supabase_auth_client, get_supabase_service_client, unwrap_supabase_data

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

try:
    import fcntl as _fcntl
except ModuleNotFoundError:
    _fcntl = None

try:
    import msvcrt as _msvcrt
except ModuleNotFoundError:
    _msvcrt = None

# Load shared env first so local .env can override
_env_path = Path(__file__).resolve().parent.parent.parent / "environment" / ".env"
load_dotenv(_env_path)
load_dotenv(override=True)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL")
MISTAKE_ANALYSIS_MODEL = os.getenv("MISTAKE_ANALYSIS_MODEL", "claude-opus-4-6").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEFAULT_ARTIFACT_OWNER_ID = os.getenv("SUPABASE_DEFAULT_OWNER_ID", "").strip()

def _mistake_analysis_thinking_enabled() -> bool:
    v = (os.getenv("MISTAKE_ANALYSIS_THINKING", "1") or "1").strip().lower()
    return v in ("1", "true", "yes")

if not ANTHROPIC_API_KEY:
    raise RuntimeError("Missing ANTHROPIC_API_KEY in environment/.env")
if not CLAUDE_MODEL:
    raise RuntimeError("Missing CLAUDE_MODEL in environment/.env")

log = logging.getLogger(__name__)


def _cors_origins() -> list[str] | str:
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return "*"


client = Anthropic(api_key=ANTHROPIC_API_KEY)
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB upload limit
CORS(app, origins=_cors_origins())
socketio = init_socketio(app)

# -- Chat rate limiting: max 10 messages per minute per student --
# TODO: In-memory rate limiting won't survive restarts or work across
# multiple instances. Migrate to Redis or a Supabase rate-limit table
# for production deployments.
_CHAT_RATE_LIMIT = 10
_CHAT_RATE_WINDOW = 60
_CHAT_MAX_MESSAGE_LENGTH = 5000
_chat_timestamps: Dict[str, List[float]] = defaultdict(list)
_chat_lock = threading.Lock()


def _is_chat_rate_limited(student_id: str) -> bool:
    now = time.time()
    cutoff = now - _CHAT_RATE_WINDOW
    with _chat_lock:
        timestamps = _chat_timestamps[student_id]
        _chat_timestamps[student_id] = [t for t in timestamps if t > cutoff]
        if len(_chat_timestamps[student_id]) >= _CHAT_RATE_LIMIT:
            return True
        _chat_timestamps[student_id].append(now)
    return False


class AnalysisParams(TypedDict):
    reference_tex: str
    context_tex: str
    include_solution: bool


class ContextLookup(TypedDict):
    assignment_id: str | None
    problem_num: int | None
    is_sample: bool
    form_ref: str
    form_ctx: str


class ResultKey(TypedDict):
    student_id: str
    assignment_id: str
    problem_num: int


class PersistTask(TypedDict):
    key: ResultKey
    payload: Dict[str, Any]


class CaptureRequestParams(TypedDict):
    image_b64: str
    document_id: str
    sample_slug: str
    reference_tex: str
    context_tex: str
    include_solution: bool


class CaptureContext(TypedDict):
    owner_id: str
    image_bytes: bytes
    media_type: str
    document_id: str
    sample_slug: str
    reference_tex: str
    context_tex: str
    include_solution: bool


class CaptureArtifactIds(TypedDict):
    screenshot_artifact_id: str
    ocr_latex_artifact_id: str
    revised_latex_artifact_id: str


_DB_WRITE_BACKOFF_SECONDS = (0.1, 0.5, 2.0)
_RESULT_DLQ_PATH = Path(
    os.getenv(
        "RESULT_PERSIST_DLQ_PATH",
        str(Path(__file__).resolve().parent / ".result_persist_dlq.jsonl"),
    )
)
_RESULT_DLQ_LOCK_PATH = Path(f"{_RESULT_DLQ_PATH}.lock")
_result_dlq_bootstrap_lock = threading.Lock()
_result_dlq_bootstrapped = False
_result_dlq_fallback_lock = threading.Lock()
_result_dlq_fallback_warned = False


def _result_key(student_id: str, assignment_id: str, problem_num: int) -> ResultKey:
    return {"student_id": student_id, "assignment_id": assignment_id, "problem_num": problem_num}


def _retry_with_backoff(operation: Callable[[], None], action_name: str) -> None:
    max_attempts = len(_DB_WRITE_BACKOFF_SECONDS) + 1
    for attempt in range(max_attempts):
        try:
            operation()
            return
        except Exception as exc:
            if attempt == max_attempts - 1:
                raise RuntimeError(f"{action_name} failed after {max_attempts} attempts: {exc}") from exc
            time.sleep(_DB_WRITE_BACKOFF_SECONDS[attempt])


def _persist_task(key: ResultKey, payload: Dict[str, Any]) -> PersistTask:
    return {"key": key, "payload": payload}


def _serialize_persist_task(task: PersistTask) -> str:
    row = {"key": task["key"], "payload": task["payload"], "queued_at": time.time()}
    return json.dumps(row, ensure_ascii=True)


def _parse_persist_task(row: Dict[str, Any]) -> PersistTask | None:
    key = row.get("key")
    payload = row.get("payload")
    if not isinstance(key, dict) or not isinstance(payload, dict):
        return None
    student_id = str(key.get("student_id", "")).strip()
    assignment_id = str(key.get("assignment_id", "")).strip()
    try:
        problem_num = int(key.get("problem_num"))
    except (TypeError, ValueError):
        return None
    if not student_id or not assignment_id or problem_num < 1:
        return None
    return _persist_task(_result_key(student_id, assignment_id, problem_num), payload)


@contextmanager
def _persist_dlq_file_lock() -> Iterator[None]:
    global _result_dlq_fallback_warned
    _RESULT_DLQ_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _RESULT_DLQ_LOCK_PATH.open("a+b") as lock_handle:
        if _fcntl is not None:
            _fcntl.flock(lock_handle.fileno(), _fcntl.LOCK_EX)
            try:
                yield
            finally:
                _fcntl.flock(lock_handle.fileno(), _fcntl.LOCK_UN)
            return
        if _msvcrt is not None:
            lock_handle.seek(0)
            lock_handle.write(b"0")
            lock_handle.flush()
            _msvcrt.locking(lock_handle.fileno(), _msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                lock_handle.seek(0)
                _msvcrt.locking(lock_handle.fileno(), _msvcrt.LK_UNLCK, 1)
            return
        if not _result_dlq_fallback_warned:
            _result_dlq_fallback_warned = True
            log.warning("No OS-level file lock available for DLQ; using process-local lock only.")
        _result_dlq_fallback_lock.acquire()
        try:
            yield
        finally:
            _result_dlq_fallback_lock.release()


def _load_persist_dead_letters(path: Path) -> List[PersistTask]:
    if not path.exists():
        return []
    entries: List[PersistTask] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            task = _parse_persist_task(row)
            if task is not None:
                entries.append(task)
    return entries


def _claim_path(index: int) -> Path:
    stamp = time.time_ns()
    suffix = f".replay-{os.getpid()}-{stamp}-{index}"
    return _RESULT_DLQ_PATH.with_name(f"{_RESULT_DLQ_PATH.name}{suffix}")


def _replay_owner_pid(path: Path) -> int | None:
    prefix = f"{_RESULT_DLQ_PATH.name}.replay-"
    if not path.name.startswith(prefix):
        return None
    head = path.name[len(prefix) :].split("-", 1)[0]
    try:
        return int(head)
    except ValueError:
        return None


def _pid_is_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def _is_own_active_replay(path: Path) -> bool:
    """True only if this process created this file during the current run."""
    owner_pid = _replay_owner_pid(path)
    return owner_pid == os.getpid()


def _is_claimable_replay_path(path: Path) -> bool:
    if _is_own_active_replay(path):
        return False
    owner_pid = _replay_owner_pid(path)
    if owner_pid is None:
        return True
    return not _pid_is_running(owner_pid)


def _claim_persist_dead_letter_files() -> List[Path]:
    pattern = f"{_RESULT_DLQ_PATH.name}.replay-*"
    claimed: List[Path] = []
    with _persist_dlq_file_lock():
        replay_candidates = [
            path for path in sorted(_RESULT_DLQ_PATH.parent.glob(pattern)) if _is_claimable_replay_path(path)
        ]
        candidates = [_RESULT_DLQ_PATH, *replay_candidates]
        for index, source in enumerate(candidates):
            if not source.exists():
                continue
            claim = _claim_path(index)
            source.replace(claim)
            claimed.append(claim)
    return claimed


def _append_persist_dead_letter(task: PersistTask) -> None:
    line = _serialize_persist_task(task)
    with _persist_dlq_file_lock():
        with _RESULT_DLQ_PATH.open("a", encoding="utf-8") as handle:
            handle.write(f"{line}\n")


def _rewrite_persist_dead_letter_file(path: Path, tasks: List[PersistTask]) -> None:
    temp = path.with_name(f"{path.name}.tmp-{os.getpid()}-{time.time_ns()}")
    with temp.open("w", encoding="utf-8") as handle:
        for task in tasks:
            handle.write(f"{_serialize_persist_task(task)}\n")
    temp.replace(path)


def _write_result(task: PersistTask) -> None:
    key = task["key"]
    upsert_result(
        key["student_id"],
        key["assignment_id"],
        key["problem_num"],
        task["payload"],
    )


def _persist_result_with_retry(task: PersistTask) -> None:
    _retry_with_backoff(lambda: _write_result(task), "result persistence")


def _set_result_status_with_retry(key: ResultKey, status: str) -> None:
    _retry_with_backoff(
        lambda: set_result_status(key["student_id"], key["assignment_id"], key["problem_num"], status),
        f"result status update ({status})",
    )


def _replay_persist_dead_letters() -> None:
    claim_paths = _claim_persist_dead_letter_files()
    if not claim_paths:
        return
    for claim_path in claim_paths:
        pending = _load_persist_dead_letters(claim_path)
        failed: List[PersistTask] = []
        for task in pending:
            try:
                _persist_result_with_retry(task)
            except RuntimeError:
                failed.append(task)
        if not failed:
            claim_path.unlink(missing_ok=True)
            continue
        try:
            for task in failed:
                _append_persist_dead_letter(task)
        except OSError as exc:
            log.error("Failed to re-queue replayed dead letters from %s: %s", claim_path, exc)
            continue
        claim_path.unlink(missing_ok=True)


def _ensure_persist_dlq_bootstrapped() -> None:
    global _result_dlq_bootstrapped
    if _result_dlq_bootstrapped:
        return
    with _result_dlq_bootstrap_lock:
        if _result_dlq_bootstrapped:
            return
        try:
            _replay_persist_dead_letters()
        except Exception as exc:
            log.error("Failed to replay persisted-result dead letters: %s", exc, exc_info=True)
            return
        _result_dlq_bootstrapped = True


@app.before_request
def _bootstrap_dead_letter_replay() -> None:
    _ensure_persist_dlq_bootstrapped()


def _parse_problem_num(raw: str) -> Optional[int]:
    if not raw:
        return None
    try:
        value = int(raw)
    except ValueError:
        return None
    return value if value >= 1 else None


def _is_valid_uuid(raw: str) -> bool:
    try:
        uuid.UUID(raw)
        return True
    except ValueError:
        return False


def _is_valid_assignment_identifier(raw: str) -> bool:
    if raw == SAMPLE_ALGEBRA_ASSIGNMENT_ID:
        return True
    return _is_valid_uuid(raw)


def _owner_id_from_auth_header() -> tuple[str | None, bool]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return (None, False)

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise ValueError("Missing bearer token.")

    from auth_middleware import _decode_token
    try:
        payload = _decode_token(token)
    except Exception as exc:
        raise ValueError(f"Invalid bearer token: {exc}") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid bearer token.")
    return (str(user_id), True)


def _resolve_capture_owner_id() -> str:
    owner_id, auth_present = _owner_id_from_auth_header()
    if owner_id:
        return owner_id
    if auth_present:
        raise ValueError("Invalid bearer token.")
    if DEFAULT_ARTIFACT_OWNER_ID:
        return DEFAULT_ARTIFACT_OWNER_ID
    raise ValueError(
        "Missing owner identity. Provide Authorization bearer token or set SUPABASE_DEFAULT_OWNER_ID."
    )


def _decode_capture_image_base64(image_b64: str) -> bytes:
    payload = image_b64.strip()
    if not payload:
        raise ValueError("Image payload is empty.")

    if payload.startswith("data:") and "," in payload:
        payload = payload.split(",", 1)[1]

    payload = payload.replace("\n", "").replace("\r", "")
    try:
        return base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid base64 image payload: {exc}") from exc


def _document_to_sample_slug(document_id: str) -> str:
    doc_id = document_id.strip().lower()
    if doc_id in {"default-algebra", "sample-algebra"}:
        return "high-school-algebra-01"
    return ""


def _sanitize_document_id(document_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", document_id.strip())
    if not cleaned:
        return "capture"
    return cleaned[:120]


def _mime_to_extension(media_type: str) -> str:
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    return mapping.get(media_type, ".png")


def _load_sample_reference_context(sample_slug: str) -> tuple[str, str]:
    if not sample_slug:
        return ("", "")
    supabase = get_supabase_service_client()
    response = (
        supabase.table("veridian_sample_worksheets")
        .select("worksheet_text,solution_text")
        .eq("slug", sample_slug)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"Sample worksheet not found for slug: {sample_slug}")
    row = rows[0]
    worksheet = str(row.get("worksheet_text") or "").strip()
    solution = str(row.get("solution_text") or "").strip()
    if not worksheet or not solution:
        raise ValueError(f"Sample worksheet has empty worksheet/solution text for slug: {sample_slug}")
    return (worksheet, solution)


def _match_annotation_command(latex: str, idx: int) -> tuple[str, int] | None:
    for command in ("mistaketext", "mistake"):
        token = f"\\{command}"
        if not latex.startswith(token, idx):
            continue

        next_idx = idx + len(token)
        if next_idx >= len(latex):
            return (command, next_idx)

        next_ch = latex[next_idx]
        if next_ch == "{" or next_ch.isspace():
            return (command, next_idx)

    return None


def _parse_braced_content(text: str, start_idx: int) -> tuple[str, int]:
    if start_idx >= len(text) or text[start_idx] != "{":
        raise ValueError("Expected '{' while parsing LaTeX command arguments.")

    def _is_escaped_brace(idx: int) -> bool:
        slash_count = 0
        j = idx - 1
        while j >= 0 and text[j] == "\\":
            slash_count += 1
            j -= 1
        return slash_count % 2 == 1

    i = start_idx + 1
    depth = 1
    collected: list[str] = []
    while i < len(text):
        ch = text[i]
        if ch == "{" and not _is_escaped_brace(i):
            depth += 1
            collected.append(ch)
        elif ch == "}" and not _is_escaped_brace(i):
            depth -= 1
            if depth == 0:
                return ("".join(collected).strip(), i + 1)
            collected.append(ch)
        else:
            collected.append(ch)
        i += 1
    raise ValueError("Malformed LaTeX: unmatched braces.")


def _parse_single_annotation(latex: str, command: str, start: int) -> tuple[Dict[str, str], int]:
    args: List[str] = []
    i = start
    for _ in range(4):
        while i < len(latex) and latex[i].isspace():
            i += 1
        if i >= len(latex) or latex[i] != "{":
            raise ValueError(f"Malformed LaTeX: {command} requires 4 braced arguments.")
        arg, i = _parse_braced_content(latex, i)
        args.append(arg)
    annotation = {
        "command": command,
        "content": args[0],
        "explanation": args[1],
        "tag": args[2],
        "severity": args[3],
    }
    return annotation, i


def extract_mistake_annotations(latex: str) -> List[Dict[str, str]]:
    annotations: List[Dict[str, str]] = []
    i = 0
    while i < len(latex):
        command_match = _match_annotation_command(latex, i)
        if command_match is None:
            i += 1
            continue
        command, i = command_match
        annotation, i = _parse_single_annotation(latex, command, i)
        annotation["id"] = str(len(annotations))
        annotations.append(annotation)

    if not annotations:
        raise ValueError(
            "Input LaTeX does not contain any \\mistake{...} or \\mistaketext{...} annotations."
        )
    return annotations


def validate_annotations(annotations: List[Dict[str, str]]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    for item in annotations:
        tag = item["tag"].strip()
        severity = item["severity"].strip().lower()

        if severity not in SEVERITIES:
            raise ValueError(
                f"Invalid severity '{item['severity']}' for id={item['id']}. "
                f"Allowed: {SEVERITIES}"
            )
        if tag not in ALL_TAGS:
            raise ValueError(
                f"Invalid tag '{item['tag']}' for id={item['id']}. "
                f"Allowed tags are defined in mistake_analysis.constants"
            )
        expected = TAG_TO_SEVERITY.get(tag)
        if expected != severity:
            raise ValueError(
                f"Tag/severity mismatch for id={item['id']}: tag '{tag}' must use severity "
                f"'{expected}', but got '{severity}'."
            )

        normalized.append({**item, "tag": tag, "severity": severity})
    return normalized


def _extract_json_fragment(raw_text: str) -> Any:
    raw_text = raw_text.strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        object_match = re.search(r"\{[\s\S]*\}", raw_text)
        array_match = re.search(r"\[[\s\S]*\]", raw_text)
        candidate = None
        if object_match and array_match:
            candidate = max((object_match.group(0), array_match.group(0)), key=len)
        elif object_match:
            candidate = object_match.group(0)
        elif array_match:
            candidate = array_match.group(0)
        if not candidate:
            raise ValueError("Model response did not contain JSON.")
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise ValueError("Model JSON was invalid.") from exc


def _normalize_box(box: Dict[str, Any], image_dims: tuple[int, int]) -> Dict[str, float]:
    required = {"x_min", "y_min", "x_max", "y_max"}
    if not isinstance(box, dict) or not required.issubset(box.keys()):
        raise ValueError("Each box must contain x_min, y_min, x_max, y_max.")

    out: Dict[str, float] = {}
    for key in ("x_min", "y_min", "x_max", "y_max"):
        value = box[key]
        if not isinstance(value, (int, float)):
            raise ValueError(f"{key} must be numeric.")
        out[key] = float(value)

    if out["x_min"] > out["x_max"] or out["y_min"] > out["y_max"]:
        raise ValueError("Each box must satisfy x_min <= x_max and y_min <= y_max.")

    w, h = image_dims
    if out["x_min"] < 0 or out["y_min"] < 0 or out["x_max"] > float(w) or out["y_max"] > float(h):
        raise ValueError(f"Box coordinates must stay within image bounds: width={w}, height={h}.")
    return out


def _build_id_lookup(annotations: List[Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    return {item["id"]: item for item in annotations}


def _extract_box_rows(payload: Any) -> List[Any]:
    if isinstance(payload, dict) and "mistakes" in payload and isinstance(payload["mistakes"], list):
        return payload["mistakes"]
    if isinstance(payload, list):
        return payload
    raise ValueError("JSON must be a list or an object with a 'mistakes' list.")


def _resolve_box_id(item: Any, id_lookup: Dict[str, Dict[str, str]], seen_ids: set[str]) -> str:
    if not isinstance(item, dict):
        raise ValueError("Each mistake entry must be a JSON object.")
    if "id" not in item:
        raise ValueError("Each mistake entry must include an 'id'.")
    item_id = str(item["id"])
    if item_id not in id_lookup:
        raise ValueError(f"Unknown mistake id returned by model: {item_id}")
    if item_id in seen_ids:
        raise ValueError(f"Duplicate mistake id returned by model: {item_id}")
    seen_ids.add(item_id)
    return item_id


def extract_json_boxes(
    raw_text: str, annotations: List[Dict[str, str]], image_dims: tuple[int, int]
) -> Dict[str, List[Dict[str, Any]]]:
    id_lookup = _build_id_lookup(annotations)
    rows = _extract_box_rows(_extract_json_fragment(raw_text))

    seen_ids: set[str] = set()
    normalized: List[Dict[str, Any]] = []
    for item in rows:
        item_id = _resolve_box_id(item, id_lookup, seen_ids)
        source = id_lookup[item_id]
        coords = _normalize_box(item, image_dims)
        normalized.append(
            {"id": item_id, **{k: source[k] for k in ("command", "content", "explanation", "tag", "severity")}, **coords}
        )

    missing_ids = set(id_lookup.keys()) - seen_ids
    if missing_ids:
        raise ValueError(
            f"Model response did not include exactly one box per annotation id. Missing ids: {sorted(missing_ids)}"
        )
    return {"mistakes": normalized}


def _max_output_tokens(annotation_count: int) -> int:
    return min(4096, max(512, 128 + (annotation_count * 96)))


def _infer_image_media_type(image_bytes: bytes) -> str:
    try:
        with Image.open(BytesIO(image_bytes)) as im:
            fmt = (im.format or "").upper()
    except UnidentifiedImageError as exc:
        raise ValueError(f"Invalid image format: {exc}") from exc

    mime_type = _FMT_TO_MIME.get(fmt)
    if not mime_type:
        raise ValueError(f"Unsupported image format: {fmt or 'unknown'}")
    return mime_type


def _parse_and_validate_annotations(
    latex: str, image_bytes: bytes
) -> tuple[List[Dict[str, str]], tuple[int, int]]:
    if not latex.strip():
        raise ValueError("Missing or empty form field: latex")
    if not image_bytes:
        raise ValueError("Image file is empty.")

    annotations = extract_mistake_annotations(latex)
    annotations = validate_annotations(annotations)

    try:
        with Image.open(BytesIO(image_bytes)) as im:
            dims = im.size
    except UnidentifiedImageError as exc:
        raise ValueError(f"Invalid image format: {exc}") from exc

    return annotations, dims


def _build_vision_prompt(annotations: List[Dict[str, str]], image_dims: tuple[int, int]) -> str:
    w, h = image_dims
    return f"""You are given:
1) An image (screenshot) with fixed pixel size.
2) LaTeX text containing mistake annotations using custom commands:
   - \\mistake{{content}}{{explanation}}{{tag}}{{severity}}
   - \\mistaketext{{content}}{{explanation}}{{tag}}{{severity}}

Task:
- Find the on-image coordinates for each mistake annotation.
- Match by id for each target below.
- Image dimensions are width={w}, height={h}.
- Coordinate system origin is bottom-left: (0, 0).
- Return ONLY valid JSON, with no markdown and no extra text.
- Return exactly one box for every target id and include each id exactly once.
- Valid severities: {json.dumps(SEVERITIES, ensure_ascii=True)}
- Valid tag->severity mapping: {json.dumps(TAG_TO_SEVERITY, ensure_ascii=True)}
- Targets:
{json.dumps(annotations, ensure_ascii=True)}
- JSON schema:
  {{
    "mistakes": [
      {{
        "id": string,
        "x_min": number,
        "y_min": number,
        "x_max": number,
        "y_max": number
      }}
    ]
  }}
Where:
- Each item in "mistakes" is one detected annotation.
- (x_min, y_min) is the lower-left corner of the box.
- (x_max, y_max) is the upper-right corner of the box.
- Values must be in pixels.
"""


def _build_vision_message(prompt: str, encoded_image: str, media_type: str) -> List[Dict[str, Any]]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": encoded_image,
                    },
                },
            ],
        }
    ]


def _call_claude_vision(messages: List[Dict[str, Any]], annotation_count: int) -> str:
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=_max_output_tokens(annotation_count),
            temperature=0,
            messages=messages,
        )
    except Exception as exc:
        raise RuntimeError(f"Claude API call failed: {exc}") from exc

    text_blocks = [block.text for block in response.content if getattr(block, "type", "") == "text"]
    raw_output = "\n".join(text_blocks).strip()
    if not raw_output:
        raise RuntimeError("Claude returned an empty response.")
    return raw_output


def _parse_coord_response(
    raw_output: str, annotations: List[Dict[str, str]], image_dims: tuple[int, int]
) -> Dict[str, List[Dict[str, Any]]]:
    try:
        return extract_json_boxes(raw_output, annotations, image_dims)
    except ValueError as exc:
        raise RuntimeError(f"Claude JSON parse error: {exc}") from exc


def _run_mistake_coord_pipeline(
    image_bytes: bytes, latex: str, media_type: str
) -> Dict[str, Any]:
    annotations, dims = _parse_and_validate_annotations(latex, image_bytes)
    prompt = _build_vision_prompt(annotations, dims)
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")
    messages = _build_vision_message(prompt, encoded_image, media_type or "image/png")
    raw_output = _call_claude_vision(messages, len(annotations))
    result: Dict[str, Any] = _parse_coord_response(raw_output, annotations, dims)
    result["mistakes"] = _add_dot_coords(result["mistakes"], dims)
    result["_image_dims"] = dims
    return result


_MISTAKE_PATTERN = re.compile(r"\\mistake(?:text)?\s*\{")


def _has_mistake_annotations(latex: str) -> bool:
    return bool(_MISTAKE_PATTERN.search(latex))


def _count_mistake_annotations_approx(latex: str) -> int:
    return len(_MISTAKE_PATTERN.findall(latex))


_FMT_TO_MIME = {"PNG": "image/png", "JPEG": "image/jpeg", "JPG": "image/jpeg", "WEBP": "image/webp", "GIF": "image/gif"}


def _image_bytes_to_latex(image_bytes: bytes) -> str:
    max_side = int(os.getenv("MATH_OCR_MAX_IMAGE_SIDE", "1024"))
    try:
        with Image.open(BytesIO(image_bytes)) as im:
            fmt = (im.format or "PNG").upper()
            w, h = im.size
            if max(w, h) > max_side:
                scale = max_side / max(w, h)
                resized = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                out = BytesIO()
                resized.save(out, format=fmt)
                image_bytes = out.getvalue()
    except UnidentifiedImageError as exc:
        raise ValueError(f"Invalid image format: {exc}") from exc

    mime_type = _FMT_TO_MIME.get(fmt, "image/png")

    _ocr_debug = os.getenv("MATH_OCR_DEBUG", "") or os.getenv("DEBUG", "")
    t0 = time.perf_counter()
    from math_screenshot_to_latex.client import screenshot_to_latex

    latex = screenshot_to_latex(image_bytes=image_bytes, mime_type=mime_type)
    if _ocr_debug.strip().lower() in ("1", "true", "yes"):
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        log.debug("handwriting_ocr_ms=%d", elapsed_ms)
    return latex


def _add_dot_coords(mistakes: List[Dict[str, Any]], image_dims: tuple[int, int]) -> List[Dict[str, Any]]:
    """Add dot (normalized [0,1] center) to each mistake. Image coords: bottom-left origin."""
    w, h = image_dims
    for m in mistakes:
        x_min, x_max = m.get("x_min", 0), m.get("x_max", 0)
        y_min, y_max = m.get("y_min", 0), m.get("y_max", 0)
        m["dot"] = {
            "x": (x_min + x_max) / 2 / w if w else 0,
            "y": (y_min + y_max) / 2 / h if h else 0,
        }
    return mistakes


def _filter_by_hint_level(mistakes: List[Dict[str, Any]], hint_level: str) -> List[Dict[str, Any]]:
    if hint_level == "detailed":
        return mistakes
    filtered = []
    for m in mistakes:
        m = dict(m)
        if hint_level == "minimal":
            m["explanation"] = ""
        elif hint_level == "guided":
            full = m.get("explanation", "")
            m["explanation"] = full.split(".")[0] + "." if "." in full else full
        filtered.append(m)
    return filtered


@app.get("/health")
def health() -> Any:
    return jsonify({"status": "ok"})


@app.post("/artifacts/upload-url")
@require_auth
def artifacts_upload_url() -> Any:
    payload = request.get_json(silent=True) or {}
    artifact_type = str(payload.get("artifact_type", "")).strip().lower()
    filename = str(payload.get("filename", "")).strip()
    mime_type = str(payload.get("mime_type", "")).strip()
    byte_size = payload.get("byte_size")
    metadata = payload.get("metadata") or {}

    if not artifact_type:
        return jsonify({"error": "Missing required field: artifact_type"}), 400
    if artifact_type not in VALID_ARTIFACT_TYPES:
        return jsonify({"error": f"artifact_type must be one of: {sorted(VALID_ARTIFACT_TYPES)}"}), 400
    if not filename:
        return jsonify({"error": "Missing required field: filename"}), 400
    if byte_size is not None and not isinstance(byte_size, int):
        return jsonify({"error": "byte_size must be an integer."}), 400
    if not isinstance(metadata, dict):
        return jsonify({"error": "metadata must be a JSON object."}), 400

    try:
        upload_payload = create_artifact_upload(
            owner_id=g.user_id,
            artifact_type=artifact_type,
            filename=filename,
            mime_type=mime_type,
            byte_size=byte_size,
            metadata=metadata,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unable to create signed upload URL: {exc}"}), 502

    return jsonify(upload_payload), 201


@app.post("/artifacts/confirm-upload")
@require_auth
def artifacts_confirm_upload() -> Any:
    payload = request.get_json(silent=True) or {}
    artifact_id = str(payload.get("artifact_id", "")).strip()
    if not artifact_id:
        return jsonify({"error": "Missing required field: artifact_id"}), 400

    try:
        artifact = mark_artifact_uploaded(owner_id=g.user_id, artifact_id=artifact_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": f"Unable to confirm upload: {exc}"}), 502

    return jsonify({"artifact": artifact})


@app.post("/artifacts/screenshot-to-latex")
@require_auth
def artifacts_screenshot_to_latex() -> Any:
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY not configured"}), 503

    payload = request.get_json(silent=True) or {}
    screenshot_artifact_id = str(payload.get("screenshot_artifact_id", "")).strip()
    if not screenshot_artifact_id:
        return jsonify({"error": "Missing required field: screenshot_artifact_id"}), 400

    try:
        screenshot = get_artifact(owner_id=g.user_id, artifact_id=screenshot_artifact_id)
    except Exception as exc:
        return jsonify({"error": f"Unable to load artifact: {exc}"}), 502

    if screenshot is None:
        return jsonify({"error": "Artifact not found."}), 404
    if not screenshot.get("uploaded_at"):
        return jsonify({"error": "Screenshot upload must be confirmed first."}), 409
    if screenshot.get("artifact_type") != "screenshot":
        return jsonify({"error": "screenshot_artifact_id must point to a screenshot artifact."}), 400

    try:
        image_bytes = download_artifact_bytes(screenshot["storage_path"])
    except Exception as exc:
        return jsonify({"error": f"Unable to download screenshot: {exc}"}), 502

    if not image_bytes:
        return jsonify({"error": "Screenshot file is empty."}), 400

    try:
        latex = _image_bytes_to_latex(image_bytes)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Image-to-latex failed: {exc}"}), 502

    try:
        latex_artifact = create_latex_artifact_from_content(
            owner_id=g.user_id, content=latex, display_name="screenshot-extracted.tex"
        )
    except Exception as exc:
        return jsonify({"error": f"Unable to store latex artifact: {exc}"}), 502

    return jsonify({"artifact": latex_artifact, "latex": latex}), 201


@app.get("/artifacts")
@require_auth
def artifacts_index() -> Any:
    artifact_type = request.args.get("artifact_type")
    limit_raw = request.args.get("limit", "50")

    try:
        limit = max(1, min(200, int(limit_raw)))
    except ValueError:
        return jsonify({"error": "limit must be an integer."}), 400

    try:
        artifacts = list_artifacts(owner_id=g.user_id, artifact_type=artifact_type, limit=limit)
    except Exception as exc:
        return jsonify({"error": f"Unable to list artifacts: {exc}"}), 502

    return jsonify({"artifacts": artifacts})


@app.get("/artifacts/<artifact_id>/download-url")
@require_auth
def artifacts_download_url(artifact_id: str) -> Any:
    try:
        artifact = get_artifact(owner_id=g.user_id, artifact_id=artifact_id)
    except Exception as exc:
        return jsonify({"error": f"Unable to fetch artifact: {exc}"}), 502

    if artifact is None:
        return jsonify({"error": "Artifact not found."}), 404
    if not artifact.get("uploaded_at"):
        return jsonify({"error": "Artifact upload is not confirmed yet."}), 409

    try:
        signed_url = get_signed_download_url(artifact["storage_path"])
    except Exception as exc:
        return jsonify({"error": f"Unable to create signed download URL: {exc}"}), 502

    return jsonify({"artifact_id": artifact_id, "download_url": signed_url})


@app.post("/mistake-coords/from-artifacts")
@require_auth
def mistake_coords_from_artifacts() -> Any:
    payload = request.get_json(silent=True) or {}
    screenshot_artifact_id = str(payload.get("screenshot_artifact_id", "")).strip()
    latex_artifact_id = str(payload.get("latex_artifact_id", "")).strip()

    if not screenshot_artifact_id or not latex_artifact_id:
        return jsonify({"error": "screenshot_artifact_id and latex_artifact_id are required."}), 400

    try:
        screenshot = get_artifact(owner_id=g.user_id, artifact_id=screenshot_artifact_id)
        latex_artifact = get_artifact(owner_id=g.user_id, artifact_id=latex_artifact_id)
    except Exception as exc:
        return jsonify({"error": f"Unable to load artifacts: {exc}"}), 502

    if screenshot is None or latex_artifact is None:
        return jsonify({"error": "One or more artifacts were not found."}), 404

    if not screenshot.get("uploaded_at") or not latex_artifact.get("uploaded_at"):
        return jsonify({"error": "Both artifacts must be confirmed uploaded first."}), 409

    if screenshot.get("artifact_type") != "screenshot":
        return jsonify({"error": "screenshot_artifact_id must point to a screenshot artifact."}), 400
    if latex_artifact.get("artifact_type") != "latex":
        return jsonify({"error": "latex_artifact_id must point to a latex artifact."}), 400

    try:
        image_bytes = download_artifact_bytes(screenshot["storage_path"])
        latex_bytes = download_artifact_bytes(latex_artifact["storage_path"])
    except Exception as exc:
        return jsonify({"error": f"Unable to download artifacts from Supabase Storage: {exc}"}), 502

    try:
        latex = latex_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        return jsonify({"error": f"LaTeX artifact is not UTF-8 decodable: {exc}"}), 400

    media_type = (screenshot.get("mime_type") or "").strip()
    if not media_type:
        try:
            media_type = _infer_image_media_type(image_bytes)
        except ValueError as exc:
            return jsonify({"error": f"Unable to infer screenshot MIME type: {exc}"}), 400
    elif not media_type.startswith("image/"):
        return jsonify({"error": "Screenshot artifact mime_type must be image/*."}), 400

    try:
        coords_payload = _run_mistake_coord_pipeline(image_bytes=image_bytes, latex=latex, media_type=media_type)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    run_payload = None
    try:
        run_payload = create_coord_run(
            owner_id=g.user_id,
            screenshot_artifact_id=screenshot_artifact_id,
            latex_artifact_id=latex_artifact_id,
            result=coords_payload,
        )
    except Exception as exc:
        log.error("Failed to create coord run: %s", exc, exc_info=True)
        run_payload = None

    response = {"mistakes": coords_payload["mistakes"]}
    if run_payload and run_payload.get("id"):
        response["coord_run_id"] = run_payload["id"]
    return jsonify(response)


@app.post("/mistake-coords")
def mistake_coords() -> Any:
    image = request.files.get("image")
    latex = request.form.get("latex", "")

    if image is None:
        return jsonify({"error": "Missing image file field: image"}), 400

    image_bytes = image.read()
    media_type = image.mimetype or "image/png"
    try:
        coords_payload = _run_mistake_coord_pipeline(image_bytes=image_bytes, latex=latex, media_type=media_type)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(coords_payload)


@app.post("/image-to-latex")
def image_to_latex() -> Any:
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY not configured"}), 503

    image = request.files.get("image")
    if image is None:
        return jsonify({"error": "Missing image file field: image"}), 400

    image_bytes = image.read()
    if not image_bytes:
        return jsonify({"error": "Image file is empty."}), 400

    try:
        latex = _image_bytes_to_latex(image_bytes)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Image-to-latex failed: {exc}"}), 502

    return jsonify({"latex": latex})


@lru_cache(maxsize=1)
def _get_openai_client() -> Any:
    from openai import OpenAI
    return OpenAI(api_key=OPENAI_API_KEY)


def _gpt_autocomplete(image_b64: str, problem_context: str) -> tuple[str, int]:
    t0 = time.perf_counter()
    oai = _get_openai_client()
    data_uri = f"data:image/png;base64,{image_b64}"
    prompt = (
        f"You are a math tutor watching a student solve a problem in real-time.\n\n"
        f"Problem: {problem_context}\n\n"
        "The image shows the student's handwritten work so far. "
        "Predict what should come next in their solution — the next step or expression. "
        "Return ONLY the LaTeX for the next step, or an empty string if the work "
        "appears complete or you cannot determine what comes next.\n"
        "No explanation, markdown, or code fences."
    )
    resp = oai.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_uri, "detail": "low"}},
            ],
        }],
    )
    suggestion = (resp.choices[0].message.content or "").strip()
    ms = int((time.perf_counter() - t0) * 1000)
    return (suggestion, ms)


@app.post("/handwriting-ocr")
def handwriting_autocomplete() -> Any:
    payload = request.get_json(silent=True) or {}
    image_b64 = str(payload.get("image", "")).strip()
    problem_context = str(payload.get("problem_context", "")).strip()
    if not image_b64:
        return jsonify({"error": "Missing required field: image"}), 400

    try:
        raw = _decode_capture_image_base64(image_b64)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    b64_clean = base64.b64encode(raw).decode("utf-8")
    try:
        suggestion, ms = _gpt_autocomplete(b64_clean, problem_context)
    except Exception as exc:
        log.error("Autocomplete failed: %s", exc, exc_info=True)
        return jsonify({"error": f"Autocomplete failed: {exc}"}), 502

    log.info("Autocomplete (%dms): %s", ms, suggestion or "(empty)")
    return jsonify({"suggestion": suggestion, "ms": ms})


_DEFAULT_REFERENCE_TEX = r"""
1. \; 2x + 5 = 13 \implies 2x = 8 \implies x = 4
2. \; 3(x - 4) = 15 \implies 3x - 12 = 15 \implies 3x = 27 \implies x = 9
3. \; 4x + 2 - 3x + 7 = x + 9
4. \; \frac{x}{2} + 3 = 8 \implies \frac{x}{2} = 5 \implies x = 10
5. \; x + y = 10,\; 2x - y = 2 \implies 3x = 12 \implies x = 4,\; y = 6
""".strip()

_DEFAULT_CONTEXT_TEX = r"""
Algebra worksheet: solve single-variable linear equations and simplify expressions.
Topics: basic linear equations, distributive property, combining like terms, systems of equations.
""".strip()


def _resolve_context(lookup: ContextLookup) -> tuple[str, str, str, List[str]]:
    assignment_id = lookup["assignment_id"]
    problem_num = lookup["problem_num"]
    form_ref = lookup["form_ref"]
    form_ctx = lookup["form_ctx"]

    if assignment_id and problem_num is not None:
        try:
            return _resolve_assignment_context(assignment_id, problem_num, form_ref, form_ctx)
        except ValueError as exc:
            log.warning("Context resolution failed for assignment=%s problem=%s: %s", assignment_id, problem_num, exc)
    if lookup["is_sample"]:
        return (form_ref or _DEFAULT_REFERENCE_TEX, form_ctx or _DEFAULT_CONTEXT_TEX, "detailed", [])
    return (form_ref, form_ctx, "detailed", [])


def _resolve_assignment_context(
    assignment_id: str, problem_num: int, form_ref: str, form_ctx: str,
) -> tuple[str, str, str, List[str]]:
    problem = get_problem(assignment_id, problem_num)
    statement = problem.get("statement_tex", "")
    assignment = get_assignment(assignment_id)
    config = get_resolved_config(assignment_id)
    hint_level = config.get("hint_level", "guided")

    # Per-problem solution_tex is the best reference; fall back to whole answer key
    solution_tex = load_solution_for_problem(assignment, problem_num, hint_level)
    ref_tex, corpus_text, warnings = resolve_assignment_context(assignment, hint_level)
    reference = solution_tex or ref_tex or form_ref

    context_parts = []
    if statement:
        context_parts.append(f"Problem {problem_num}: {statement}")
    if corpus_text:
        context_parts.append(corpus_text)
    context = "\n\n".join(context_parts) or form_ctx

    if warnings:
        log.info("Context warnings for assignment=%s: %s", assignment_id, warnings)
    return (reference, context, hint_level, warnings)


def _profile_enabled() -> bool:
    v = (os.getenv("ANALYSIS_PROFILE", "") or os.getenv("MATH_OCR_DEBUG", "") or os.getenv("DEBUG", "")).strip().lower()
    return v in ("1", "true", "yes")


def _profile_log_timing(timing: Dict[str, int]) -> None:
    total = sum(timing.values())
    parts = " ".join(f"{k}={v}" for k, v in sorted(timing.items()))
    log.info("analysis_timing total_ms=%d %s", total, parts)


def _run_analysis(image_bytes: bytes, params: AnalysisParams) -> Dict[str, Any]:
    t0 = time.perf_counter()
    student_tex = _image_bytes_to_latex(image_bytes)
    ocr_ms = int((time.perf_counter() - t0) * 1000)
    log.info("OCR completed (%dms, %d chars)", ocr_ms, len(student_tex))

    t1 = time.perf_counter()
    analyzer = MistakeAnalyzer(
        analysis_model=MISTAKE_ANALYSIS_MODEL,
        use_extended_thinking=_mistake_analysis_thinking_enabled(),
    )
    result = analyzer.run(
        student_tex=student_tex,
        reference_tex=params["reference_tex"],
        context_tex=params["context_tex"],
        include_solution=params["include_solution"],
    )
    mistake_analysis_ms = int((time.perf_counter() - t1) * 1000)
    return {
        "student_tex": student_tex,
        **result,
        "_timing": {"ocr_ms": ocr_ms, "mistake_analysis_ms": mistake_analysis_ms},
    }


def _extract_mistakes_with_coords(
    annotated_tex: str, image_bytes: bytes, mimetype: str
) -> tuple[int, List[Dict[str, Any]], tuple[int, int] | None]:
    if not _has_mistake_annotations(annotated_tex):
        return (0, [], None)

    try:
        parsed = extract_mistake_annotations(annotated_tex)
        mistake_count = len(parsed)
    except ValueError:
        mistake_count = _count_mistake_annotations_approx(annotated_tex) or 0

    mistakes: List[Dict[str, Any]] = []
    dims: tuple[int, int] | None = None
    try:
        coords = _run_mistake_coord_pipeline(image_bytes, annotated_tex, mimetype)
        mistakes = coords.get("mistakes", [])
        dims = coords.get("_image_dims")
    except (ValueError, RuntimeError) as exc:
        log.warning("Coordinate pipeline failed (returning count without coords): %s", exc)
    return (mistake_count, mistakes, dims)


def _parse_analysis_request() -> tuple[bytes, str, ContextLookup, bool]:
    image = request.files.get("image")
    if image is None:
        raise ValueError("Missing image file field: image")

    image_bytes = image.read()
    if not image_bytes:
        raise ValueError("Image file is empty.")

    is_sample = request.form.get("is_sample", "false").lower() in ("true", "1", "yes")
    assignment_id = request.form.get("assignment_id", "").strip() or None
    problem_num_raw = request.form.get("problem_num", "").strip()
    problem_num = _parse_problem_num(problem_num_raw)
    if problem_num_raw and problem_num is None:
        raise ValueError(f"Invalid problem_num: {problem_num_raw!r}")

    include_solution = request.form.get("include_solution", "true").lower() in ("true", "1", "yes")

    lookup: ContextLookup = {
        "assignment_id": assignment_id,
        "problem_num": problem_num,
        "is_sample": is_sample,
        "form_ref": request.form.get("reference_tex", "").strip(),
        "form_ctx": request.form.get("context_tex", "").strip(),
    }
    mimetype = image.mimetype or "image/png"
    return (image_bytes, mimetype, lookup, include_solution)


def _postprocess_mistakes(
    mistakes: List[Dict[str, Any]], image_bytes: bytes, hint_level: str,
    cached_dims: tuple[int, int] | None = None,
) -> List[Dict[str, Any]]:
    if not mistakes:
        return mistakes
    try:
        dims = cached_dims
        if dims is None:
            with Image.open(BytesIO(image_bytes)) as im:
                dims = im.size
        mistakes = _add_dot_coords(mistakes, dims)
    except Exception as exc:
        log.error("Failed to compute dot coordinates: %s", exc, exc_info=True)
    return _filter_by_hint_level(mistakes, hint_level)


def _build_analysis_payload(
    result: Dict[str, Any], mistake_count: int, mistakes: List[Dict[str, Any]]
) -> Dict[str, Any]:
    return {
        "student_tex": result["student_tex"],
        "annotated_tex": result["annotated_tex"],
        "continuation_tex": result["continuation_tex"],
        "mistake_count": mistake_count,
        "mistakes": mistakes,
    }


def _persist_analysis_result(key: ResultKey, payload: Dict[str, Any]) -> None:
    task = _persist_task(key, payload)
    try:
        _persist_result_with_retry(task)
    except RuntimeError as exc:
        try:
            _append_persist_dead_letter(task)
        except OSError as dlq_exc:
            log.error(
                "Failed to persist result and failed to queue DLQ fallback: %s (dlq: %s)",
                exc,
                dlq_exc,
            )
            return
        log.error("Failed to persist result after retries; queued for replay: %s", exc)


@app.post("/analyze-solution")
@require_auth_or_sample(DEFAULT_ARTIFACT_OWNER_ID or "anonymous-sample")
def analyze_solution() -> Any:
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY not configured"}), 503

    try:
        image_bytes, mimetype, lookup, include_solution = _parse_analysis_request()
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    reference_tex, context_tex, hint_level, context_warnings = _resolve_context(lookup)
    assignment_id = lookup["assignment_id"]
    problem_num = lookup["problem_num"]

    student_id = g.user_id
    result_key: ResultKey | None = None
    if assignment_id and problem_num is not None:
        result_key = _result_key(student_id, assignment_id, problem_num)
        try:
            _set_result_status_with_retry(result_key, "analyzing")
        except RuntimeError as exc:
            log.error("Failed to set analyzing status: %s", exc)

    params: AnalysisParams = {
        "reference_tex": reference_tex,
        "context_tex": context_tex,
        "include_solution": include_solution,
    }
    try:
        result = _run_analysis(image_bytes, params)
    except ValueError as exc:
        err = str(exc)
        if "Anthropic API error" in err or "API error" in err:
            log.error("Analysis API error: %s", err)
            return jsonify({"error": err}), 502
        return jsonify({"error": err}), 400
    except Exception as exc:
        log.exception("Analysis failed")
        return jsonify({"error": f"Analysis failed: {exc}"}), 502

    timing = dict(result.pop("_timing", {}))
    t_coords = time.perf_counter()
    annotated_tex = result["annotated_tex"]
    mistake_count, mistakes, cached_dims = _extract_mistakes_with_coords(annotated_tex, image_bytes, mimetype)
    timing["coords_ms"] = int((time.perf_counter() - t_coords) * 1000)
    mistakes = _postprocess_mistakes(mistakes, image_bytes, hint_level, cached_dims=cached_dims)

    if _profile_enabled():
        _profile_log_timing(timing)

    payload = _build_analysis_payload(result, mistake_count, mistakes)
    if problem_num is not None:
        payload["problem_num"] = problem_num
    if assignment_id:
        payload["assignment_id"] = assignment_id
        payload["hint_level"] = hint_level
    if context_warnings:
        payload["context_warnings"] = context_warnings

    if result_key and problem_num is not None:
        _persist_analysis_result(result_key, payload)
        try:
            emit_result_ready(student_id, problem_num, payload)
        except Exception:
            log.error("Failed to emit WebSocket result", exc_info=True)

    if _profile_enabled():
        payload["timing_ms"] = timing
    return jsonify(payload)


@app.get("/classrooms")
@require_auth
def list_classrooms() -> Any:
    try:
        classrooms = list_classrooms_for_student(g.user_id)
    except Exception as exc:
        log.error("Failed to list classrooms for %s: %s", g.user_id, exc, exc_info=True)
        return jsonify({"error": "Failed to load classrooms. Please try again."}), 500
    return jsonify(classrooms)


@app.post("/classrooms/join")
@require_auth
def join_classroom() -> Any:
    payload = request.get_json(silent=True) or {}
    class_code = str(payload.get("class_code", "")).strip()
    if not class_code:
        return jsonify({"error": "class_code is required."}), 400
    try:
        classroom = join_classroom_by_code(g.user_id, class_code)
    except ValueError as exc:
        msg = str(exc)
        if "Invalid class code" in msg:
            return jsonify({"error": msg}), 404
        if "Already joined" in msg:
            return jsonify({"error": msg}), 409
        return jsonify({"error": msg}), 400
    return jsonify({"classroom": classroom}), 201


@app.get("/classrooms/<classroom_id>/assignments")
@require_auth
def list_classroom_assignments(classroom_id: str) -> Any:
    assignments = list_assignments_for_classroom(classroom_id, g.user_id)
    if not assignments:
        membership_check = list_classrooms_for_student(g.user_id)
        if not any(c.get("id") == classroom_id for c in membership_check):
            return jsonify({"error": "Access denied"}), 403
    return jsonify(assignments)


ASSIGNMENTS_BUCKET = "assignments"


def _assignment_download_url(storage_path: str) -> str | None:
    supabase = get_supabase_service_client()
    try:
        result = supabase.storage.from_(ASSIGNMENTS_BUCKET).create_signed_url(storage_path, 3600)
    except Exception:
        log.exception("Failed to generate download URL for %s", storage_path)
        return None
    if not result:
        return None
    url = (
        result.get("signedURL")
        or result.get("signed_url")
        or result.get("signedUrl")
        or result.get("url")
    )
    return url or None


@app.get("/assignments/<assignment_id>")
@require_auth
def get_assignment_endpoint(assignment_id: str) -> Any:
    if not _is_valid_uuid(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400
    assignment = get_assignment(assignment_id)
    if assignment is None:
        return jsonify({"error": "Assignment not found."}), 404
    if not can_student_access_assignment(assignment_id, g.user_id, g.user_role, assignment=assignment):
        return jsonify({"error": "Access denied"}), 403
    try:
        resolved_config = get_resolved_config(assignment_id, assignment=assignment)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    payload = dict(assignment)
    payload.pop("answer_key_storage_path", None)
    payload["resolved_config"] = resolved_config
    if assignment.get("prompt_storage_path"):
        payload["assignment_file_download_url"] = _assignment_download_url(assignment["prompt_storage_path"])
    return jsonify({"assignment": payload})


@app.get("/assignments/<assignment_id>/problems")
@require_auth
def get_assignment_problems(assignment_id: str) -> Any:
    if not _is_valid_uuid(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400
    assignment = get_assignment(assignment_id)
    if assignment is None:
        return jsonify({"error": "Assignment not found."}), 404
    if not can_student_access_assignment(assignment_id, g.user_id, g.user_role, assignment=assignment):
        return jsonify({"error": "Access denied"}), 403
    problems = assignment.get("problems", [])
    if not isinstance(problems, list):
        problems = []
    return jsonify({"problems": problems})


@app.get("/results/<assignment_id>")
@require_auth
def results_for_assignment(assignment_id: str) -> Any:
    if not _is_valid_uuid(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400
    results = get_assignment_results(student_id=g.user_id, assignment_id=assignment_id)
    return jsonify({"results": results})


@app.get("/results/<assignment_id>/<int:problem_num>")
@require_auth
def result_for_problem(assignment_id: str, problem_num: int) -> Any:
    if not _is_valid_uuid(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400
    result = get_result(student_id=g.user_id, assignment_id=assignment_id, problem_num=problem_num)
    if result is None:
        return jsonify({"error": "No result found."}), 404
    return jsonify({"result": result})


@app.post("/assignments/<assignment_id>/submit")
@require_auth
def submit_assignment(assignment_id: str) -> Any:
    if not _is_valid_uuid(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400
    assignment = get_assignment(assignment_id)
    if assignment is None:
        return jsonify({"error": "Assignment not found."}), 404
    if not can_student_access_assignment(assignment_id, g.user_id, g.user_role, assignment=assignment):
        return jsonify({"error": "Access denied"}), 403

    supabase = get_supabase_service_client()
    try:
        response = supabase.table("submissions").upsert({
            "assignment_id": assignment_id,
            "student_id": g.user_id,
            "submitted_at": "now()",
        }, on_conflict="assignment_id,student_id").execute()
        data = unwrap_supabase_data(response)
        if not data or not isinstance(data, list) or not data:
            raise RuntimeError("Submission insert failed.")
        submission = data[0]
        return jsonify({"success": True, "submission_id": submission.get("id")})
    except Exception as exc:
        log.error("Failed to submit assignment %s for %s: %s", assignment_id, g.user_id, exc, exc_info=True)
        return jsonify({"error": f"Submission failed: {exc}"}), 500


_chat_auth = require_auth_or_sample_chat(DEFAULT_ARTIFACT_OWNER_ID or "anonymous-sample")


@app.post("/chat")
@_chat_auth
def chat_send() -> Any:
    payload = request.get_json(silent=True) or {}
    assignment_id = str(payload.get("assignment_id", "")).strip()
    problem_num = payload.get("problem_num")
    message = str(payload.get("message", "")).strip()

    if not assignment_id or problem_num is None or not message:
        return jsonify({"error": "assignment_id, problem_num, and message are required."}), 400
    if len(message) > _CHAT_MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"Message too long. Maximum {_CHAT_MAX_MESSAGE_LENGTH} characters."}), 400
    if not _is_valid_assignment_identifier(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400

    if _is_chat_rate_limited(g.user_id):
        return jsonify({"error": "Rate limit exceeded. Max 10 messages per minute."}), 429

    try:
        parsed_problem_num = int(problem_num)
    except (TypeError, ValueError):
        return jsonify({"error": f"Invalid problem_num: {problem_num!r}"}), 400

    try:
        content = generate_chat_response(g.user_id, assignment_id, parsed_problem_num, message)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception:
        log.exception("Unexpected error in chat endpoint")
        return jsonify({"error": "Internal server error during chat."}), 500

    return jsonify({
        "role": "assistant",
        "content": content,
        "problem_num": parsed_problem_num,
        "assignment_id": assignment_id,
    })


@app.get("/chat/<assignment_id>/<int:problem_num>")
@_chat_auth
def chat_history(assignment_id: str, problem_num: int) -> Any:
    if not _is_valid_assignment_identifier(assignment_id):
        return jsonify({"error": "Invalid assignment_id format."}), 400
    try:
        messages = get_chat_history(g.user_id, assignment_id, problem_num)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception:
        return jsonify({"error": "Unable to load chat history."}), 500
    return jsonify({"messages": messages})


def _parse_capture_params(payload: Dict[str, Any]) -> CaptureRequestParams:
    image_b64 = str(payload.get("image", "")).strip()
    if not image_b64:
        raise ValueError("Missing required field: image")
    return {
        "image_b64": image_b64,
        "document_id": _sanitize_document_id(str(payload.get("documentId", "")).strip()),
        "sample_slug": str(payload.get("sample_slug", "")).strip(),
        "reference_tex": str(payload.get("reference_tex", "")).strip(),
        "context_tex": str(payload.get("context_tex", "")).strip(),
        "include_solution": str(payload.get("include_solution", "true")).lower() in {"true", "1", "yes"},
    }


def _resolve_sample_context(params: CaptureRequestParams) -> tuple[str, str, str]:
    sample_slug = params["sample_slug"] or _document_to_sample_slug(params["document_id"])
    reference_tex = params["reference_tex"]
    context_tex = params["context_tex"]
    if reference_tex and context_tex:
        return (sample_slug, reference_tex, context_tex)
    loaded_context, loaded_solution = _load_sample_reference_context(sample_slug)
    return (
        sample_slug,
        reference_tex or loaded_solution,
        context_tex or loaded_context,
    )


def _build_capture_context(params: CaptureRequestParams) -> CaptureContext:
    owner_id = _resolve_capture_owner_id()
    image_bytes = _decode_capture_image_base64(params["image_b64"])
    media_type = _infer_image_media_type(image_bytes)
    sample_slug, reference_tex, context_tex = _resolve_sample_context(params)
    return {
        "owner_id": owner_id,
        "image_bytes": image_bytes,
        "media_type": media_type,
        "document_id": params["document_id"],
        "sample_slug": sample_slug,
        "reference_tex": reference_tex,
        "context_tex": context_tex,
        "include_solution": params["include_solution"],
    }


def _is_capture_auth_error(message: str) -> bool:
    lowered = message.lower()
    return "bearer token" in lowered or message.startswith("Missing owner identity.")


def _capture_basename(context: CaptureContext) -> str:
    return context["document_id"] or "capture"


def _capture_metadata(context: CaptureContext, stage: str) -> Dict[str, str]:
    return {
        "document_id": context["document_id"],
        "sample_slug": context["sample_slug"],
        "stage": stage,
    }


def _store_capture_screenshot(context: CaptureContext) -> str:
    basename = _capture_basename(context)
    screenshot = create_artifact_from_bytes(
        owner_id=context["owner_id"],
        artifact_type="screenshot",
        content_bytes=context["image_bytes"],
        display_name=f"{basename}-screenshot{_mime_to_extension(context['media_type'])}",
        mime_type=context["media_type"],
        metadata=_capture_metadata(context, "capture"),
    )
    return str(screenshot["id"])


def _store_capture_ocr_latex(context: CaptureContext, student_tex: str) -> str:
    basename = _capture_basename(context)
    ocr_latex = create_latex_artifact_from_content(
        owner_id=context["owner_id"],
        content=student_tex,
        display_name=f"{basename}-student-ocr.tex",
        metadata=_capture_metadata(context, "student_ocr"),
    )
    return str(ocr_latex["id"])


def _store_capture_revised_latex(context: CaptureContext, annotated_tex: str) -> str:
    basename = _capture_basename(context)
    revised_latex = create_latex_artifact_from_content(
        owner_id=context["owner_id"],
        content=annotated_tex,
        display_name=f"{basename}-revised-annotated.tex",
        metadata=_capture_metadata(context, "revised_annotated"),
    )
    return str(revised_latex["id"])


def _run_capture_analysis(student_tex: str, context: CaptureContext) -> tuple[str, str]:
    if not context["reference_tex"] or not context["context_tex"]:
        return (student_tex, "")
    analyzer = MistakeAnalyzer(
        analysis_model=MISTAKE_ANALYSIS_MODEL,
        use_extended_thinking=_mistake_analysis_thinking_enabled(),
    )
    result = analyzer.run(
        student_tex=student_tex,
        reference_tex=context["reference_tex"],
        context_tex=context["context_tex"],
        include_solution=context["include_solution"],
    )
    return (result["annotated_tex"], result["continuation_tex"])


def _store_capture_continuation(context: CaptureContext, continuation_tex: str) -> None:
    if not continuation_tex:
        return
    basename = _capture_basename(context)
    try:
        create_latex_artifact_from_content(
            owner_id=context["owner_id"],
            content=continuation_tex,
            display_name=f"{basename}-revised-continuation.tex",
            metadata=_capture_metadata(context, "revised_continuation"),
        )
    except Exception as exc:
        log.error("Failed to store continuation artifact: %s", exc, exc_info=True)


def _extract_capture_mistakes(
    context: CaptureContext, annotated_tex: str, artifact_ids: CaptureArtifactIds
) -> tuple[List[Dict[str, Any]], Dict[str, Any] | None]:
    if not _has_mistake_annotations(annotated_tex):
        return ([], None)
    try:
        coords_payload = _run_mistake_coord_pipeline(
            image_bytes=context["image_bytes"],
            latex=annotated_tex,
            media_type=context["media_type"],
        )
        mistakes = coords_payload.get("mistakes", [])
    except (ValueError, RuntimeError) as exc:
        log.warning("Capture coord pipeline failed: %s", exc)
        return ([], None)
    except Exception as exc:
        log.error("Mistake coord pipeline failed: %s", exc, exc_info=True)
        return ([], None)
    try:
        coord_run = create_coord_run(
            owner_id=context["owner_id"],
            screenshot_artifact_id=artifact_ids["screenshot_artifact_id"],
            latex_artifact_id=artifact_ids["revised_latex_artifact_id"],
            result=coords_payload,
        )
    except Exception as exc:
        log.error("Failed to create coord run: %s", exc, exc_info=True)
        coord_run = None
    return (mistakes, coord_run)


@app.post("/api/capture")
def capture_pipeline() -> Any:
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY not configured"}), 503

    try:
        params = _parse_capture_params(request.get_json(silent=True) or {})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        context = _build_capture_context(params)
    except ValueError as exc:
        if _is_capture_auth_error(str(exc)):
            return jsonify({"error": str(exc)}), 401
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unable to load sample worksheet context: {exc}"}), 502

    try:
        student_tex = _image_bytes_to_latex(context["image_bytes"])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Image-to-latex failed: {exc}"}), 502

    try:
        annotated_tex, continuation_tex = _run_capture_analysis(student_tex, context)
    except ValueError as exc:
        return jsonify({"error": f"Analysis failed: {exc}"}), 400
    except Exception as exc:
        return jsonify({"error": f"Analysis failed: {exc}"}), 502

    try:
        screenshot_artifact_id = _store_capture_screenshot(context)
    except Exception as exc:
        return jsonify({"error": f"Unable to store screenshot artifact: {exc}"}), 502

    try:
        ocr_latex_artifact_id = _store_capture_ocr_latex(context, student_tex)
    except Exception as exc:
        return jsonify({"error": f"Unable to store OCR latex artifact: {exc}"}), 502

    try:
        revised_latex_artifact_id = _store_capture_revised_latex(context, annotated_tex)
    except Exception as exc:
        return jsonify({"error": f"Unable to store revised latex artifact: {exc}"}), 502

    artifact_ids: CaptureArtifactIds = {
        "screenshot_artifact_id": screenshot_artifact_id,
        "ocr_latex_artifact_id": ocr_latex_artifact_id,
        "revised_latex_artifact_id": revised_latex_artifact_id,
    }
    _store_capture_continuation(context, continuation_tex)
    mistakes, coord_run = _extract_capture_mistakes(context, annotated_tex, artifact_ids)

    return jsonify(
        {
            "success": True,
            "student_tex": student_tex,
            "annotated_tex": annotated_tex,
            "continuation_tex": continuation_tex,
            "mistakes": mistakes,
            "artifacts": artifact_ids,
            "coord_run_id": coord_run["id"] if isinstance(coord_run, dict) and coord_run.get("id") else None,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)

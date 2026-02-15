import logging
import os
import re
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

log = logging.getLogger(__name__)

from supabase_service import get_supabase_service_client, get_supabase_settings, unwrap_supabase_data

VALID_ARTIFACT_TYPES = {"latex", "screenshot", "prompt", "answer_key", "submission", "context", "other"}
LATEX_EXTENSIONS = {".tex", ".txt", ".latex"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def _sanitize_filename(filename: str) -> str:
    base = os.path.basename(filename.strip())
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return sanitized or "artifact"


def _extract_storage_response(response: Any) -> Dict[str, Any]:
    if isinstance(response, dict):
        return response
    if hasattr(response, "model_dump"):
        dumped = response.model_dump()
        if isinstance(dumped, dict):
            return dumped
    return {}


def _extract_signed_url(upload_response: Dict[str, Any]) -> Optional[str]:
    return (
        upload_response.get("signed_url")
        or upload_response.get("signedURL")
        or upload_response.get("url")
        or upload_response.get("signedUrl")
    )


def _extract_token(upload_response: Dict[str, Any]) -> Optional[str]:
    return upload_response.get("token")


def _validate_artifact_payload(artifact_type: str, filename: str, mime_type: str) -> None:
    if artifact_type not in VALID_ARTIFACT_TYPES:
        raise ValueError(f"artifact_type must be one of: {sorted(VALID_ARTIFACT_TYPES)}")

    lower_name = filename.lower()
    ext = os.path.splitext(lower_name)[1]
    if artifact_type == "latex" and ext not in LATEX_EXTENSIONS:
        raise ValueError("latex uploads must use one of: .tex, .txt, .latex")
    if artifact_type == "screenshot":
        if ext not in IMAGE_EXTENSIONS:
            raise ValueError("screenshot uploads must use one of: .png, .jpg, .jpeg, .webp")
        if mime_type and not mime_type.startswith("image/"):
            raise ValueError("screenshot uploads must use an image/* mime_type")


def _content_hash(content_bytes: bytes) -> str:
    return hashlib.sha256(content_bytes).hexdigest()[:24]


def _find_artifact_by_storage_path(owner_id: str, storage_path: str) -> Optional[Dict[str, Any]]:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    response = (
        supabase.table(settings.artifacts_table)
        .select("*")
        .eq("owner_id", owner_id)
        .eq("storage_path", storage_path)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


def create_artifact_upload(
    owner_id: str,
    artifact_type: str,
    filename: str,
    mime_type: str,
    byte_size: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    filename = _sanitize_filename(filename)
    mime_type = (mime_type or "").strip()
    metadata = metadata or {}
    _validate_artifact_payload(artifact_type=artifact_type, filename=filename, mime_type=mime_type)

    if byte_size is not None and byte_size < 0:
        raise ValueError("byte_size must be >= 0")

    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    artifact_id = str(uuid4())
    storage_path = f"{owner_id}/{artifact_type}/{artifact_id}_{filename}"

    signed_upload = supabase.storage.from_(settings.artifacts_bucket).create_signed_upload_url(storage_path)
    signed_upload_payload = _extract_storage_response(signed_upload)
    signed_url = _extract_signed_url(signed_upload_payload)
    if not signed_url:
        raise RuntimeError("Supabase did not return a signed upload URL.")

    record = {
        "id": artifact_id,
        "owner_id": owner_id,
        "artifact_type": artifact_type,
        "display_name": filename,
        "mime_type": mime_type or None,
        "byte_size": byte_size,
        "storage_bucket": settings.artifacts_bucket,
        "storage_path": storage_path,
        "metadata": metadata,
        "uploaded_at": None,
    }

    insert_response = supabase.table(settings.artifacts_table).insert(record).execute()
    inserted_rows = unwrap_supabase_data(insert_response) or []
    inserted = inserted_rows[0] if isinstance(inserted_rows, list) and inserted_rows else record

    return {
        "artifact": inserted,
        "upload": {
            "bucket": settings.artifacts_bucket,
            "path": storage_path,
            "signed_url": signed_url,
            "token": _extract_token(signed_upload_payload),
        },
    }


def get_artifact(owner_id: str, artifact_id: str) -> Optional[Dict[str, Any]]:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    response = (
        supabase.table(settings.artifacts_table)
        .select("*")
        .eq("owner_id", owner_id)
        .eq("id", artifact_id)
        .limit(1)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


def mark_artifact_uploaded(owner_id: str, artifact_id: str) -> Dict[str, Any]:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    updated_at = datetime.now(timezone.utc).isoformat()

    response = (
        supabase.table(settings.artifacts_table)
        .update({"uploaded_at": updated_at})
        .eq("owner_id", owner_id)
        .eq("id", artifact_id)
        .execute()
    )
    rows = unwrap_supabase_data(response) or []
    if isinstance(rows, list) and rows:
        return rows[0]

    artifact = get_artifact(owner_id=owner_id, artifact_id=artifact_id)
    if artifact is None:
        raise ValueError("Artifact not found for user.")
    return artifact


def get_signed_download_url(storage_path: str) -> str:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    response = supabase.storage.from_(settings.artifacts_bucket).create_signed_url(
        storage_path, settings.signed_url_ttl_seconds
    )
    payload = _extract_storage_response(response)
    signed_url = _extract_signed_url(payload)
    if not signed_url:
        raise RuntimeError("Supabase did not return a signed download URL.")
    return signed_url


def list_artifacts(owner_id: str, artifact_type: Optional[str], limit: int) -> List[Dict[str, Any]]:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    query = supabase.table(settings.artifacts_table).select("*").eq("owner_id", owner_id).order("created_at", desc=True)
    if artifact_type:
        query = query.eq("artifact_type", artifact_type)
    query = query.limit(limit)
    rows = unwrap_supabase_data(query.execute()) or []
    if not isinstance(rows, list):
        return []

    enriched: List[Dict[str, Any]] = []
    for row in rows:
        if row.get("uploaded_at"):
            try:
                row["download_url"] = get_signed_download_url(row["storage_path"])
            except Exception as exc:
                log.warning("Failed to generate download URL for %s: %s", row.get("storage_path"), exc)
                row["download_url"] = None
        else:
            row["download_url"] = None
        enriched.append(row)
    return enriched


def download_artifact_bytes(storage_path: str) -> bytes:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    raw = supabase.storage.from_(settings.artifacts_bucket).download(storage_path)
    if isinstance(raw, bytes):
        return raw
    if isinstance(raw, bytearray):
        return bytes(raw)
    if isinstance(raw, dict) and isinstance(raw.get("data"), (bytes, bytearray)):
        data = raw["data"]
        return bytes(data) if isinstance(data, bytearray) else data
    data_attr = getattr(raw, "data", None)
    if isinstance(data_attr, (bytes, bytearray)):
        return bytes(data_attr) if isinstance(data_attr, bytearray) else data_attr
    raise RuntimeError("Unable to download artifact bytes from Supabase Storage.")


def create_latex_artifact_from_content(
    owner_id: str,
    content: str,
    display_name: str = "extracted.tex",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a latex artifact and upload content directly. Used by screenshot-to-latex flow."""
    display_name = _sanitize_filename(display_name)
    if not display_name.lower().endswith((".tex", ".txt", ".latex")):
        display_name = f"{display_name}.tex"
    metadata = metadata or {}

    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    content_bytes = content.encode("utf-8")
    content_hash = _content_hash(content_bytes)
    storage_path = f"{owner_id}/latex/{content_hash}_{display_name}"
    updated_at = datetime.now(timezone.utc).isoformat()
    existing = _find_artifact_by_storage_path(owner_id=owner_id, storage_path=storage_path)
    if existing is not None:
        return existing

    try:
        supabase.storage.from_(settings.artifacts_bucket).upload(
            storage_path, content_bytes, file_options={"content-type": "text/plain; charset=utf-8"}
        )
    except Exception:
        existing = _find_artifact_by_storage_path(owner_id=owner_id, storage_path=storage_path)
        if existing is not None:
            return existing
        raise

    record = {
        "id": str(uuid4()),
        "owner_id": owner_id,
        "artifact_type": "latex",
        "display_name": display_name,
        "mime_type": "text/plain",
        "byte_size": len(content_bytes),
        "storage_bucket": settings.artifacts_bucket,
        "storage_path": storage_path,
        "metadata": metadata,
        "uploaded_at": updated_at,
    }
    response = supabase.table(settings.artifacts_table).insert(record).execute()
    rows = unwrap_supabase_data(response) or []
    return rows[0] if isinstance(rows, list) and rows else record


def create_artifact_from_bytes(
    owner_id: str,
    artifact_type: str,
    content_bytes: bytes,
    display_name: str,
    mime_type: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    display_name = _sanitize_filename(display_name)
    mime_type = (mime_type or "").strip()
    metadata = metadata or {}
    _validate_artifact_payload(artifact_type=artifact_type, filename=display_name, mime_type=mime_type)

    if not content_bytes:
        raise ValueError("Artifact content cannot be empty.")

    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    content_hash = _content_hash(content_bytes)
    storage_path = f"{owner_id}/{artifact_type}/{content_hash}_{display_name}"
    updated_at = datetime.now(timezone.utc).isoformat()
    existing = _find_artifact_by_storage_path(owner_id=owner_id, storage_path=storage_path)
    if existing is not None:
        return existing

    upload_options: Dict[str, str] = {}
    if mime_type:
        upload_options["content-type"] = mime_type
    try:
        supabase.storage.from_(settings.artifacts_bucket).upload(storage_path, content_bytes, file_options=upload_options)
    except Exception:
        existing = _find_artifact_by_storage_path(owner_id=owner_id, storage_path=storage_path)
        if existing is not None:
            return existing
        raise

    record = {
        "id": str(uuid4()),
        "owner_id": owner_id,
        "artifact_type": artifact_type,
        "display_name": display_name,
        "mime_type": mime_type or None,
        "byte_size": len(content_bytes),
        "storage_bucket": settings.artifacts_bucket,
        "storage_path": storage_path,
        "metadata": metadata,
        "uploaded_at": updated_at,
    }
    response = supabase.table(settings.artifacts_table).insert(record).execute()
    rows = unwrap_supabase_data(response) or []
    return rows[0] if isinstance(rows, list) and rows else record


def create_coord_run(owner_id: str, screenshot_artifact_id: str, latex_artifact_id: str, result: Dict[str, Any]) -> Dict[str, Any]:
    settings = get_supabase_settings()
    supabase = get_supabase_service_client()
    payload = {
        "id": str(uuid4()),
        "owner_id": owner_id,
        "screenshot_artifact_id": screenshot_artifact_id,
        "latex_artifact_id": latex_artifact_id,
        "result": result,
    }
    response = supabase.table(settings.coord_runs_table).insert(payload).execute()
    rows = unwrap_supabase_data(response) or []
    if isinstance(rows, list) and rows:
        return rows[0]
    return payload

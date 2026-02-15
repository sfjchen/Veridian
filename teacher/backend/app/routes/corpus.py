import logging
import uuid
from typing import Any

from flask import Blueprint, Response, g, jsonify, request
from postgrest.exceptions import APIError
from supabase import Client

from app.middleware.auth import require_auth, require_role
from app.services.live_monitoring import validate_uuid
from app.services.storage import (
    delete_object,
    generate_download_url,
    generate_upload_url,
    move_object,
    upload_file_bytes,
)
from app.services.supabase_client import get_supabase_admin_client
from app.services.conversion_orchestrator import (
    ConversionError,
    create_orchestrator,
)

log = logging.getLogger(__name__)

corpus_bp = Blueprint("corpus", __name__)

CORPUS_BUCKET = "corpus"
ALLOWED_FILE_TYPES = frozenset({"pdf", "txt", "docx", "doc", "md", "tex", "rtf", "csv", "json", "ipynb"})
MAX_DISPLAY_NAME_LENGTH = 300  # DB column limit; matches frontend validation


def _normalize_folder_path(raw_value: Any) -> str:
    if raw_value is None:
        return ""
    if not isinstance(raw_value, str):
        raise ValueError("folder_path must be a string")
    stripped = raw_value.strip().strip("/")
    if not stripped:
        return ""
    if "//" in stripped:
        raise ValueError("folder_path cannot contain consecutive slashes")
    parts = [part.strip() for part in stripped.split("/") if part.strip()]
    for part in parts:
        if part in {".", ".."} or ".." in part:
            raise ValueError("folder_path cannot contain parent directory traversal")
    return "/".join(parts)


def _storage_components(classroom_id: str, storage_path: str) -> tuple[str, str]:
    prefix = classroom_id + "/"
    if not storage_path.startswith(prefix):
        raise ValueError(f"storage_path {storage_path!r} does not match classroom {classroom_id!r}")
    relative_path = storage_path[len(prefix):]
    if "/" not in relative_path:
        return "", relative_path
    folder_path, filename = relative_path.rsplit("/", 1)
    return folder_path, filename


def _build_storage_path(classroom_id: str, file_id: str, file_type: str, folder_path: str) -> str:
    filename = f"{file_id}.{file_type.lower()}"
    if folder_path:
        return f"{classroom_id}/{folder_path}/{filename}"
    return f"{classroom_id}/{filename}"


def _rollback_storage_move(
    file_id: str, new_path: str, old_path: str,
) -> tuple[Response, int] | None:
    try:
        move_object(CORPUS_BUCKET, new_path, old_path)
        return None
    except ValueError:
        log.exception("CRITICAL: Failed to rollback storage move %s -> %s", new_path, old_path)
        return jsonify({
            "error": "Storage rollback failed; manual intervention required",
            "file_id": file_id,
        }), 500


def _teacher_owns_classroom(client: Client, classroom_id: str, teacher_id: str) -> bool:
    result = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", teacher_id).limit(1).execute()
    return bool(result.data)


def _user_can_access_classroom(client: Client, classroom_id: str) -> bool:
    if g.user_role == "teacher":
        return _teacher_owns_classroom(client, classroom_id, g.user_id)
    membership = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).eq("student_id", g.user_id).limit(1).execute()
    return bool(membership.data)


def _base_file_metadata(file_record: dict[str, Any]) -> dict[str, Any]:
    file_copy = dict(file_record)
    classroom_id = str(file_copy["classroom_id"])
    storage_path = file_copy.get("storage_path")
    if storage_path:
        folder_path, filename = _storage_components(classroom_id, storage_path)
        file_copy["folder_path"] = folder_path
        file_copy["file_name"] = filename
    else:
        file_copy["folder_path"] = ""
        file_copy["file_name"] = ""
    file_copy["date_uploaded"] = file_copy.get("uploaded_at")
    return file_copy


def _serialize_file(file_record: dict[str, Any]) -> dict[str, Any]:
    file_copy = _base_file_metadata(file_record)
    storage_path = file_copy.get("storage_path")
    if storage_path:
        try:
            file_copy["download_url"] = generate_download_url(CORPUS_BUCKET, storage_path)
        except Exception as exc:
            log.exception("Failed to generate corpus download URL for %s", storage_path)
            file_copy["download_url"] = None
            file_copy["download_url_error"] = str(exc)
    else:
        file_copy["download_url"] = None
        file_copy["download_url_error"] = "File was not uploaded"
    return file_copy


def _build_corpus_tree(file_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    folders: dict[str, dict[str, Any]] = {
        "": {"type": "folder", "name": "", "path": "", "children": []},
    }

    def ensure_folder(path: str) -> dict[str, Any]:
        if path in folders:
            return folders[path]
        parent_path = path.rsplit("/", 1)[0] if "/" in path else ""
        folder = {
            "type": "folder",
            "name": path.split("/")[-1],
            "path": path,
            "children": [],
        }
        folders[path] = folder
        ensure_folder(parent_path)["children"].append(folder)
        return folder

    for file_record in file_records:
        serialized = _base_file_metadata(file_record)
        folder_path = serialized["folder_path"]
        folder_node = ensure_folder(folder_path)
        folder_node["children"].append({
            "type": "file",
            "id": serialized["id"],
            "display_name": serialized["display_name"],
            "file_type": serialized["file_type"],
            "uploaded_at": serialized["uploaded_at"],
            "path": serialized["storage_path"],
            "folder_path": serialized["folder_path"],
        })

    def sort_tree(node: dict[str, Any]) -> None:
        children = node.get("children", [])
        children.sort(
            key=lambda item: (
                0 if item.get("type") == "folder" else 1,
                item.get("name") or item.get("display_name", ""),
            ),
        )
        for child in children:
            if child.get("type") == "folder":
                sort_tree(child)

    root = folders[""]
    sort_tree(root)
    return root["children"]


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["POST"])
@require_role("teacher")
def create_corpus_file(classroom_id: str) -> tuple[Response, int]:
    if not validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "display_name and file_type required"}), 400

    display_name = str(data.get("display_name", "")).strip()
    file_type = str(data.get("file_type", "")).strip().lower()
    has_file = bool(data.get("has_file", False))

    if not display_name or not file_type:
        return jsonify({"error": "display_name and file_type required"}), 400
    if len(display_name) > MAX_DISPLAY_NAME_LENGTH:
        return jsonify({"error": f"display_name must be <= {MAX_DISPLAY_NAME_LENGTH} characters"}), 400
    if file_type not in ALLOWED_FILE_TYPES:
        allowed = ", ".join(sorted(ALLOWED_FILE_TYPES))
        return jsonify({"error": f"file_type must be one of: {allowed}"}), 400

    try:
        folder_path = _normalize_folder_path(data.get("folder_path"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    client = get_supabase_admin_client()
    if not _teacher_owns_classroom(client, classroom_id, g.user_id):
        return jsonify({"error": "Classroom not found"}), 404

    file_id = str(uuid.uuid4())
    storage_path = _build_storage_path(classroom_id, file_id, file_type, folder_path) if has_file else None

    insert_data: dict[str, Any] = {
        "id": file_id,
        "classroom_id": classroom_id,
        "display_name": display_name,
        "file_type": file_type,
    }
    if storage_path:
        insert_data["storage_path"] = storage_path

    try:
        record = client.table("corpus_files").insert(insert_data).execute()
    except APIError:
        log.exception("Failed to insert corpus file")
        return jsonify({"error": "Failed to create corpus file"}), 500

    if not record.data:
        return jsonify({"error": "Failed to create corpus file"}), 500

    response: dict[str, Any] = {**_serialize_file(record.data[0])}

    if storage_path:
        try:
            response["upload_url"] = generate_upload_url(CORPUS_BUCKET, storage_path)
        except Exception:
            log.exception("Failed to generate upload URL for corpus file %s", file_id)
            try:
                client.table("corpus_files").delete().eq("id", file_id).execute()
            except Exception:
                log.exception("Failed to clean up orphaned corpus_file %s", file_id)
                return jsonify({"error": "Failed to generate upload URL", "orphaned_file_id": file_id}), 500
            return jsonify({"error": "Failed to generate upload URL"}), 500

    return jsonify(response), 201


@corpus_bp.route("/classrooms/<classroom_id>/corpus/upload-pdf", methods=["POST"])
@require_role("teacher")
def upload_pdf_corpus(classroom_id: str) -> tuple[Response, int]:
    """
    Upload PDF corpus file with automatic LaTeX conversion.

    Expects multipart/form-data with:
    - file: PDF file
    - display_name: Display name for the file
    - folder_path (optional): Folder path within corpus
    """
    if not validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    # Validate file upload
    if "file" not in request.files:
        return jsonify({"error": "File is required"}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "File is required"}), 400

    # Validate file type (must be PDF)
    filename = uploaded_file.filename.lower()
    if not filename.endswith(".pdf"):
        return jsonify({"error": "File must be PDF"}), 400

    # Read file bytes
    try:
        file_bytes = uploaded_file.read()
    except Exception:
        log.exception("Failed to read uploaded file")
        return jsonify({"error": "Failed to read file"}), 500

    if not file_bytes:
        return jsonify({"error": "Empty file"}), 400

    # Validate display_name
    display_name = request.form.get("display_name", "").strip()
    if not display_name:
        return jsonify({"error": "display_name is required"}), 400
    if len(display_name) > MAX_DISPLAY_NAME_LENGTH:
        return jsonify({"error": f"display_name must be <= {MAX_DISPLAY_NAME_LENGTH} characters"}), 400

    # Parse optional folder_path
    folder_path_raw = request.form.get("folder_path")
    try:
        folder_path = _normalize_folder_path(folder_path_raw)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    client = get_supabase_admin_client()
    if not _teacher_owns_classroom(client, classroom_id, g.user_id):
        return jsonify({"error": "Classroom not found"}), 404

    # Generate file ID and storage path
    file_id = str(uuid.uuid4())
    storage_path = _build_storage_path(classroom_id, file_id, "pdf", folder_path)

    # Convert PDF to LaTeX
    orchestrator = create_orchestrator()
    try:
        result = orchestrator.process_corpus(
            corpus_file_id=file_id,
            file_bytes=file_bytes,
        )
    except ConversionError as e:
        log.exception("PDF conversion failed for corpus file %s", file_id)
        return jsonify({
            "error": "Failed to convert PDF to LaTeX",
            "detail": str(e),
        }), 422

    # Upload original PDF
    try:
        upload_file_bytes(CORPUS_BUCKET, storage_path, file_bytes)
    except ValueError:
        log.exception("Failed to upload PDF for corpus file %s", file_id)
        return jsonify({"error": "Failed to upload file"}), 500

    # Create corpus file record with LaTeX content
    try:
        record = client.table("corpus_files").insert({
            "id": file_id,
            "classroom_id": classroom_id,
            "display_name": display_name,
            "storage_path": storage_path,
            "file_type": "pdf",
            "latex_content": result.latex_content,
        }).execute()
    except APIError:
        log.exception("Failed to insert corpus file")
        # Clean up uploaded file
        try:
            delete_object(CORPUS_BUCKET, storage_path)
        except Exception:
            log.exception("Failed to clean up uploaded file after insert failure")
        return jsonify({"error": "Failed to create corpus file"}), 500

    if not record.data:
        # Clean up uploaded file
        try:
            delete_object(CORPUS_BUCKET, storage_path)
        except Exception:
            log.exception("Failed to clean up uploaded file after insert failure")
        return jsonify({"error": "Failed to create corpus file"}), 500

    return jsonify(_serialize_file(record.data[0])), 201


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["GET"])
@require_auth
def list_corpus_files(classroom_id: str) -> tuple[Response, int]:
    if not validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()
    if not _user_can_access_classroom(client, classroom_id):
        return jsonify({"error": "Classroom not found or access denied"}), 404

    files = client.table("corpus_files").select("*").eq(
        "classroom_id", classroom_id
    ).order("uploaded_at", desc=True).execute()
    return jsonify([_serialize_file(record) for record in files.data]), 200


@corpus_bp.route("/classrooms/<classroom_id>/corpus/tree", methods=["GET"])
@require_auth
def get_corpus_tree(classroom_id: str) -> tuple[Response, int]:
    if not validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()
    if not _user_can_access_classroom(client, classroom_id):
        return jsonify({"error": "Classroom not found or access denied"}), 404

    files = client.table("corpus_files").select("*").eq(
        "classroom_id", classroom_id
    ).order("uploaded_at", desc=True).execute()
    return jsonify({
        "classroom_id": classroom_id,
        "tree": _build_corpus_tree(files.data),
    }), 200


@corpus_bp.route("/corpus/<file_id>", methods=["GET"])
@require_auth
def get_corpus_file(file_id: str) -> tuple[Response, int]:
    if not validate_uuid(file_id):
        return jsonify({"error": "Invalid file ID"}), 400

    client = get_supabase_admin_client()
    file_result = client.table("corpus_files").select("*").eq("id", file_id).limit(1).execute()
    if not file_result.data:
        return jsonify({"error": "File not found"}), 404

    file_record = file_result.data[0]
    classroom_id = file_record["classroom_id"]
    if not _user_can_access_classroom(client, classroom_id):
        return jsonify({"error": "Access denied"}), 403
    return jsonify(_serialize_file(file_record)), 200


@corpus_bp.route("/corpus/<file_id>", methods=["PATCH"])
@require_role("teacher")
def update_corpus_file(file_id: str) -> tuple[Response, int]:
    if not validate_uuid(file_id):
        return jsonify({"error": "Invalid file ID"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    client = get_supabase_admin_client()
    file_result = client.table("corpus_files").select("*").eq("id", file_id).limit(1).execute()
    if not file_result.data:
        return jsonify({"error": "File not found"}), 404

    file_record = file_result.data[0]
    classroom_id = file_record["classroom_id"]
    if not _teacher_owns_classroom(client, classroom_id, g.user_id):
        return jsonify({"error": "Access denied"}), 403

    updates: dict[str, Any] = {}
    if "display_name" in data:
        display_name = str(data.get("display_name", "")).strip()
        if not display_name:
            return jsonify({"error": "display_name cannot be empty"}), 400
        if len(display_name) > MAX_DISPLAY_NAME_LENGTH:
            return jsonify({"error": f"display_name must be <= {MAX_DISPLAY_NAME_LENGTH} characters"}), 400
        updates["display_name"] = display_name

    old_storage_path = file_record.get("storage_path")
    new_storage_path = old_storage_path
    if "folder_path" in data:
        if not old_storage_path:
            return jsonify({"error": "Cannot move file that was never uploaded"}), 400
        try:
            folder_path = _normalize_folder_path(data.get("folder_path"))
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        new_storage_path = _build_storage_path(
            classroom_id=classroom_id,
            file_id=file_record["id"],
            file_type=file_record["file_type"],
            folder_path=folder_path,
        )
        if new_storage_path != old_storage_path:
            try:
                move_object(CORPUS_BUCKET, old_storage_path, new_storage_path)
            except ValueError:
                log.exception("Failed to move corpus object from %s to %s", old_storage_path, new_storage_path)
                return jsonify({"error": "Failed to move corpus file in storage"}), 500
            updates["storage_path"] = new_storage_path

    if not updates:
        return jsonify({"error": "No changes detected"}), 400

    try:
        updated = client.table("corpus_files").update(updates).eq("id", file_id).execute()
    except APIError as e:
        if updates.get("storage_path") and old_storage_path != new_storage_path:
            rollback_resp = _rollback_storage_move(file_id, new_storage_path, old_storage_path)
            if rollback_resp is not None:
                return rollback_resp
        log.exception("Failed to update corpus file %s", file_id)
        return jsonify({"error": "Failed to update corpus file"}), 500

    if not updated.data:
        if updates.get("storage_path") and old_storage_path != new_storage_path:
            rollback_resp = _rollback_storage_move(file_id, new_storage_path, old_storage_path)
            if rollback_resp is not None:
                return rollback_resp
        return jsonify({"error": "File not found"}), 404
    return jsonify(_serialize_file(updated.data[0])), 200


@corpus_bp.route("/corpus/<file_id>", methods=["DELETE"])
@require_role("teacher")
def delete_corpus_file(file_id: str) -> tuple[Response, int]:
    if not validate_uuid(file_id):
        return jsonify({"error": "Invalid file ID"}), 400

    client = get_supabase_admin_client()
    file_result = client.table("corpus_files").select("*").eq("id", file_id).limit(1).execute()
    if not file_result.data:
        return jsonify({"error": "File not found"}), 404

    file_record = file_result.data[0]
    classroom_id = file_record["classroom_id"]
    if not _teacher_owns_classroom(client, classroom_id, g.user_id):
        return jsonify({"error": "Access denied"}), 403

    try:
        deleted = client.table("corpus_files").delete().eq("id", file_id).execute()
    except APIError:
        log.exception("Failed to delete corpus file record %s", file_id)
        return jsonify({"error": "Failed to delete file record"}), 500
    if not deleted.data:
        return jsonify({"error": "File not found"}), 404

    storage_path = file_record.get("storage_path")
    if storage_path:
        try:
            delete_object(CORPUS_BUCKET, storage_path)
        except ValueError:
            log.exception("DB deleted but storage cleanup failed for %s", file_id)
    return Response(status=204)

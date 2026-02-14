import sys
import uuid
from typing import Any

from flask import Blueprint, Response, g, jsonify, request
from postgrest.exceptions import APIError
from supabase import Client

from app.middleware.auth import require_auth, require_role
from app.services.storage import delete_object, generate_download_url, generate_upload_url, move_object
from app.services.supabase_client import get_supabase_admin_client

corpus_bp = Blueprint("corpus", __name__)

CORPUS_BUCKET = "corpus"
ALLOWED_FILE_TYPES = {"pdf", "txt", "docx", "doc", "md", "tex", "rtf", "csv", "json", "ipynb"}
MAX_DISPLAY_NAME_LENGTH = 300


def _validate_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def _normalize_folder_path(raw_value: Any) -> str:
    if raw_value is None:
        return ""
    if not isinstance(raw_value, str):
        raise ValueError("folder_path must be a string")
    stripped = raw_value.strip().strip("/")
    if not stripped:
        return ""
    parts = [part.strip() for part in stripped.split("/") if part.strip()]
    for part in parts:
        if part in {".", ".."} or ".." in part:
            raise ValueError("folder_path cannot contain parent directory traversal")
    return "/".join(parts)


def _storage_components(classroom_id: str, storage_path: str) -> tuple[str, str]:
    prefix = classroom_id + "/"
    relative_path = storage_path[len(prefix):] if storage_path.startswith(prefix) else storage_path
    if "/" not in relative_path:
        return "", relative_path
    folder_path, filename = relative_path.rsplit("/", 1)
    return folder_path, filename


def _build_storage_path(classroom_id: str, file_id: str, file_type: str, folder_path: str) -> str:
    filename = f"{file_id}.{file_type.lower()}"
    if folder_path:
        return f"{classroom_id}/{folder_path}/{filename}"
    return f"{classroom_id}/{filename}"


def _teacher_owns_classroom(client: Client, classroom_id: str, teacher_id: str) -> bool:
    result = client.table("classrooms").select("id").eq(
        "id", classroom_id
    ).eq("teacher_id", teacher_id).limit(1).execute()
    return bool(result.data)


def _user_can_access_classroom(
    client: Client, classroom_id: str, user_id: str, user_role: str,
) -> bool:
    if user_role == "teacher":
        return _teacher_owns_classroom(client, classroom_id, user_id)
    membership = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).eq("student_id", user_id).limit(1).execute()
    return bool(membership.data)


def _base_file_metadata(file_record: dict[str, Any]) -> dict[str, Any]:
    file_copy = dict(file_record)
    classroom_id = str(file_copy.get("classroom_id") or "")
    storage_path = str(file_copy.get("storage_path") or "")
    folder_path, filename = _storage_components(classroom_id, storage_path)
    file_copy["folder_path"] = folder_path
    file_copy["file_name"] = filename
    file_copy["date_uploaded"] = file_copy.get("uploaded_at")
    return file_copy


def _serialize_file(file_record: dict[str, Any]) -> dict[str, Any]:
    file_copy = _base_file_metadata(file_record)
    storage_path = str(file_copy.get("storage_path") or "")
    try:
        file_copy["download_url"] = generate_download_url(CORPUS_BUCKET, storage_path)
    except Exception as e:
        print(f"Failed to generate corpus download URL for {storage_path}: {e}", file=sys.stderr)
        file_copy["download_url"] = None
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
            key=lambda item: (item.get("type") != "folder", item.get("name") or item.get("display_name", "")),
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
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "display_name and file_type required"}), 400

    display_name = str(data.get("display_name", "")).strip()
    file_type = str(data.get("file_type", "")).strip().lower()
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
    storage_path = _build_storage_path(classroom_id, file_id, file_type, folder_path)

    try:
        record = client.table("corpus_files").insert({
            "id": file_id,
            "classroom_id": classroom_id,
            "display_name": display_name,
            "storage_path": storage_path,
            "file_type": file_type,
        }).execute()
    except APIError as e:
        print(f"Failed to insert corpus file: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to create corpus file"}), 500

    if not record.data:
        return jsonify({"error": "Failed to create corpus file"}), 500

    try:
        upload_url = generate_upload_url(CORPUS_BUCKET, storage_path)
    except Exception as e:
        print(f"Failed to generate upload URL: {e}", file=sys.stderr)
        try:
            client.table("corpus_files").delete().eq("id", file_id).execute()
        except Exception as cleanup_err:
            print(f"Failed to clean up orphaned corpus_file {file_id}: {cleanup_err}", file=sys.stderr)
        return jsonify({"error": "Failed to generate upload URL"}), 500

    return jsonify({
        **_serialize_file(record.data[0]),
        "upload_url": upload_url,
    }), 201


@corpus_bp.route("/classrooms/<classroom_id>/corpus", methods=["GET"])
@require_auth
def list_corpus_files(classroom_id: str) -> tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()
    if not _user_can_access_classroom(client, classroom_id, g.user_id, g.user_role):
        return jsonify({"error": "Classroom not found or access denied"}), 404

    files = client.table("corpus_files").select("*").eq(
        "classroom_id", classroom_id
    ).order("uploaded_at", desc=True).execute()
    return jsonify([_serialize_file(record) for record in files.data]), 200


@corpus_bp.route("/classrooms/<classroom_id>/corpus/tree", methods=["GET"])
@require_auth
def get_corpus_tree(classroom_id: str) -> tuple[Response, int]:
    if not _validate_uuid(classroom_id):
        return jsonify({"error": "Invalid classroom ID"}), 400

    client = get_supabase_admin_client()
    if not _user_can_access_classroom(client, classroom_id, g.user_id, g.user_role):
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
    if not _validate_uuid(file_id):
        return jsonify({"error": "Invalid file ID"}), 400

    client = get_supabase_admin_client()
    file_result = client.table("corpus_files").select("*").eq("id", file_id).limit(1).execute()
    if not file_result.data:
        return jsonify({"error": "File not found"}), 404

    file_record = file_result.data[0]
    classroom_id = file_record["classroom_id"]
    if not _user_can_access_classroom(client, classroom_id, g.user_id, g.user_role):
        return jsonify({"error": "Access denied"}), 403
    return jsonify(_serialize_file(file_record)), 200


@corpus_bp.route("/corpus/<file_id>", methods=["PATCH"])
@require_role("teacher")
def update_corpus_file(file_id: str) -> tuple[Response, int]:
    if not _validate_uuid(file_id):
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

    old_storage_path = file_record["storage_path"]
    new_storage_path = old_storage_path
    if "folder_path" in data:
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
            except ValueError as e:
                print(
                    f"Failed to move corpus object from {old_storage_path} to {new_storage_path}: {e}",
                    file=sys.stderr,
                )
                return jsonify({"error": "Failed to move corpus file in storage"}), 500
            updates["storage_path"] = new_storage_path

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        updated = client.table("corpus_files").update(updates).eq("id", file_id).execute()
    except APIError as e:
        if updates.get("storage_path") and old_storage_path != new_storage_path:
            try:
                move_object(CORPUS_BUCKET, new_storage_path, old_storage_path)
            except ValueError as rollback_error:
                print(
                    f"Failed to rollback moved corpus object {new_storage_path} -> {old_storage_path}: {rollback_error}",
                    file=sys.stderr,
                )
        print(f"Failed to update corpus file {file_id}: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to update corpus file"}), 500

    if not updated.data:
        return jsonify({"error": "File not found"}), 404
    return jsonify(_serialize_file(updated.data[0])), 200


@corpus_bp.route("/corpus/<file_id>", methods=["DELETE"])
@require_role("teacher")
def delete_corpus_file(file_id: str) -> tuple[Response, int]:
    if not _validate_uuid(file_id):
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
    except APIError as e:
        print(f"Failed to delete corpus file record {file_id}: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to delete corpus file"}), 500
    if not deleted.data:
        return jsonify({"error": "File not found"}), 404

    try:
        delete_object(CORPUS_BUCKET, file_record["storage_path"])
    except ValueError as e:
        print(f"Deleted corpus DB row but failed to remove storage object for {file_id}: {e}", file=sys.stderr)
        return jsonify({
            "file_id": file_id,
            "warning": "File metadata deleted but storage object cleanup failed",
        }), 200
    return Response(status=204)

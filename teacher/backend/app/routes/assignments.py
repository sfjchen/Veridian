import sys
import uuid
from typing import Tuple

from flask import Blueprint, Response, request, jsonify, g
from postgrest.exceptions import APIError
from supabase import Client

from app.middleware.auth import require_auth, require_role
from app.services.supabase_client import get_supabase_admin_client
from app.services.storage import generate_upload_url, generate_download_url

assignments_bp = Blueprint("assignments", __name__)

ASSIGNMENTS_BUCKET = "assignments"
SUBMISSIONS_BUCKET = "submissions"
MAX_TITLE_LENGTH = 500
POSTGRES_UNIQUE_VIOLATION = "23505"


def _verify_classroom_access(
    client: Client, classroom_id: str, user_id: str, role: str,
) -> bool:
    if role == "teacher":
        result = client.table("classrooms").select("id").eq(
            "id", classroom_id
        ).eq("teacher_id", user_id).execute()
    else:
        result = client.table("classroom_memberships").select("classroom_id").eq(
            "classroom_id", classroom_id
        ).eq("student_id", user_id).execute()
    return bool(result.data)


def _validate_context_file_ids(
    client: Client, classroom_id: str, file_ids: list[str],
) -> bool:
    if not file_ids:
        return True
    valid_files = client.table("corpus_files").select("id").eq(
        "classroom_id", classroom_id
    ).in_("id", file_ids).execute()
    return len(valid_files.data) == len(file_ids)


@assignments_bp.route("/classrooms/<classroom_id>/assignments", methods=["POST"])
@require_role("teacher")
def create_assignment(classroom_id: str) -> Tuple[Response, int]:
    data = request.get_json()
    if not data or not data.get("title"):
        return jsonify({"error": "title required"}), 400

    title = str(data["title"]).strip()
    if not title or len(title) > MAX_TITLE_LENGTH:
        return jsonify({"error": f"title must be 1-{MAX_TITLE_LENGTH} characters"}), 400

    client = get_supabase_admin_client()

    if not _verify_classroom_access(client, classroom_id, g.user_id, "teacher"):
        return jsonify({"error": "Classroom not found"}), 404

    context_file_ids = data.get("context_file_ids", [])
    if not isinstance(context_file_ids, list):
        return jsonify({"error": "context_file_ids must be a list"}), 400
    if not _validate_context_file_ids(client, classroom_id, context_file_ids):
        return jsonify({"error": "One or more context_file_ids are invalid"}), 400

    assignment_id = str(uuid.uuid4())
    assignment_file_path = f"{classroom_id}/{assignment_id}/prompt"
    answer_key_path = f"{classroom_id}/{assignment_id}/answer_key"

    try:
        record = client.table("assignments").insert({
            "id": assignment_id,
            "classroom_id": classroom_id,
            "title": title,
            "prompt_storage_path": assignment_file_path,
            "answer_key_storage_path": answer_key_path,
            "context_file_ids": context_file_ids,
            "due_date": data.get("due_date"),
        }).execute()
    except APIError as e:
        print(f"Failed to insert assignment: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to create assignment"}), 500

    try:
        assignment_file_upload_url = generate_upload_url(ASSIGNMENTS_BUCKET, assignment_file_path)
        answer_key_upload_url = generate_upload_url(ASSIGNMENTS_BUCKET, answer_key_path)
    except Exception as e:
        print(f"Failed to generate upload URLs for assignment {assignment_id}: {e}", file=sys.stderr)
        try:
            client.table("assignments").delete().eq("id", assignment_id).execute()
        except Exception as cleanup_err:
            print(f"Failed to clean up orphaned assignment {assignment_id}: {cleanup_err}", file=sys.stderr)
        return jsonify({"error": "Failed to generate upload URLs"}), 500

    if not record.data:
        return jsonify({"error": "Insert returned no data"}), 500

    return jsonify({
        **record.data[0],
        "assignment_file_upload_url": assignment_file_upload_url,
        "answer_key_upload_url": answer_key_upload_url,
    }), 201


@assignments_bp.route("/classrooms/<classroom_id>/assignments", methods=["GET"])
@require_auth
def list_assignments(classroom_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()

    if not _verify_classroom_access(client, classroom_id, g.user_id, g.user_role):
        return jsonify({"error": "Access denied"}), 403

    assignments = client.table("assignments").select("*").eq(
        "classroom_id", classroom_id
    ).order("created_at", desc=True).execute()

    return jsonify(assignments.data), 200


@assignments_bp.route("/assignments/<assignment_id>", methods=["GET"])
@require_auth
def get_assignment(assignment_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()

    assignment = client.table("assignments").select("*").eq(
        "id", assignment_id
    ).execute()

    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    record = assignment.data[0]

    classroom = client.table("classrooms").select("teacher_id").eq(
        "id", record["classroom_id"]
    ).execute()
    if not classroom.data:
        return jsonify({"error": "Classroom not found"}), 404

    is_teacher = g.user_id == classroom.data[0]["teacher_id"]
    if not is_teacher:
        membership = client.table("classroom_memberships").select("student_id").eq(
            "classroom_id", record["classroom_id"]
        ).eq("student_id", g.user_id).execute()
        if not membership.data:
            return jsonify({"error": "Access denied"}), 403

    result = dict(record)

    if record.get("prompt_storage_path"):
        try:
            result["assignment_file_download_url"] = generate_download_url(
                ASSIGNMENTS_BUCKET, record["prompt_storage_path"]
            )
        except ValueError as e:
            print(
                f"Failed to generate assignment file download URL for {assignment_id}: {e}",
                file=sys.stderr,
            )
            result["assignment_file_download_url"] = None
    else:
        result["assignment_file_download_url"] = None

    if is_teacher and record.get("answer_key_storage_path"):
        try:
            result["answer_key_download_url"] = generate_download_url(
                ASSIGNMENTS_BUCKET, record["answer_key_storage_path"]
            )
        except ValueError as e:
            print(
                f"Failed to generate answer key download URL for {assignment_id}: {e}",
                file=sys.stderr,
            )
            result["answer_key_download_url"] = None
    elif is_teacher:
        result["answer_key_download_url"] = None

    return jsonify(result), 200


@assignments_bp.route("/assignments/<assignment_id>", methods=["PATCH"])
@require_role("teacher")
def update_assignment(assignment_id: str) -> Tuple[Response, int]:
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    client = get_supabase_admin_client()

    assignment = client.table("assignments").select("*").eq(
        "id", assignment_id
    ).execute()

    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    record = assignment.data[0]

    classroom = client.table("classrooms").select("teacher_id").eq(
        "id", record["classroom_id"]
    ).execute()
    if not classroom.data or g.user_id != classroom.data[0]["teacher_id"]:
        return jsonify({"error": "Access denied"}), 403

    updates: dict = {}
    if "title" in data:
        title = str(data["title"]).strip()
        if not title or len(title) > MAX_TITLE_LENGTH:
            return jsonify({"error": f"title must be 1-{MAX_TITLE_LENGTH} characters"}), 400
        updates["title"] = title
    if "due_date" in data:
        updates["due_date"] = data["due_date"]  # null clears it

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        updated = client.table("assignments").update(updates).eq(
            "id", assignment_id
        ).execute()
    except APIError as e:
        print(f"Failed to update assignment: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to update assignment"}), 500

    if not updated.data:
        return jsonify({"error": "Update returned no data"}), 500

    return jsonify(updated.data[0]), 200


@assignments_bp.route("/assignments/<assignment_id>/reupload", methods=["POST"])
@require_role("teacher")
def reupload_assignment_files(assignment_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()

    assignment = client.table("assignments").select("*").eq(
        "id", assignment_id
    ).execute()

    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    record = assignment.data[0]

    classroom = client.table("classrooms").select("teacher_id").eq(
        "id", record["classroom_id"]
    ).execute()
    if not classroom.data or g.user_id != classroom.data[0]["teacher_id"]:
        return jsonify({"error": "Access denied"}), 403

    result: dict = {}
    try:
        if record.get("prompt_storage_path"):
            result["assignment_file_upload_url"] = generate_upload_url(
                ASSIGNMENTS_BUCKET, record["prompt_storage_path"]
            )
        if record.get("answer_key_storage_path"):
            result["answer_key_upload_url"] = generate_upload_url(
                ASSIGNMENTS_BUCKET, record["answer_key_storage_path"]
            )
    except Exception as e:
        print(f"Failed to generate reupload URLs for assignment {assignment_id}: {e}", file=sys.stderr)
        return jsonify({"error": "Failed to generate upload URLs"}), 500

    return jsonify(result), 200


@assignments_bp.route("/assignments/<assignment_id>/submissions", methods=["GET"])
@require_auth
def list_submissions(assignment_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()

    assignment = client.table("assignments").select(
        "id, classroom_id"
    ).eq("id", assignment_id).execute()
    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    record = assignment.data[0]
    classroom_id = record["classroom_id"]

    classroom = client.table("classrooms").select("teacher_id").eq(
        "id", classroom_id
    ).execute()
    is_teacher = bool(classroom.data and g.user_id == classroom.data[0]["teacher_id"])

    if is_teacher:
        submissions = client.table("submissions").select("*").eq(
            "assignment_id", assignment_id
        ).order("submitted_at", desc=True).execute()
    else:
        membership = client.table("classroom_memberships").select("student_id").eq(
            "classroom_id", classroom_id
        ).eq("student_id", g.user_id).execute()
        if not membership.data:
            return jsonify({"error": "Access denied"}), 403

        submissions = client.table("submissions").select("*").eq(
            "assignment_id", assignment_id
        ).eq("student_id", g.user_id).order("submitted_at", desc=True).execute()

    records = [dict(submission) for submission in submissions.data]
    student_names: dict[str, str] = {}

    if is_teacher and records:
        student_ids = sorted({record["student_id"] for record in records if record.get("student_id")})
        if student_ids:
            profiles = client.table("profiles").select("id, display_name").in_(
                "id", student_ids
            ).execute()
            student_names = {
                profile["id"]: profile["display_name"]
                for profile in profiles.data
                if profile.get("id")
            }

    result = []
    for record in records:
        item = dict(record)
        if is_teacher:
            item["student_display_name"] = student_names.get(item.get("student_id"))

        storage_path = item.get("storage_path")
        if storage_path:
            try:
                item["download_url"] = generate_download_url(SUBMISSIONS_BUCKET, storage_path)
            except ValueError as e:
                print(
                    f"Failed to generate submission download URL for {item.get('id')}: {e}",
                    file=sys.stderr,
                )
                item["download_url"] = None
        else:
            item["download_url"] = None
        result.append(item)

    return jsonify(result), 200


@assignments_bp.route("/assignments/<assignment_id>/submissions", methods=["POST"])
@require_role("student")
def create_submission(assignment_id: str) -> Tuple[Response, int]:
    client = get_supabase_admin_client()

    def _delete_submission_row(submission_id: str) -> bool:
        try:
            client.table("submissions").delete().eq("id", submission_id).execute()
        except Exception as e:
            print(f"Failed to delete broken submission {submission_id}: {e}", file=sys.stderr)
            return False
        return True

    def _resume_or_recover_existing_submission(existing_record: dict) -> Tuple[Response, int] | None:
        """Return a terminal response, or None when the caller should create a fresh row."""
        submission_id = existing_record.get("id")
        if not submission_id:
            return jsonify({
                "error": "Data integrity error: submission exists without id. Contact support.",
            }), 500

        storage_path = existing_record.get("storage_path")
        if not storage_path:
            if _delete_submission_row(submission_id):
                return None
            return jsonify({
                "error": "Data integrity error: submission exists without storage path. Contact support.",
            }), 500

        try:
            download_url = generate_download_url(SUBMISSIONS_BUCKET, storage_path)
            return jsonify({
                "error": "Submission already exists for this assignment",
                "submission_id": submission_id,
                "download_url": download_url,
            }), 409
        except ValueError:
            try:
                upload_url = generate_upload_url(SUBMISSIONS_BUCKET, storage_path)
            except ValueError as e:
                print(
                    f"Failed to generate resume upload URL for submission {submission_id}: {e}",
                    file=sys.stderr,
                )
                if _delete_submission_row(submission_id):
                    return None
                return jsonify({"error": "Failed to resume existing submission"}), 500
            return jsonify({
                **existing_record,
                "upload_url": upload_url,
            }), 200

    def _insert_submission_row(submission_id: str, storage_path: str) -> object:
        return client.table("submissions").insert({
            "id": submission_id,
            "assignment_id": assignment_id,
            "student_id": g.user_id,
            "storage_path": storage_path,
        }).execute()

    assignment = client.table("assignments").select("id, classroom_id").eq(
        "id", assignment_id
    ).execute()
    if not assignment.data:
        return jsonify({"error": "Assignment not found"}), 404

    classroom_id = assignment.data[0]["classroom_id"]

    membership = client.table("classroom_memberships").select("student_id").eq(
        "classroom_id", classroom_id
    ).eq("student_id", g.user_id).execute()
    if not membership.data:
        return jsonify({"error": "Access denied"}), 403

    existing_submission = client.table("submissions").select("*").eq(
        "assignment_id", assignment_id
    ).eq("student_id", g.user_id).limit(1).execute()
    if existing_submission.data:
        resume_result = _resume_or_recover_existing_submission(existing_submission.data[0])
        if resume_result is not None:
            return resume_result

    record = None
    submission_id = ""
    storage_path = ""
    for _ in range(2):
        submission_id = str(uuid.uuid4())
        storage_path = f"{classroom_id}/{g.user_id}/{submission_id}"
        try:
            record = _insert_submission_row(submission_id, storage_path)
            break
        except APIError as e:
            if e.code != POSTGRES_UNIQUE_VIOLATION:
                print(f"Failed to insert submission: {e}", file=sys.stderr)
                return jsonify({"error": "Failed to create submission"}), 500

            existing = client.table("submissions").select("*").eq(
                "assignment_id", assignment_id
            ).eq("student_id", g.user_id).limit(1).execute()
            if not existing.data:
                continue

            resume_result = _resume_or_recover_existing_submission(existing.data[0])
            if resume_result is not None:
                return resume_result

    if record is None:
        return jsonify({"error": "Failed to create submission"}), 500
    if not record.data:
        return jsonify({"error": "Insert returned no data"}), 500

    try:
        upload_url = generate_upload_url(SUBMISSIONS_BUCKET, storage_path)
    except ValueError as e:
        print(
            f"Failed to generate upload URL for new submission {submission_id}: {e}",
            file=sys.stderr,
        )
        _delete_submission_row(submission_id)
        return jsonify({"error": "Failed to generate upload URL"}), 500

    return jsonify({
        **record.data[0],
        "upload_url": upload_url,
    }), 201

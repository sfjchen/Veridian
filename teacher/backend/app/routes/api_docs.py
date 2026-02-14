from typing import Tuple

from flask import Blueprint, Response, jsonify

api_docs_bp = Blueprint("api_docs", __name__, url_prefix="/docs")

OPENAPI_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": "Teacher Backend API",
        "version": "1.0.0",
        "description": "Live monitoring, insights, classroom CRUD, assignment CRUD, and corpus management endpoints.",
    },
    "paths": {
        "/assignments/{assignment_id}/live/errors": {
            "post": {"summary": "Ingest a live student error log for an assignment (student role)."},
            "get": {"summary": "Fetch assignment error logs with optional student_id/since/limit filters."},
        },
        "/assignments/{assignment_id}/live/progress": {
            "post": {"summary": "Ingest a live assignment progress event (student role)."},
            "get": {"summary": "Fetch latest assignment progress snapshots and optional raw events."},
        },
        "/assignments/{assignment_id}/insights": {
            "get": {"summary": "Teacher insight aggregation: stumbling blocks, engagement, concept mastery."},
        },
        "/assignments/{assignment_id}/students/{student_id}/failure-summary": {
            "get": {"summary": "Explain why a student is failing a specific assignment."},
        },
    },
    "components": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            },
        },
    },
}


@api_docs_bp.route("/openapi.json", methods=["GET"])
def get_openapi_spec() -> Tuple[Response, int]:
    return jsonify(OPENAPI_SPEC), 200

"""
Progress tracking for long-running conversion operations.
Emits WebSocket events to connected clients.
"""

import logging
from typing import Optional
from flask_socketio import emit

log = logging.getLogger(__name__)


class ProgressTracker:
    """
    Tracks and emits progress for PDF/TEX conversion operations.
    """

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.room = f"conversion_{job_id}"

    def emit_progress(
        self,
        stage: str,
        progress: int,
        current_page: Optional[int] = None,
        total_pages: Optional[int] = None,
        message: Optional[str] = None,
    ) -> None:
        """
        Emit progress event to connected WebSocket clients.

        Args:
            stage: Current stage (splitting_pages, converting_page, detecting_problems, complete)
            progress: Progress percentage (0-100)
            current_page: Optional current page number
            total_pages: Optional total pages
            message: Optional status message
        """
        event_data = {
            "stage": stage,
            "progress": progress,
            "job_id": self.job_id,
        }

        if current_page is not None:
            event_data["current_page"] = current_page
        if total_pages is not None:
            event_data["total_pages"] = total_pages
        if message:
            event_data["message"] = message

        try:
            emit("conversion_progress", event_data, room=self.room, namespace="/conversion")
        except Exception:
            log.exception("Failed to emit conversion progress for job %s", self.job_id)

    def splitting_pages(self, total_pages: int) -> None:
        """Emit splitting_pages stage."""
        self.emit_progress(
            stage="splitting_pages",
            progress=0,
            total_pages=total_pages,
            message=f"Splitting {total_pages} pages...",
        )

    def converting_page(self, current: int, total: int) -> None:
        """Emit converting_page stage."""
        progress = int((current / total) * 90)  # 0-90% for conversion
        self.emit_progress(
            stage="converting_page",
            progress=progress,
            current_page=current,
            total_pages=total,
            message=f"Converting page {current}/{total}...",
        )

    def detecting_problems(self, num_detected: Optional[int] = None) -> None:
        """Emit detecting_problems stage."""
        progress = 95 if num_detected is None else 98
        message = "Detecting problems..." if num_detected is None else f"Detected {num_detected} problems"
        self.emit_progress(
            stage="detecting_problems",
            progress=progress,
            message=message,
        )

    def complete(self, problems: list, latex_length: int) -> None:
        """Emit complete stage."""
        self.emit_progress(
            stage="complete",
            progress=100,
            message=f"Conversion complete! {len(problems)} problems detected, {latex_length} chars of LaTeX",
        )

    def error(self, error_message: str) -> None:
        """Emit error event."""
        self.emit_progress(
            stage="error",
            progress=0,
            message=error_message,
        )

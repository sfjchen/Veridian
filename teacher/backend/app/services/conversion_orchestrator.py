"""
Conversion orchestrator for automated PDF/TEX to LaTeX conversion
with intelligent problem detection.
"""

import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Optional
import fitz  # PyMuPDF
import anthropic
from flask import current_app

from app.constants import (
    CLAUDE_MAX_TOKENS,
    CLAUDE_MODEL_SONNET_4_5,
    CONVERSION_MAX_WORKERS,
    CONVERSION_PAGES_PER_CHUNK,
)
from ..utils.latex_parser import (
    Problem,
    Solution,
    ProblemDetectionError,
    extract_problems_from_latex,
    extract_solutions_from_latex,
    validate_problem_structure,
    validate_solution_structure,
)
from .progress_tracker import ProgressTracker


MAX_PDF_SIZE = 16 * 1024 * 1024  # 16MB (matches Flask config)
PDF_SIGNATURE = b"%PDF-"


@dataclass
class ConversionResult:
    """Result of PDF/TEX conversion and problem detection."""
    latex_content: str
    problems: list[Problem]
    needs_review: bool  # True if automatic detection succeeded


class ConversionError(Exception):
    """Raised when conversion fails."""
    pass


class ConversionOrchestrator:
    """Orchestrates multi-agent PDF/TEX conversion and problem detection."""

    def __init__(self, anthropic_api_key: str):
        self.client = anthropic.Anthropic(api_key=anthropic_api_key)

    def process_assignment(
        self,
        assignment_id: str,
        file_bytes: bytes,
        file_type: str,
        progress_tracker: Optional[ProgressTracker] = None,
    ) -> ConversionResult:
        """
        Process assignment file (PDF or TEX) with automatic problem detection.

        Args:
            assignment_id: UUID of assignment
            file_bytes: Raw file bytes
            file_type: 'pdf' or 'tex'

        Returns:
            ConversionResult with LaTeX and detected problems

        Raises:
            ConversionError: If conversion or problem detection fails
        """
        if file_type == "pdf":
            latex_content = self._convert_pdf_to_latex(file_bytes, progress_tracker)
        elif file_type == "tex":
            latex_content = file_bytes.decode("utf-8")
        else:
            raise ConversionError(f"Unsupported file type: {file_type}")

        # Intelligent problem detection
        if progress_tracker:
            progress_tracker.detecting_problems()

        try:
            problems = self._intelligent_problem_detection(latex_content)
            needs_review = True  # Successful auto-detection, offer review

            if progress_tracker:
                progress_tracker.detecting_problems(num_detected=len(problems))
        except ProblemDetectionError as e:
            # Problem detection failed - teacher must use manual entry
            if progress_tracker:
                progress_tracker.error(f"Failed to detect problems: {e}")
            raise ConversionError(f"Failed to detect problems: {e}") from e

        if progress_tracker:
            progress_tracker.complete(problems, len(latex_content))

        return ConversionResult(
            latex_content=latex_content,
            problems=problems,
            needs_review=needs_review,
        )

    def process_corpus(
        self,
        corpus_file_id: str,
        file_bytes: bytes,
        progress_tracker: Optional[ProgressTracker] = None,
    ) -> ConversionResult:
        """
        Process corpus PDF file with automatic LaTeX conversion.
        No problem detection needed for corpus files.

        Args:
            corpus_file_id: UUID of corpus file
            file_bytes: Raw PDF bytes

        Returns:
            ConversionResult with LaTeX content (no problems)

        Raises:
            ConversionError: If conversion fails
        """
        if not file_bytes.startswith(PDF_SIGNATURE):
            raise ConversionError("File must be a PDF")

        latex_content = self._convert_pdf_to_latex(file_bytes, progress_tracker)
        if progress_tracker:
            progress_tracker.complete([], len(latex_content))

        return ConversionResult(
            latex_content=latex_content,
            problems=[],  # No problem detection for corpus
            needs_review=False,
        )

    def _convert_pdf_to_latex(
        self,
        pdf_bytes: bytes,
        progress_tracker: Optional[ProgressTracker] = None,
    ) -> str:
        """
        Convert PDF to LaTeX, handling multi-page PDFs with chunked processing.

        For PDFs ≤ 6 pages: single API call
        For PDFs > 6 pages: split into chunks of 6, parallel conversion, merge

        Args:
            pdf_bytes: Raw PDF file bytes
            progress_tracker: Optional progress tracker for WebSocket updates

        Returns:
            Merged LaTeX content

        Raises:
            ConversionError: If conversion fails
        """
        if len(pdf_bytes) > MAX_PDF_SIZE:
            raise ConversionError(f"File exceeds {MAX_PDF_SIZE // (1024*1024)}MB limit")

        if not pdf_bytes.startswith(PDF_SIGNATURE):
            raise ConversionError("File must be a PDF")

        # Split into page chunks
        page_chunks = self._split_pdf_pages(pdf_bytes)
        num_chunks = len(page_chunks)

        # Calculate total pages for progress
        total_pages = sum(len(chunk) for chunk in page_chunks)
        if progress_tracker:
            progress_tracker.splitting_pages(total_pages)

        if num_chunks == 0:
            raise ConversionError("PDF has no pages")

        # For single chunk (≤6 pages), use simple conversion
        if num_chunks == 1:
            if progress_tracker:
                progress_tracker.converting_page(1, 1)
            return self._convert_page_chunk(page_chunks[0], 0, num_chunks)

        # For multiple chunks, use parallel conversion
        latex_parts = self._spawn_page_agents(page_chunks, progress_tracker)
        return self._merge_latex_results(latex_parts)

    def _split_pdf_pages(self, pdf_bytes: bytes) -> list[list[bytes]]:
        """
        Split PDF into chunks of CONVERSION_PAGES_PER_CHUNK pages (as PNG images).

        Args:
            pdf_bytes: Raw PDF file bytes

        Returns:
            List of chunks, where each chunk is a list of PNG image bytes

        Raises:
            ConversionError: If PDF parsing or rendering fails
        """
        try:
            fitz.TOOLS.mupdf_warnings(reset=True)
            document = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise ConversionError("Failed to parse PDF file") from e
        try:
            total_pages = document.page_count
            if total_pages == 0:
                return []

            chunks: list[list[bytes]] = []
            current_chunk: list[bytes] = []

            for page_num in range(total_pages):
                try:
                    page = document.load_page(page_num)
                    matrix = fitz.Matrix(2.0, 2.0)
                    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                    png_bytes = pixmap.tobytes("png")
                except Exception as e:
                    raise ConversionError(f"Failed to render PDF page {page_num + 1}") from e

                current_chunk.append(png_bytes)
                if len(current_chunk) == CONVERSION_PAGES_PER_CHUNK:
                    chunks.append(current_chunk)
                    current_chunk = []

            if current_chunk:
                chunks.append(current_chunk)
            return chunks
        finally:
            document.close()

    def _spawn_page_agents(
        self,
        page_chunks: list[list[bytes]],
        progress_tracker: Optional[ProgressTracker] = None,
    ) -> list[str]:
        """
        Spawn parallel conversion tasks for each page chunk.

        Args:
            page_chunks: List of page chunks (each chunk is list of PNG bytes)
            progress_tracker: Optional progress tracker for WebSocket updates

        Returns:
            List of LaTeX strings (one per chunk, in order)

        Raises:
            ConversionError: If any chunk conversion fails
        """
        num_chunks = len(page_chunks)
        results = [None] * num_chunks  # Preserve order
        completed_chunks = 0

        with ThreadPoolExecutor(max_workers=min(CONVERSION_MAX_WORKERS, num_chunks)) as executor:
            # Submit all chunk conversion tasks
            future_to_index = {
                executor.submit(
                    self._convert_page_chunk,
                    chunk,
                    i,
                    num_chunks,
                ): i
                for i, chunk in enumerate(page_chunks)
            }

            # Collect results as they complete
            for future in as_completed(future_to_index):
                chunk_index = future_to_index[future]
                try:
                    latex = future.result()
                    results[chunk_index] = latex
                    completed_chunks += 1

                    # Emit progress after each chunk completes
                    if progress_tracker:
                        progress_tracker.converting_page(completed_chunks, num_chunks)
                except ConversionError as e:
                    raise ConversionError(f"Failed to convert chunk {chunk_index + 1}: {e}") from e

        # Verify all chunks succeeded
        if any(r is None for r in results):
            raise ConversionError("Some chunks failed to convert")

        return results  # type: ignore

    def _convert_page_chunk(
        self,
        page_images: list[bytes],
        chunk_index: int,
        total_chunks: int,
    ) -> str:
        """
        Convert a chunk of page images to LaTeX using Claude.

        Args:
            page_images: List of PNG image bytes (1-6 pages)
            chunk_index: Index of this chunk (for logging)
            total_chunks: Total number of chunks (for logging)

        Returns:
            LaTeX content for this chunk

        Raises:
            ConversionError: If API call fails
        """
        # Build message content with all page images
        content = []
        for i, png_bytes in enumerate(page_images):
            png_b64 = base64.standard_b64encode(png_bytes).decode("utf-8")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": png_b64,
                },
            })

        # Add instruction text
        if len(page_images) == 1:
            instruction = "Convert this page to LaTeX (.tex)."
        else:
            instruction = f"Convert these {len(page_images)} pages to LaTeX (.tex). Preserve page order."

        content.append({
            "type": "text",
            "text": f"{instruction} Return ONLY the LaTeX code -- no explanation, no markdown code fences. Preserve all mathematical notation, formatting, and structure as faithfully as possible. Skip any images or figures -- do not include \\includegraphics or figure environments.",
        })

        try:
            message = self.client.messages.create(
                model=CLAUDE_MODEL_SONNET_4_5,
                max_tokens=CLAUDE_MAX_TOKENS,
                messages=[{
                    "role": "user",
                    "content": content,
                }],
            )

            if not message.content:
                raise ConversionError("Claude API returned empty response")

            block = message.content[0]
            if not hasattr(block, "text"):
                raise ConversionError(f"Claude API returned non-text content: {block.type}")

            return block.text

        except anthropic.APIError as e:
            raise ConversionError(f"Anthropic API error: {e}") from e

    def _merge_latex_results(self, latex_parts: list[str]) -> str:
        """
        Merge LaTeX results from multiple chunks, preserving page boundaries.

        Args:
            latex_parts: List of LaTeX strings (one per chunk)

        Returns:
            Merged LaTeX document
        """
        if not latex_parts:
            return ""

        if len(latex_parts) == 1:
            return latex_parts[0]

        # Simple merge with page break comments
        merged = []
        for i, part in enumerate(latex_parts):
            if i > 0:
                merged.append(f"\n% ===== Page Chunk {i + 1} =====\n")
            merged.append(part)

        return "\n".join(merged)

    def _intelligent_problem_detection(self, latex: str) -> list[Problem]:
        """
        Use Claude to intelligently detect problems in LaTeX source.

        Args:
            latex: Raw LaTeX content

        Returns:
            List of detected and validated problems

        Raises:
            ProblemDetectionError: If detection or validation fails
        """
        # Extract problems using AI
        raw_problems = extract_problems_from_latex(latex)

        # Validate structure
        validated_problems = validate_problem_structure(raw_problems)

        return validated_problems

    def process_answer_key(
        self,
        file_bytes: bytes,
        file_type: str,
        progress_tracker: Optional[ProgressTracker] = None,
    ) -> dict:
        """
        Process answer key file (PDF or TEX) with automatic solution detection.

        Args:
            file_bytes: Raw file bytes
            file_type: 'pdf' or 'tex'
            progress_tracker: Optional progress tracker for WebSocket updates

        Returns:
            Dict with latex_content, solutions, needs_review

        Raises:
            ConversionError: If conversion or solution detection fails
        """
        if file_type == "pdf":
            latex_content = self._convert_pdf_to_latex(file_bytes, progress_tracker)
        elif file_type == "tex":
            latex_content = file_bytes.decode("utf-8")
        else:
            raise ConversionError(f"Unsupported file type: {file_type}")

        # Intelligent solution detection
        if progress_tracker:
            progress_tracker.emit_progress(
                stage="detecting_solutions",
                progress=95,
                message="Detecting solutions...",
            )

        try:
            solutions = self._intelligent_solution_detection(latex_content, progress_tracker)
            needs_review = True  # Successful auto-detection, offer review

            if progress_tracker:
                progress_tracker.emit_progress(
                    stage="detecting_solutions",
                    progress=98,
                    message=f"Detected {len(solutions)} solutions",
                )
        except ProblemDetectionError as e:
            # Solution detection failed
            if progress_tracker:
                progress_tracker.error(f"Failed to detect solutions: {e}")
            raise ConversionError(f"Failed to detect solutions: {e}") from e

        if progress_tracker:
            progress_tracker.complete(solutions, len(latex_content))

        return {
            "latex_content": latex_content,
            "solutions": solutions,
            "needs_review": needs_review,
        }

    def _intelligent_solution_detection(
        self,
        latex: str,
        progress_tracker: Optional[ProgressTracker] = None,
    ) -> list[Solution]:
        """
        Use Claude to intelligently detect solutions in LaTeX answer key.

        Args:
            latex: Raw LaTeX content
            progress_tracker: Optional progress tracker

        Returns:
            List of detected and validated solutions

        Raises:
            ProblemDetectionError: If detection or validation fails
        """
        # Extract solutions using AI
        raw_solutions = extract_solutions_from_latex(latex)

        # Validate structure
        validated_solutions = validate_solution_structure(raw_solutions)

        return validated_solutions


def create_orchestrator() -> ConversionOrchestrator:
    """
    Create orchestrator instance with API key from Flask config.

    Returns:
        Configured ConversionOrchestrator
    """
    return ConversionOrchestrator(
        anthropic_api_key=current_app.config["ANTHROPIC_API_KEY"]
    )

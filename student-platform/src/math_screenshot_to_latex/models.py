"""Config for math screenshot → LaTeX."""

import os

_MODEL = os.getenv("MATH_OCR_MODEL", "gpt-4o-mini").strip()
_DETAIL = (os.getenv("MATH_OCR_IMAGE_DETAIL", "low") or "low").strip().lower()
MODEL = _MODEL
IMAGE_DETAIL = "high" if _DETAIL == "high" else "low"

PROMPT = """Convert ALL mathematical content in this image to valid LaTeX, including both printed/typed text and handwritten work.
Capture everything: problem statements, student work, intermediate steps, side notes, and final answers.
Output ONLY the LaTeX code—no explanation, markdown, or code fences.
Use \\frac{}{}, \\sqrt{}, ^, _ for fractions/roots/superscripts/subscripts.
Preserve structure and layout: matrices, integrals, summations, align environments."""

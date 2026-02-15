"""
LaTeX parsing utilities for intelligent problem detection and extraction.
"""

import json
import re
from typing import Any, TypedDict
import anthropic
from flask import current_app
from app.constants import CLAUDE_MAX_TOKENS, CLAUDE_MODEL_SONNET_4_5
from ..prompts.problem_detection import get_problem_detection_prompt


class Problem(TypedDict):
    num: int
    statement_tex: str


class ProblemDetectionError(Exception):
    """Raised when problem detection fails."""
    pass


def extract_problems_from_latex(latex: str) -> list[dict[str, Any]]:
    """
    Use Claude Sonnet 4.5 to intelligently detect problems in LaTeX source.
    No explicit \\Problem{} blocks required - AI infers problem boundaries.

    Args:
        latex: Raw LaTeX source content

    Returns:
        List of detected problems with num and statement_tex

    Raises:
        ProblemDetectionError: If AI fails to detect problems or returns invalid JSON
    """
    if not latex.strip():
        raise ProblemDetectionError("Empty LaTeX source provided")

    client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])
    prompt = get_problem_detection_prompt(latex)

    try:
        message = client.messages.create(
            model=CLAUDE_MODEL_SONNET_4_5,
            max_tokens=CLAUDE_MAX_TOKENS,
            messages=[{
                "role": "user",
                "content": prompt,
            }],
        )

        if not message.content:
            raise ProblemDetectionError("Claude API returned empty response")

        block = message.content[0]
        if not hasattr(block, "text"):
            raise ProblemDetectionError(f"Claude API returned non-text content: {block.type}")

        response_text = block.text.strip()

        # Parse JSON response
        try:
            problems = json.loads(response_text)
        except json.JSONDecodeError as e:
            snippet = response_text[:500]
            raise ProblemDetectionError(
                f"Failed to parse JSON response: {e}. Response snippet: {snippet!r}"
            ) from e

        # Check for error response
        if isinstance(problems, dict) and "error" in problems:
            raise ProblemDetectionError(problems["error"])

        if not isinstance(problems, list):
            raise ProblemDetectionError(f"Expected JSON array, got {type(problems)}")

        return problems

    except anthropic.APIError as e:
        raise ProblemDetectionError(f"Anthropic API error: {e}") from e


def validate_problem_structure(problems: list[dict[str, Any]]) -> list[Problem]:
    """
    Validate problem structure against existing constraints.

    Constraints:
    - Max 100 problems per assignment
    - Unique num values (sequential from 1)
    - Each statement_tex < 5000 characters
    - Required fields: num (int), statement_tex (str)

    Args:
        problems: Raw problem dictionaries from AI

    Returns:
        Validated and typed list of Problem objects

    Raises:
        ProblemDetectionError: If validation fails
    """
    if not problems:
        raise ProblemDetectionError("No problems detected")

    if len(problems) > 100:
        raise ProblemDetectionError(f"Too many problems detected: {len(problems)} (max 100)")

    validated: list[Problem] = []
    seen_nums = set()

    for i, problem in enumerate(problems):
        # Check required fields
        if not isinstance(problem, dict):
            raise ProblemDetectionError(f"Problem {i+1} is not a dictionary")

        if "num" not in problem:
            raise ProblemDetectionError(f"Problem {i+1} missing 'num' field")

        if "statement_tex" not in problem:
            raise ProblemDetectionError(f"Problem {i+1} missing 'statement_tex' field")

        num = problem["num"]
        statement_tex = problem["statement_tex"]

        # Validate types
        if not isinstance(num, int):
            raise ProblemDetectionError(f"Problem {i+1} num must be integer, got {type(num)}")

        if not isinstance(statement_tex, str):
            raise ProblemDetectionError(f"Problem {i+1} statement_tex must be string, got {type(statement_tex)}")

        # Check num uniqueness
        if num in seen_nums:
            raise ProblemDetectionError(f"Duplicate problem number: {num}")
        seen_nums.add(num)

        # Check statement length
        if len(statement_tex) >= 5000:
            raise ProblemDetectionError(f"Problem {num} statement_tex exceeds 5000 characters")

        # Check statement not empty
        if not statement_tex.strip():
            raise ProblemDetectionError(f"Problem {num} has empty statement_tex")

        validated.append(Problem(num=num, statement_tex=statement_tex))

    # Ensure nums are sequential from 1
    expected_nums = set(range(1, len(validated) + 1))
    if seen_nums != expected_nums:
        raise ProblemDetectionError(f"Problem numbers must be sequential from 1, got {sorted(seen_nums)}")

    return validated


def convert_to_problem_blocks(latex: str, problems: list[Problem]) -> str:
    """
    Insert \\Problem{statement_tex} commands into source LaTeX.
    Used for internal storage format when needed.

    Args:
        latex: Original LaTeX source
        problems: List of problems to insert

    Returns:
        LaTeX with \\Problem{} blocks inserted
    """
    if not problems:
        return latex

    # Build problem blocks
    problem_blocks = []
    for problem in sorted(problems, key=lambda p: p["num"]):
        problem_blocks.append(f"\\Problem{{{problem['statement_tex']}}}")

    # Insert at beginning of document (after preamble if exists)
    if "\\begin{document}" in latex:
        # Insert after \begin{document}
        parts = latex.split("\\begin{document}", 1)
        return (
            parts[0] +
            "\\begin{document}\n\n" +
            "\n\n".join(problem_blocks) +
            "\n\n" +
            parts[1]
        )
    else:
        # No document environment, prepend
        return "\n\n".join(problem_blocks) + "\n\n" + latex

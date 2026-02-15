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
from ..prompts.solution_detection import get_solution_detection_prompt


_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(.*?)```\s*$", re.DOTALL)


def _strip_code_fences(text: str) -> str:
    m = _CODE_FENCE_RE.match(text)
    return m.group(1).strip() if m else text


class Problem(TypedDict):
    num: int
    statement_tex: str


class Solution(TypedDict):
    num: int
    solution_tex: str


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

        response_text = _strip_code_fences(block.text.strip())

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


def extract_solutions_from_latex(latex: str) -> list[dict[str, Any]]:
    """
    Use Claude Sonnet 4.5 to intelligently detect solutions in LaTeX answer key.
    No explicit \\Solution{} blocks required - AI infers solution boundaries.

    Args:
        latex: Raw LaTeX answer key content

    Returns:
        List of detected solutions with num and solution_tex

    Raises:
        ProblemDetectionError: If AI fails to detect solutions or returns invalid JSON
    """
    if not latex.strip():
        raise ProblemDetectionError("Empty LaTeX source provided")

    client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])
    prompt = get_solution_detection_prompt(latex)

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

        response_text = _strip_code_fences(block.text.strip())

        try:
            solutions = json.loads(response_text)
        except json.JSONDecodeError as e:
            snippet = response_text[:500]
            raise ProblemDetectionError(
                f"Failed to parse JSON response: {e}. Response snippet: {snippet!r}"
            ) from e

        # Check for error response
        if isinstance(solutions, dict) and "error" in solutions:
            raise ProblemDetectionError(solutions["error"])

        if not isinstance(solutions, list):
            raise ProblemDetectionError(f"Expected JSON array, got {type(solutions)}")

        return solutions

    except anthropic.APIError as e:
        raise ProblemDetectionError(f"Anthropic API error: {e}") from e


def validate_solution_structure(solutions: list[dict[str, Any]]) -> list[Solution]:
    """
    Validate solution structure against constraints.

    Constraints:
    - Max 100 solutions per assignment
    - Unique num values (sequential from 1)
    - Each solution_tex < 5000 characters
    - Required fields: num (int), solution_tex (str)

    Args:
        solutions: Raw solution dictionaries from AI

    Returns:
        Validated and typed list of Solution objects

    Raises:
        ProblemDetectionError: If validation fails
    """
    if not solutions:
        raise ProblemDetectionError("No solutions detected")

    if len(solutions) > 100:
        raise ProblemDetectionError(f"Too many solutions detected: {len(solutions)} (max 100)")

    validated: list[Solution] = []
    seen_nums = set()

    for i, solution in enumerate(solutions):
        # Check required fields
        if not isinstance(solution, dict):
            raise ProblemDetectionError(f"Solution {i+1} is not a dictionary")

        if "num" not in solution:
            raise ProblemDetectionError(f"Solution {i+1} missing 'num' field")

        if "solution_tex" not in solution:
            raise ProblemDetectionError(f"Solution {i+1} missing 'solution_tex' field")

        num = solution["num"]
        solution_tex = solution["solution_tex"]

        # Validate types
        if not isinstance(num, int):
            raise ProblemDetectionError(f"Solution {i+1} num must be integer, got {type(num)}")

        if not isinstance(solution_tex, str):
            raise ProblemDetectionError(f"Solution {i+1} solution_tex must be string, got {type(solution_tex)}")

        # Check num uniqueness
        if num in seen_nums:
            raise ProblemDetectionError(f"Duplicate solution number: {num}")
        seen_nums.add(num)

        # Check solution length
        if len(solution_tex) >= 5000:
            raise ProblemDetectionError(f"Solution {num} solution_tex exceeds 5000 characters")

        # Check solution not empty
        if not solution_tex.strip():
            raise ProblemDetectionError(f"Solution {num} has empty solution_tex")

        validated.append(Solution(num=num, solution_tex=solution_tex))

    # Ensure nums are sequential from 1
    expected_nums = set(range(1, len(validated) + 1))
    if seen_nums != expected_nums:
        raise ProblemDetectionError(f"Solution numbers must be sequential from 1, got {sorted(seen_nums)}")

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

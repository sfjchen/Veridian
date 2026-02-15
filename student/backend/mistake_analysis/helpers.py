"""Pure utility functions for mistake analysis."""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# LaTeX special characters that need escaping in free text
LATEX_SPECIAL = str.maketrans({
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    "%": r"\%",
    "&": r"\&",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
})


def escape_latex_text(text: str) -> str:
    """Escape LaTeX special characters in free text (e.g. mistake explanations)."""
    return text.translate(LATEX_SPECIAL)


def extract_json_from_llm_response(text: str, context: str = "") -> dict:
    """
    Parse JSON from an LLM response, handling markdown fences and bare JSON.

    Args:
        text: Raw LLM response text.
        context: Description of where this response came from (for error messages).

    Returns:
        Parsed dict.

    Raises:
        ValueError: If no valid JSON can be extracted.
    """
    # Strip ```json ... ``` fences
    stripped = re.sub(r"^```(?:json)?\s*\n?", "", text.strip(), count=1)
    stripped = re.sub(r"\n?```\s*$", "", stripped.strip(), count=1)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Fallback: find outermost { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    preview = text[:200]
    raise ValueError(
        f"Failed to extract JSON from LLM response ({context}). "
        f"Response starts with: {preview!r}"
    )


def extract_text(response: Any) -> str:
    """Extract all text content from a Claude API response, skipping thinking blocks."""
    parts = [block.text for block in response.content if block.type == "text"]
    if not parts:
        raise ValueError("No text block found in response")
    return "\n".join(parts).strip()


def find_snippet(source: str, snippet: str, hint: str) -> tuple[int, int]:
    """
    Find the position of `snippet` in `source`, using `hint` for disambiguation
    if the snippet appears multiple times.

    Returns:
        (start, end) indices of the matched span, or (-1, -1) if not found.
    """
    # collect all candidate spans as (start, end)
    candidates: list[tuple[int, int]] = []

    # try exact substring matches
    pos = 0
    while True:
        pos = source.find(snippet, pos)
        if pos == -1:
            break
        candidates.append((pos, pos + len(snippet)))
        pos += 1

    # if no exact matches, try whitespace-tolerant regex
    if not candidates:
        parts = re.split(r"\s+", snippet)
        normalized_snippet = r"\s+".join(re.escape(p) for p in parts if p)
        for match in re.finditer(normalized_snippet, source):
            candidates.append((match.start(), match.end()))

    if not candidates:
        logger.warning(
            "Could not locate snippet in source (hint=%r): %s",
            hint,
            snippet[:80],
        )
        return (-1, -1)

    if len(candidates) == 1:
        return candidates[0]

    # multiple matches — use hint to disambiguate
    if hint:
        hint_idx = source.find(hint)
        if hint_idx != -1:
            return min(candidates, key=lambda s_e: abs(s_e[0] - hint_idx))

    return candidates[0]  # fall back to first occurrence


# Math-mode delimiters: (open, close) pairs
_MATH_DELIMITERS = [
    ("\\begin{equation}", "\\end{equation}"),
    ("\\begin{equation*}", "\\end{equation*}"),
    ("\\begin{align}", "\\end{align}"),
    ("\\begin{align*}", "\\end{align*}"),
    ("\\begin{gather}", "\\end{gather}"),
    ("\\begin{gather*}", "\\end{gather*}"),
    ("\\begin{multline}", "\\end{multline}"),
    ("\\begin{multline*}", "\\end{multline*}"),
    ("\\begin{math}", "\\end{math}"),
    ("\\[", "\\]"),
    ("$$", "$$"),
]


def _is_escaped(text: str, pos: int) -> bool:
    """Check if the character at `pos` is escaped by counting preceding backslashes."""
    n = 0
    while pos - 1 - n >= 0 and text[pos - 1 - n] == "\\":
        n += 1
    return n % 2 == 1


def _strip_tex_comments(source: str) -> str:
    """Replace TeX comment content (unescaped % to end of line) with spaces.

    Preserves string length so that character positions remain valid.
    """
    result = list(source)
    i = 0
    while i < len(result):
        if result[i] == "%" and not _is_escaped(source, i):
            j = i
            while j < len(result) and result[j] != "\n":
                result[j] = " "
                j += 1
            i = j
        else:
            i += 1
    return "".join(result)


def in_math_mode(source: str, pos: int) -> bool:
    """Check whether `pos` falls inside a math-mode environment in `source`."""
    # Strip comments so that delimiters inside comments are ignored.
    # Length is preserved so `pos` remains valid.
    cleaned = _strip_tex_comments(source)

    # Check block/display math delimiters
    for open_delim, close_delim in _MATH_DELIMITERS:
        search_start = 0
        while True:
            open_idx = cleaned.find(open_delim, search_start)
            if open_idx == -1 or open_idx >= pos:
                break
            # Skip \[ / \] that are actually \\[...] line breaks
            if open_delim == "\\[" and _is_escaped(cleaned, open_idx):
                search_start = open_idx + len(open_delim)
                continue
            close_idx = cleaned.find(close_delim, open_idx + len(open_delim))
            # Skip \\] line-break false positives when searching for close
            while (close_idx != -1 and close_delim == "\\]"
                   and _is_escaped(cleaned, close_idx)):
                close_idx = cleaned.find(close_delim, close_idx + len(close_delim))
            if close_idx == -1:
                close_idx = len(cleaned)
            if pos < close_idx + len(close_delim):
                return True
            search_start = close_idx + len(close_delim)

    # Check inline $...$ (not $$) by counting unescaped $ before pos
    count = 0
    i = 0
    text_before = cleaned[:pos]
    while i < len(text_before):
        if text_before[i] == "$" and not _is_escaped(source, i):
            # skip $$ (handled above)
            if i + 1 < len(text_before) and text_before[i + 1] == "$":
                i += 2
                continue
            count += 1
        i += 1
    # odd count means we're inside an inline math span
    return count % 2 == 1

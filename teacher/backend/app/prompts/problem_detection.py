"""
Problem detection prompt for intelligent LaTeX problem extraction.
Uses Claude Sonnet 4.5 to analyze LaTeX documents and identify distinct problems.
"""

PROBLEM_DETECTION_PROMPT = """
Analyze this LaTeX document and identify distinct mathematical problems.

TASK: Extract individual problems as separate units. Each problem should be:
- A distinct question or exercise
- Self-contained (includes all context needed)
- Numbered or identifiable

OUTPUT FORMAT:
Return ONLY a valid JSON array of problems (no additional text or explanation):
[
  {{"num": 1, "statement_tex": "Solve for x: 2x + 5 = 13"}},
  {{"num": 2, "statement_tex": "Factor the expression: x^2 - 5x + 6"}}
]

GUIDELINES:
- Preserve ALL LaTeX math commands verbatim (\\frac{{}}{{}}, \\sqrt{{}}, etc.)
- Maintain high-fidelity formatting (fonts, spacing, alignment)
- If problems aren't explicitly numbered, infer logical breaks (look for new prompts, section headings, blank lines)
- Combine multi-part problems into single statement with parts labeled (a), (b), etc.
- Number problems sequentially starting from 1
- Each statement_tex must be < 5000 characters
- Maximum 100 problems per document
- If no distinct problems found, return error: {{"error": "No distinct problems detected"}}
- Include complete problem statements with all context (diagrams, tables, etc. as LaTeX)

EXAMPLES:

Input LaTeX:
```
1. Solve for x: $2x + 5 = 13$

2. Factor the expression: $x^2 - 5x + 6$
```

Output:
[
  {{"num": 1, "statement_tex": "Solve for x: $2x + 5 = 13$"}},
  {{"num": 2, "statement_tex": "Factor the expression: $x^2 - 5x + 6$"}}
]

Input LaTeX (multi-part):
```
Problem 1: Quadratic equations
a) Solve $x^2 - 4 = 0$
b) Solve $x^2 + 3x - 10 = 0$
```

Output:
[
  {{"num": 1, "statement_tex": "Quadratic equations\\n\\na) Solve $x^2 - 4 = 0$\\n\\nb) Solve $x^2 + 3x - 10 = 0$"}}
]

LATEX SOURCE:
{latex_source}
"""

def get_problem_detection_prompt(latex_source: str) -> str:
    """
    Generate problem detection prompt with LaTeX source.

    Args:
        latex_source: Raw LaTeX document content

    Returns:
        Formatted prompt for Claude
    """
    return PROBLEM_DETECTION_PROMPT.format(latex_source=latex_source)

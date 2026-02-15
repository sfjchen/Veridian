"""
Solution detection prompt for intelligent LaTeX solution extraction.
Uses Claude Sonnet 4.5 to analyze answer key documents and identify distinct solutions.
"""

SOLUTION_DETECTION_PROMPT = """
Analyze this LaTeX answer key document and extract individual solutions.

TASK: Extract solutions for each problem. Each solution should be:
- The worked-out answer to a distinct problem
- Complete with all steps and explanations
- Numbered to match the corresponding problem

OUTPUT FORMAT:
Return ONLY a valid JSON array of solutions (no additional text or explanation):
[
  {{"num": 1, "solution_tex": "x = 4\\n\\n\\text{{Step 1: Subtract 5 from both sides}}\\n2x = 8\\n\\n\\text{{Step 2: Divide by 2}}\\nx = 4"}},
  {{"num": 2, "solution_tex": "(x - 2)(x - 3)"}}
]

GUIDELINES:
- Preserve ALL LaTeX math commands verbatim (\\frac{{}}{{}}, \\sqrt{{}}, etc.)
- Maintain high-fidelity formatting (fonts, spacing, alignment)
- If solutions aren't explicitly numbered, infer logical breaks (look for new problem numbers, section headings, blank lines)
- Include all work shown in the solution - steps, explanations, diagrams (as LaTeX)
- Number solutions sequentially starting from 1 to match problem numbers
- Each solution_tex must be < 5000 characters
- Maximum 100 solutions per document
- If no distinct solutions found, return error: {{"error": "No distinct solutions detected"}}
- Include complete solution content with all context

EXAMPLES:

Input LaTeX (answer key):
```
1. x = 4

To solve $2x + 5 = 13$:
- Subtract 5: $2x = 8$
- Divide by 2: $x = 4$

2. $(x-2)(x-3)$

Factor $x^2 - 5x + 6$ by finding factors of 6 that add to -5.
```

Output:
[
  {{"num": 1, "solution_tex": "x = 4\\n\\nTo solve $2x + 5 = 13$:\\n- Subtract 5: $2x = 8$\\n- Divide by 2: $x = 4$"}},
  {{"num": 2, "solution_tex": "$(x-2)(x-3)$\\n\\nFactor $x^2 - 5x + 6$ by finding factors of 6 that add to -5."}}
]

LATEX SOURCE:
{latex_source}
"""

def get_solution_detection_prompt(latex_source: str) -> str:
    """
    Generate solution detection prompt with LaTeX source.

    Args:
        latex_source: Raw LaTeX answer key document content

    Returns:
        Formatted prompt for Claude
    """
    return SOLUTION_DETECTION_PROMPT.format(latex_source=latex_source)

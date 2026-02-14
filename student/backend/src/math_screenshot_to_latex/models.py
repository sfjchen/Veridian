"""Config for math screenshot → LaTeX (GPT-5.2)."""

MODEL = "gpt-5.2"

PROMPT = """Convert ALL mathematical content in this image to valid LaTeX, including both printed/typed text and handwritten work.
Capture everything: problem statements, student work, intermediate steps, side notes, and final answers.
Output ONLY the LaTeX code—no explanation, markdown, or code fences.
Use \\frac{}{}, \\sqrt{}, ^, _ for fractions/roots/superscripts/subscripts.
Preserve structure and layout: matrices, integrals, summations, align environments."""

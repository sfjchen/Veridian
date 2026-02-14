"""End-to-end pipeline test: image → LaTeX → mistake analysis → coordinate detection."""
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mistake_analysis.client import MistakeAnalyzer

# Reference solutions for each test image
REFERENCES = {
    "SCR-20260214-bywd.png": {
        "context": r"Ordinary Least Squares derivation. Minimize MSE = (1/n)(Y - X\beta)^T(Y - X\beta) to find \hat{\beta}.",
        "reference": r"""
Y = X\beta + \epsilon
\text{MSE} = \frac{1}{n}(Y - X\beta)^T(Y - X\beta)
= \frac{1}{n}(Y^TY - Y^TX\beta - (X\beta)^TY + (X\beta)^T(X\beta))
= \frac{1}{n}(Y^TY - 2\beta^TX^TY + \beta^TX^TX\beta)
\frac{d}{d\beta}\text{MSE} = \frac{1}{n}(-2X^TY + 2X^TX\beta)
0 = -2X^TY + 2X^TX\beta
X^TX\beta = X^TY
\beta = (X^TX)^{-1}X^TY
""",
    },
    "SCR-20260214-byyz.png": {
        "context": r"Calculus II integration. Show that \int(3x^2 + \sin^2(x) + x\sin(2x))\,dx = x^3 + x\sin^2(x) + c.",
        "reference": r"""
\int(3x^2 + \sin^2(x) + x\sin(2x))\,dx
= \int 3x^2\,dx + \int \sin^2(x)\,dx + \int x\sin(2x)\,dx
\text{For } \int \sin^2(x)\,dx: \sin^2(x) = \frac{1-\cos(2x)}{2}, \text{ so } = \frac{x}{2} - \frac{\sin(2x)}{4} + C_1
\text{For } \int x\sin(2x)\,dx: u=x, dv=\sin(2x)dx \Rightarrow = -\frac{x\cos(2x)}{2} + \frac{\sin(2x)}{4} + C_2
\text{Combining: } x^3 + \frac{x}{2} - \frac{\sin(2x)}{4} - \frac{x\cos(2x)}{2} + \frac{\sin(2x)}{4} + C
= x^3 + \frac{x}{2} - \frac{x\cos(2x)}{2} + C = x^3 + x\cdot\frac{1-\cos(2x)}{2} + C = x^3 + x\sin^2(x) + C
""",
    },
    "SCR-20260214-bzaa.png": {
        "context": r"Calculus II: use integral tables to compute indefinite integrals. Complete the square and apply standard forms.",
        "reference": r"""
\int \frac{1}{x^2 - 6x - 7}\,dx
x^2 - 6x - 7 = (x-3)^2 - 16
u = x-3, a^2 = 16, a = 4
\text{Using } \int \frac{1}{u^2 - a^2}\,du = \frac{1}{2a}\ln\left|\frac{u-a}{u+a}\right| + C
= \frac{1}{8}\ln\left|\frac{x-7}{x+1}\right| + C
""",
    },
    "SCR-20260214-bzch.png": {
        "context": r"Calculus II: evaluate definite integrals using u-substitution.",
        "reference": r"""
\int_{-3}^{e-4} \frac{3t+2}{t+4}\,dt
u = t+4, du = dt, \text{ when } t=-3, u=1; \text{ when } t=e-4, u=e
\frac{3t+2}{t+4} = \frac{3(u-4)+2}{u} = \frac{3u-10}{u} = 3 - \frac{10}{u}
= \int_1^e \left(3 - \frac{10}{u}\right)\,du = [3u - 10\ln|u|]_1^e
= (3e - 10\ln e) - (3 - 10\ln 1) = (3e - 10) - (3 - 0) = 3e - 13
""",
    },
}

TEST_DIR = Path(__file__).resolve().parent / "test_samples"


def test_image_to_latex(image_path: str) -> str:
    """Step 1: Convert image to LaTeX via OpenAI."""
    from math_screenshot_to_latex.client import screenshot_to_latex

    print(f"  [1/3] Image → LaTeX (OpenAI)...", end=" ", flush=True)
    start = time.time()
    latex = screenshot_to_latex(image_path)
    elapsed = time.time() - start
    print(f"done ({elapsed:.1f}s, {len(latex)} chars)")
    return latex


def test_mistake_analysis(student_tex: str, reference_tex: str, context_tex: str) -> dict:
    """Step 2: Analyze mistakes via MistakeAnalyzer (Anthropic)."""
    print(f"  [2/3] Mistake analysis (Anthropic)...", end=" ", flush=True)
    start = time.time()
    analyzer = MistakeAnalyzer()
    result = analyzer.run(
        student_tex=student_tex,
        reference_tex=reference_tex,
        context_tex=context_tex,
        include_solution=True,
    )
    elapsed = time.time() - start
    print(f"done ({elapsed:.1f}s)")
    return result


def test_coord_detection(image_bytes: bytes, annotated_tex: str, media_type: str) -> dict | None:
    """Step 3: Detect mistake coordinates via Claude vision."""
    import base64
    import re
    from io import BytesIO

    from anthropic import Anthropic
    from PIL import Image

    # Check for annotations
    if not re.search(r"\\mistake(?:text)?\s*\{", annotated_tex):
        print(f"  [3/3] Coord detection — skipped (no mistakes annotated)")
        return None

    print(f"  [3/3] Coord detection (Claude vision)...", end=" ", flush=True)
    start = time.time()

    # Import pipeline functions
    from mistake_analysis.constants import ALL_TAGS, SEVERITIES, TAG_TO_SEVERITY

    # Parse annotations
    sys.path.insert(0, str(Path(__file__).resolve().parent))

    # We need the parsing functions from get_coords but can't import the module
    # due to artifact_service dependency. Inline the essential logic.
    from io import BytesIO

    with Image.open(BytesIO(image_bytes)) as im:
        width, height = im.size

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Extract annotations manually using regex (simplified)
    pattern = re.compile(r"\\mistake(?:text)?\s*\{")
    count = len(pattern.findall(annotated_tex))

    prompt = f"""You are given an image (screenshot) and LaTeX with \\mistake{{content}}{{explanation}}{{tag}}{{severity}} annotations.
Find the on-image pixel coordinates for each mistake. Image: {width}x{height}. Origin: top-left.
Return ONLY valid JSON: {{"mistakes": [{{"id": "0", "x_min": N, "y_min": N, "x_max": N, "y_max": N}}]}}

Annotated LaTeX:
{annotated_tex}"""

    response = client.messages.create(
        model=os.getenv("CLAUDE_MODEL"),
        max_tokens=2048,
        temperature=0,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}},
            ],
        }],
    )

    raw = "\n".join(b.text for b in response.content if getattr(b, "type", "") == "text").strip()
    elapsed = time.time() - start
    print(f"done ({elapsed:.1f}s)")

    try:
        result = json.loads(raw)
        return result
    except json.JSONDecodeError:
        # Try to extract JSON
        import re as re2
        match = re2.search(r"\{[\s\S]*\}", raw)
        if match:
            return json.loads(match.group(0))
        print(f"    WARNING: Could not parse coord JSON")
        return {"raw": raw}


def run_test(filename: str) -> None:
    """Run full pipeline on a single test image."""
    image_path = str(TEST_DIR / filename)
    ref = REFERENCES.get(filename, {})

    print(f"\n{'='*70}")
    print(f"TEST: {filename}")
    print(f"{'='*70}")

    # Step 1: Image to LaTeX
    student_tex = test_image_to_latex(image_path)
    print(f"\n  Student LaTeX (first 300 chars):")
    print(f"  {student_tex[:300]}...")

    # Step 2: Mistake Analysis
    result = test_mistake_analysis(
        student_tex=student_tex,
        reference_tex=ref.get("reference", ""),
        context_tex=ref.get("context", ""),
    )

    annotated = result.get("annotated_tex", "")
    continuation = result.get("continuation_tex", "")

    print(f"\n  Annotated LaTeX (first 300 chars):")
    print(f"  {annotated[:300]}...")
    print(f"\n  Continuation (first 200 chars):")
    print(f"  {continuation[:200]}...")

    # Count mistakes from annotated tex
    import re
    mistakes_found = len(re.findall(r"\\mistake(?:text)?\s*\{", annotated))
    print(f"\n  Mistakes found: {mistakes_found}")

    # Step 3: Coordinate Detection (if mistakes exist)
    if mistakes_found > 0:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        coords = test_coord_detection(image_bytes, annotated, "image/png")
        if coords and "mistakes" in coords:
            print(f"\n  Mistake coordinates:")
            for m in coords["mistakes"]:
                print(f"    id={m.get('id')}: ({m.get('x_min')},{m.get('y_min')}) → ({m.get('x_max')},{m.get('y_max')})")
        elif coords:
            print(f"\n  Coord result: {json.dumps(coords, indent=2)[:500]}")
    else:
        print(f"  [3/3] Coord detection — skipped (no mistakes)")

    print(f"\n  RESULT: {'PASS' if student_tex else 'FAIL'} — pipeline completed")
    return {
        "filename": filename,
        "student_tex": student_tex,
        "annotated_tex": annotated,
        "continuation_tex": continuation,
        "mistakes_found": mistakes_found,
    }


if __name__ == "__main__":
    print("=" * 70)
    print("VERIDIAN PIPELINE E2E TEST")
    print(f"Model: {os.getenv('CLAUDE_MODEL')}")
    print(f"Test images: {len(REFERENCES)}")
    print("=" * 70)

    results = []
    for filename in sorted(REFERENCES.keys()):
        try:
            r = run_test(filename)
            results.append(r)
        except Exception as e:
            print(f"\n  FAIL: {e}")
            import traceback
            traceback.print_exc()
            results.append({"filename": filename, "error": str(e)})

    print(f"\n\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    for r in results:
        if "error" in r:
            print(f"  FAIL  {r['filename']}: {r['error']}")
        else:
            print(f"  PASS  {r['filename']}: {r['mistakes_found']} mistakes found")
    print(f"{'='*70}")

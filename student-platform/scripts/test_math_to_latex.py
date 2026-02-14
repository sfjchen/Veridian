#!/usr/bin/env python3
"""Run math screenshot → LaTeX on images. Usage: python scripts/test_math_to_latex.py [dir]"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from dotenv import load_dotenv

load_dotenv()

from math_screenshot_to_latex import screenshot_to_latex

DEFAULT_DIR = Path(__file__).parent.parent / "test_samples"


def main() -> int:
    dir_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DIR
    images = sorted(dir_path.glob("*.png")) + sorted(dir_path.glob("*.jpg"))
    if not images:
        print(f"No PNG/JPG in {dir_path}")
        return 1

    if not os.getenv("OPENAI_API_KEY"):
        print("Set OPENAI_API_KEY in .env")
        return 1

    for img in images:
        print(f"--- {img.name} ---")
        try:
            print(screenshot_to_latex(img))
        except Exception as e:
            print(f"ERROR: {e}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

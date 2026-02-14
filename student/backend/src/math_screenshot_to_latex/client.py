"""Math screenshot → LaTeX via GPT-5.2 vision."""

import base64
import re
from pathlib import Path

from openai import OpenAI

from .models import MODEL, PROMPT

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}


def _strip_fences(raw: str) -> str:
    s = raw.strip()
    m = re.search(r"^```(?:latex|tex)?\s*\n?(.*?)\n?```\s*$", s, re.DOTALL)
    return m.group(1).strip() if m else s


def screenshot_to_latex(image_path: str | Path, model: str = MODEL) -> str:
    """Convert math screenshot to LaTeX. Requires OPENAI_API_KEY in env."""
    path = Path(image_path)
    with open(path, "rb") as f:
        url = f"data:{MIME.get(path.suffix.lower(), 'image/png')};base64,{base64.b64encode(f.read()).decode()}"

    kwargs = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": url, "detail": "high"}},
            ],
        }],
    }
    kwargs["max_completion_tokens" if model.startswith("gpt-5") else "max_tokens"] = 1024

    resp = OpenAI().chat.completions.create(**kwargs)
    return _strip_fences(resp.choices[0].message.content or "")

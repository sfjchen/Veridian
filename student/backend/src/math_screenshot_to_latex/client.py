"""Math screenshot → LaTeX via OpenAI vision."""

import base64
import re
from pathlib import Path
from typing import Optional

from openai import OpenAI

from .models import IMAGE_DETAIL, MODEL, PROMPT

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}


def _strip_fences(raw: str) -> str:
    s = raw.strip()
    m = re.search(r"^```(?:latex|tex)?\s*\n?(.*?)\n?```\s*$", s, re.DOTALL)
    return m.group(1).strip() if m else s


def _image_bytes_to_latex_impl(
    image_bytes: bytes,
    mime_type: str,
    model: str = MODEL,
    detail: str = IMAGE_DETAIL,
) -> str:
    url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
    kwargs = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": url, "detail": detail}},
            ],
        }],
    }
    kwargs["max_completion_tokens" if model.startswith("gpt-5") else "max_tokens"] = 1024
    resp = OpenAI().chat.completions.create(**kwargs)
    return _strip_fences(resp.choices[0].message.content or "")


def screenshot_to_latex(
    image_path: Optional[str | Path] = None,
    *,
    image_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    model: str = MODEL,
    detail: str = IMAGE_DETAIL,
) -> str:
    """Convert math screenshot to LaTeX. Requires OPENAI_API_KEY in env.
    Call with image_path (legacy) or with image_bytes + mime_type (no temp file).
    """
    if image_bytes is not None and mime_type is not None:
        return _image_bytes_to_latex_impl(image_bytes, mime_type, model=model, detail=detail)
    if image_path is None:
        raise ValueError("Provide image_path or (image_bytes, mime_type)")
    path = Path(image_path)
    with open(path, "rb") as f:
        data = f.read()
    mime = MIME.get(path.suffix.lower(), "image/png")
    return _image_bytes_to_latex_impl(data, mime, model=model, detail=detail)
